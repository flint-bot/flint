var debug = require('debug')('flint');

var Restify = require('restify');

// create / configure restify server
var restify = Restify.createServer({
  'name': 'flint'
});
restify.use(Restify.bodyParser({
  'mapParams': true,
  'mapFiles': false,
  'overrideParams': true
}));

module.exports = {

  listen: function(host, port) {
    restify.listen(port, host, function() {
      debug('is now listening on http://%s:%s',host, port);
    });
  },

  route: function(resource, fn) {
    debug('added a route for %s', resource);

    // process posts to resource
    restify.post(resource, function create(req, res, next) {
      // send 200 OK to close the session
      res.send(200);
      // execute function with resource and request
      fn(req);
      return next();
    });
  }

};
