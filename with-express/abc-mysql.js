/**
  @license
  Copyright (c) 2015 Samuel LESPES CARDILLO . All rights reserved.
**/

// Including and starting all inclusions
var serverPort = 1338;
var express = require("express");
var app = express()
  , session = require('express-session')
  , FileStore = require('session-file-store')(session)
  , bodyParser = require('body-parser')
  , request = require('request')
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server)
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , mysql = require('mysql');
app.use(express.static(__dirname + '/app'));
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({extended: true}));   // to support URL-encoded bodies
app.use(session({
  genid: function(req) {
    return require('crypto').randomBytes(48).toString('hex'); // use UUIDs for session IDs
  },
  store: new FileStore,
  secret: 'abc-polymer-myexpressed', // Change it
  proxy: true,
  resave: true,
  rolling: true,
  saveUninitialized: false,
  cookie: { secure: false }
}))
app.use(passport.initialize());
app.use(passport.session());

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
console.log("# Application Code Base v1.0 (Express edition - MySQL)");
console.log("# By @cyberwarfighte1 (Samuel LESPES CARDILLO)");
console.log("######################################");
console.log("[I] Express server started on port " + serverPort + " ...");
console.log("[I] Socket.IO server started on port " + serverPort + "...");

server.listen(serverPort);
// ======================= SQL POOL FUNCTIONS ======================= //

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
        connection.query("SELECT * FROM `bc_users` WHERE `nickname`=" + connection.escape(username) + "", function(err, rows, fields) {
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
 *    @userid     int       required    id of the user to update (from server-side session)
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

      connection.query("UPDATE `bc_users` SET `nickname`=" + connection.escape(userInfos["nickname"]) + ",`pwd`=" + connection.escape(userInfos["pwd"]) + ",`fullname`=" + connection.escape(userInfos["fullname"]) + " WHERE `id`=" + connection.escape(userInfos["userId"]), function(err, rows, fields) {
        connection.release();
        if(err) return callback(new Error('something bad happened'));
        return callback(userInfos);
      });
  });
}

// ======================= DEFINE PASSPORT STRATEGIES ======================= //

// TODO : handle error if incorrect username
passport.use('local', new LocalStrategy({
    usernameField: 'nickname',
    passwordField: 'pwd'
  },
  function(username, password, done) {
    getUser(username,function(callback){
      if(callback.length === 0) return done(null, false, { message: 'Incorrect username.' });
      if(callback[0]["pwd"] != password) return done(null, false, { message: 'Incorrect password.' });
      return done(null, callback[0]);
    })
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

// ======================= START SOCKET.IO API ======================= //

io.sockets.on('connection', function(client){
  console.log("[I] Receiving connection...");
});

// ======================= START EXPRESS.JS API ======================= //

app.get("/",function(req,res){
  res.render(__dirname + "/app/index.html", {titleo: 'lol'})
})

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
 * /api/login
 * METHOD : POST
 * Description :
 *    Verify user credentials and create a server-based session
 * Body :
 *    @username   string    required    Required for the user identity
 *    @password   string    required    Required for the user identity
 * Return :
 *    @response   object                User informations (fullname, ...) for the client-side
 **/
app.post('/api/login',
  passport.authenticate('local'),
  function(req, res) {
    req.login(req.user, function(err) {
      if (err) { return console.log("sorry") }

      var response = {
        type: 'login',
        error: '0',
        data: req.user
      };
      res.end(JSON.stringify(response));
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

    if(!req.body.nickname || !req.body.pwd || !req.body.fullname) return res.end(JSON.stringify(response));

    var response = {
      type: 'update',
      error: '400',
      data: "Access forbidden : user not logged."
    };
    if(!req.isAuthenticated) return res.end(JSON.stringify(response));

    userInfos = new Object({
      userId: req.user.id,
      nickname: req.body.nickname,
      pwd: req.body.pwd,
      fullname: req.body.fullname
    });

    updateUser(userInfos, function(cb){
        console.dir(cb);
        response = {
          type: 'update',
          error: '0',
          data: cb
        };
        return res.end(JSON.stringify(response));
    })
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
    req.logout();

    var response = {
        type: 'logout',
        error: '0',
        data: ''
      };

    return res.end(JSON.stringify(response))
  });
