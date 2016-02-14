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

    restify.get(/.*/i, function create(req, res, next) {

      // default responder on get
      res.send('There is nothing to see here... move along...');
      res.send(200);
      return next();

    });
    restify.put(/.*/i, function create(req, res, next) {

      // default responder on put
      res.send('There is nothing to see here... move along...');
      res.send(200);
      return next();

    });
    restify.del(/.*/i, function create(req, res, next) {

      // default responder on del
      res.send('There is nothing to see here... move along...');
      res.send(200);
      return next();

    });

    debug('added a route for %s', resource);
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

  }

};
