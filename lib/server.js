var debug = require('debug')('flint');

var Restify = require('restify');
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

var routes = [];

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

    // check if route already exists
    if(_.includes(routes, { method: method, resource: resource })) {
      return cb ? cb(new Error('duplicate route %s', resource)) : null;
    }

    // add resource to routes
    routes.push({ method: method, resource: resource });

    // add route to restify
    restify[method](resource, function create(req, res, next) {
      // execute function
      fn(req, res, next);
    });

    debug('added route for %s:%s', method, resource);
    return cb ? cb(null) : null;
  }

};
