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

  route: function(resource, flint) {
    debug('added a route for %s', resource);

    // process posts to resource
    restify.post(resource, function create(req, res, next) {
      if(!req.params.data) {
        debug('received an invalid request');
        // send 500 Error
        res.send(500);
      } else {
        // send 200 OK to close the session
        res.send(200);
        // execute function with resource and request
        flint._processWebhook(resource, req);
      }
      return next();
    });

    // default responder on get
    restify.get(/.*/i, function create(req, res, next) {
      res.send('There is nothing to see here... move along...');
      res.send(404);
      return next();
    });

    // default responder on post
    restify.post(/.*/i, function create(req, res, next) {
      res.send('There is nothing to see here... move along...');
      res.send(404);
      return next();
    });

    // default responder on put
    restify.put(/.*/i, function create(req, res, next) {
      res.send('There is nothing to see here... move along...');
      res.send(404);
      return next();
    });

    // default responder on del
    restify.del(/.*/i, function create(req, res, next) {
      res.send('There is nothing to see here... move along...');
      res.send(404);
      return next();
    });

  }

};
