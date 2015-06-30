/**
  @license
  Copyright (c) 2015 Samuel LESPES CARDILLO . All rights reserved.
**/

// Including and starting all inclusions
var serverPort = 1338;
var tokenPassphrase = "abc-polymer-myexpressed"; // Change this passphrase (for the token)
var activeTokens = new Object(); // Manage active tokens 
var express = require("express");
var app = express()
  , jwt = require('jwt-simple')
  , bodyParser = require('body-parser')
  , request = require('request')
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server)
  , mysql = require('mysql');
app.use(express.static(__dirname + '/app'));
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({extended: true}));   // to support URL-encoded bodies

app.use(function(req,res,next){
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

var pool  =   mysql.createPool({
  connectionLimit : 100, //important
  host     : 'localhost',
  user     : 'root',
  password : 'root',
  database : 'abcpolymer_mysql',
  debug    :  false,
})

console.log("######################################");
console.log("# Application Code Base v1.0 (Regular edition - MySQL)");
console.log("# By @cyberwarfighte1 (Samuel LESPES CARDILLO)");
console.log("######################################");
console.log("[I] Express server started on port " + serverPort + " ...");
console.log("[I] Socket.IO server started on port " + serverPort + "...");

server.listen(serverPort);
// ======================= SQL POOL FUNCTIONS ======================= //

/** 
 * isTokenValid
 * Description :
 *    Check if the token is still valid
 * Properties :
 *    @token      string    required    token to check
 */

// TODO : Erase token if outdated (and define a timer data also)
function isTokenValid(token,callback) {
  var tokenInfos = jwt.decode(token, tokenPassphrase);

  if(activeTokens[tokenInfos["data"]["nickname"]] === undefined) return callback(false); 
  if(activeTokens[tokenInfos["data"]["nickname"]] !== token) return callback(false);

  return callback(tokenInfos);
}

/** 
 * insertUser
 * Description :
 *    Insert a new user in the database
 * Properties :
 *    @nickname   string    required    username to insert in the db
 *    @password   string    required    password to insert in the db
 *    @fullname   string    required    fullname to insert in the db
 */

 // TODO : hash password with MD5 (decide : direct in SQL query OR with bycrypt)
function insertUser(userInfos,callback) {
  pool.getConnection(function(err,connection){
      if (err) {
        connection.release();
        return callback(new Error({"code" : 100, "status" : "Error in connection database"}));
      } 

      connection.query("INSERT INTO `bc_users` VALUES('', " + connection.escape(userInfos["nickname"]) + "," + connection.escape(userInfos["pwd"]) + "," + connection.escape(userInfos["fullname"]) + ")", function(err, rows, fields) {
        connection.release();
        if(err) return callback(new Error('something bad happened'));
        return callback(true);
      });
  });
}

/** 
 * getUser
 * Description :
 *    Get a user from the database
 * Properties :
 *    @username   string    required    username to search in the db
 */
function getUser(username, callback) {
  pool.getConnection(function(err,connection){
      if (err) {
        connection.release();
        return callback(new Error({"code" : 100, "status" : "Error in connection database"}));
      }

      if(username) {
        connection.query("SELECT * FROM `bc_users` WHERE `nickname`=" + connection.escape(username), function(err, rows, fields) {
          connection.release();
          if(err) return callback(new Error('something bad happened'));

          return callback(rows);
        });
      }
  });
}

/** 
 * updatetUser
 * Description :
 *    Update an existing user in the database
 * Properties :
 *    @id     int       required    id of the user to update (from server-side session)
 *    @nickname   string    required    new username
 *    @password   string    required    new password
 *    @fullname   string    required    new fullname
 */

 // TODO : hash password with MD5 (decide : direct in SQL query OR with bycrypt)
function updateUser(userInfos,callback) {
  pool.getConnection(function(err,connection){
      if (err) {
        connection.release();
        return callback(new Error({"code" : 100, "status" : "Error in connection database"}));
      }

      connection.query("UPDATE `bc_users` SET `nickname`=" + connection.escape(userInfos["nickname"]) + ",`pwd`=" + connection.escape(userInfos["pwd"]) + ",`fullname`=" + connection.escape(userInfos["fullname"]) + " WHERE `id`=" + connection.escape(userInfos["id"]), function(err, rows, fields) {
        connection.release();
        if(err) return callback(new Error('something bad happened'));
        return callback(userInfos);
      });
  });
}

// ======================= START SOCKET.IO API ======================= //

io.sockets.on('connection', function(client){
  console.log("[I] Receiving connection...");
});

// ======================= START EXPRESS.JS API ======================= //

/** 
 * /api/register
 * METHOD : POST
 * Description :
 *    Register a user in the database
 * Body :
 *    @username   string    required    Required for the user identity
 *    @password   string    required    Required for the user identity
 *    @fullname   string    required    Required for the user identity
 * Return :
 *    @response   object               
 **/
app.post('/api/register', function(req, res) {
  var response = {
    type: 'register',
    error: '401',
    data: "Argument(s) missing !"
  };

  if(!req.body.nickname || !req.body.pwd || !req.body.fullname) return res.end(JSON.stringify(response));

  userInfos = new Object({
    nickname: req.body.nickname,
    pwd: req.body.pwd,
    fullname: req.body.fullname
  });

  insertUser(userInfos, function(cb){
      response = {
        type: 'register',
        error: '0',
        data: cb
      };
      return res.end(JSON.stringify(response));
  })
});

/** 
 * /login
 * METHOD : POST
 * Description :
 *    Log the user
 * Body :
 *    @nickname   string    required   Required for the user identity
 *    @password   string    required   Required for the user identity
 **/
app.post('/api/login', function(req, res) {
  var response = {
    type: 'login',
    error: '401',
    data: "Argument(s) missing !"
  };
  if(!req.body.nickname || !req.body.pwd) return res.end(JSON.stringify(response));

  // We try to get the user in the database
  getUser(req.body.nickname,function(callback){
    response = {type: 'login',error: '402',data: "Incorrect username !"};
    if(callback.length === 0) return res.end(JSON.stringify(response)); // Username check
    response = {type: 'login',error: '402',data: "Incorrect password !"};
    if(callback[0]["pwd"] != req.body.pwd) return res.end(JSON.stringify(response)); // Password check

    // Creating the token
    var tokenInfos = new Object({
      issuedAt: new Date().toString(),
      data: callback[0]
    });
    var userToken = jwt.encode(tokenInfos, tokenPassphrase)

    activeTokens[callback[0]["nickname"]] = userToken; // Adding the token to the active list

    response = {
      type: 'login',
      error: '0',
      data: new Object({
        token: userToken,
        nickname: callback[0]["nickname"],
        fullname: callback[0]["fullname"],
        pwd: callback[0]["pwd"]
      })
    };

    return res.end(JSON.stringify(response));
  });
});

/** 
 * /api/update
 * METHOD : POST
 * Description :
 *    Update the user profile (according the server-session) in the database
 * Body :
 *    @username   string    required    Required for the user identity
 *    @password   string    required    Required for the user identity
 *    @fullname   string    required    Required for the user identity
 * Return :
 *    @response   object               
 **/
app.post('/api/update', function(req, res) {
  var response = {
    type: 'update',
    error: '401',
    data: "Argument(s) missing !"
  };

  if(!req.body.nickname || !req.body.pwd || !req.body.fullname || !req.body.token) return res.end(JSON.stringify(response));

  isTokenValid(req.body.token,function(tokenInfos){
    response = {
      type: 'update',
      error: '400',
      data: "Access forbidden : user not logged."
    };
    if(!tokenInfos) return res.end(JSON.stringify(response));

    // Preparing the array for the user update
    userInfos = new Object({
      id: tokenInfos.data.id,
      nickname: req.body.nickname,
      pwd: req.body.pwd,
      fullname: req.body.fullname
    });

    // Updating the user
    updateUser(userInfos, function(cb){
      // Creating the updated token
      var tokenInfos = new Object({
        issuedAt: new Date().toString(),
        data: cb
      });
      var userToken = jwt.encode(tokenInfos, tokenPassphrase)

      // Preparing the answer
      response = {
        type: 'update',
        error: '0',
        data: new Object({
          token: userToken,
          nickname: cb["nickname"],
          fullname: cb["fullname"],
          pwd: cb["pwd"]
        })
      };

      activeTokens[cb["nickname"]] = userToken; // Update the active token list with the new token

      return res.end(JSON.stringify(response));
    });

  });
});


/** 
 * /api/logout
 * METHOD : GET
 * Description :
 *    Log out the user by destroying his session
 * Return :
 *    @response   object                User informations (fullname, ...) for the client-side
 **/
app.get('/api/logout', function(req,res) {
  var response = {
      type: 'logout',
      error: '0',
      data: ''
    };

  return res.end(JSON.stringify(response))
});

