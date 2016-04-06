'use strict';

var Restify = require('restify');
var debug = require('debug')('flint-serve');
var _ = require('lodash');

// create / configure restify server
var restify = Restify.createServer({
  'name': 'flint'
});
restify.use(Restify.bodyParser({
  'mapParams': true,
  'mapFiles': false,
  'overrideParams': true
}));
restify.use(Restify.queryParser());

module.exports = {

  listen: function(host, port) {
    restify.listen(port, host, function() {
      debug('is now listening on http://%s:%s',host, port);
    });
  },

  route: function(method, resource, fn, cb) {
    method = method.toLowerCase();
    resource = resource.toLowerCase();
    var methods = ['get', 'post', 'put', 'del'];

    // check if method is valid
    if(!_.includes(methods, method)) {
      return cb ? cb(new Error('invalid method %s', method)) : null;
    }

    // add route to restify
    restify[method](resource, function(req, res, next) {
      // execute function
      fn(req, res, next);
    });

    debug('added route for %s:%s', method, resource);
    return cb ? cb(null) : null;
  }

};
