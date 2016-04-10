'use strict';

var S2mServer = require('socket2me-wrapper');
var debug = require('debug')('flint-serve');
var _ = require('lodash');

function Server() {
  this.server = S2mServer.createServer();
}

Server.prototype.listen = function(port, host, cb) {
  var self = this;

  self.server.listen(port, host, function() {
    self.url = self.server.url;
    cb();
  });
};

Server.prototype.route = function(method, resource, fn, cb) {
  var self = this;

  method = method.toLowerCase();
  resource = resource.toLowerCase();
  var methods = ['get', 'post', 'put', 'del'];

  // check if method is valid
  if(!_.includes(methods, method)) {
    return cb ? cb(new Error('invalid method %s', method)) : null;
  }

  // add route
  self.server[method](resource, function(req, res, next) {
    // execute function
    fn(req, res, next);
  });

  debug('added route for %s:%s', method, resource);
  return cb ? cb(null) : null;
};

module.exports = Server;