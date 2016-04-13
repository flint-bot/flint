'use strict';

// Example plugin to extend Flint
//
// Adds the following functionality to Flint that can be used from any other 
// plugin:
// 
// flint.webhook('get', '/myhook', function(req) {
//   console.log(req);
// });

// Define plugin settings
var config = require('../config/webhook.conf');

// Load module packages
var debug = require('debug')('webhook');
var _ = require('lodash');

// Export Plugin
module.exports = function(flint) {

  // function to create a webhook url that is triggered via 'method' at 'path'
  function webhook(method, path, fn) {
    flint.server.route(method, path, function(req, res, next) {
      // Run function
      // In callback, return request object and url to trigger the new webhook
      fn(req, flint.config.baseUrl + path);
      res.send(200);
      next();
    });
  }

  // extend flint with function
  flint.extend('webhook', webhook);
};