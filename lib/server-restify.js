'use strict';

var Restify = require('restify');
var debug = require('debug')('flint-serve');
var _ = require('lodash');

function Server() {
  this.server = Restify.createServer();
  this.server.use(Restify.bodyParser({
    'mapParams': true,
    'mapFiles': false,
    'overrideParams': true
  }));
  this.server.use(Restify.queryParser());
}

Server.prototype.listen = function(port, host, cb) {
  var self = this;

  self.server.listen(port, host, function() {
    self.url = 'http://' + host + ':' + port;
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
