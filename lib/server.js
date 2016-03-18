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
      // execute function
      fn(req, res, next);
    });
  }

};
