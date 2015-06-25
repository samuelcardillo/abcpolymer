/*
Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

(function(document) {
  'use strict';
  // Grab a reference to our auto-binding template
  // and give it some initial binding values
  // Learn more about auto-binding templates at http://goo.gl/Dx1u2g
  var app = document.querySelector('#app');

  app.displayInstalledToast = function() {
    document.querySelector('#caching-complete').show();
  };

  // Listen for template bound event to know when bindings
  // have resolved and content has been stamped to the page
  app.addEventListener('dom-change', function() {
    console.log('Our app is ready to rock!');
    var ironAjax = document.querySelector("iron-ajax");

    document.addEventListener('auth-form-sent',function(data){
      var data = data.detail;
      console.dir(data);

      if(data.type === "login") {
        ironAjax.url = "/api/login";
        ironAjax.method = "POST"
        ironAjax.body = 'nickname=' + data.formInputs.nickname + "&pwd=" + data.formInputs.pwd;
        ironAjax.generateRequest();
      } else if(data.type === "register") {

        var formInputs = 'nickname=' + data.formInputs.nickname + "&";
        formInputs = formInputs + "pwd=" + data.formInputs.pwd + "&";
        formInputs = formInputs + "fullname=" + data.formInputs.fullname;

        ironAjax.url = "/api/register";
        ironAjax.method = "POST"
        ironAjax.body = formInputs;
        ironAjax.generateRequest();

      } else if(data.type === "update") {

        var formInputs = 'nickname=' + data.formInputs.nickname + "&";
        formInputs = formInputs + "pwd=" + data.formInputs.pwd + "&";
        formInputs = formInputs + "fullname=" + data.formInputs.fullname;

        ironAjax.url = "/api/update";
        ironAjax.method = "POST"
        ironAjax.body = formInputs;
        ironAjax.generateRequest();

      }
    })

    app._logOutuser = function(){
      ironAjax.url = "/api/logout";
      ironAjax.method = "GET"
      ironAjax.generateRequest();
    }
    app.logged = false;
  });

  app._handleResponse = function(data){
    console.dir(data.detail.response);
    var response = data.detail.response;

    if(response["error"] != 0) return console.log(response["data"]);

    switch(response["type"]) {
      case "register":
        page('/login');
        break;
      case "login":
        app.logged = response["data"];
        page('/');
        break;
      case "logout":
        app.logged = false;
        page('/');
        break;
      case "update":
        app.logged = response["data"];
        page('/profile');
        break;
    }
  }

  // See https://github.com/Polymer/polymer/issues/1381
  window.addEventListener('WebComponentsReady', function() {
    // imports are loaded and elements have been registered
  });

  // Close drawer after menu item is selected if drawerPanel is narrow
  app.onMenuSelect = function() {
    var drawerPanel = document.querySelector('#paperDrawerPanel');
    if (drawerPanel.narrow) {
      drawerPanel.closeDrawer();
    }
  };

})(document);
