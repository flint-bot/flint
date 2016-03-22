var debug = require('debug')('flint');

var validator = require('validator');
var utility = require('./utility');
var request = require('request');
var _ = require('lodash');

// constructor
function Proxy(flint) {
  this.server = flint.server;

  var $this = this;

  // get webhook url
  $this._webhookUrl = flint._webhookUrl;

  // set webhook path
  $this._webhookResource = '/proxy';

  // proxy store
  // [{internalUrl: <url>, filename: <filename>}]
  $this._proxies = [];

  // function to respond to http request
  function responder(req, res, next) {
    // check for filename param in request
    if(req.params.filename) {
      // search for external url in proxy store
      var found = _.find($this._proxies, function(proxy) {
        return proxy.filename === req.params.filename;
      });

      if(found) {
        // request internal url
        request({url: found.internalUrl, encoding: null}, function(err, intRes, intBody) {
          if (!err && intRes.statusCode == 200) {
            var contentType = intRes.headers['content-type'];
            res.writeHead(200, {'Content-Type': contentType});
            res.end(intBody);
            next();
          } 
          else {
            // error getting internal url
            res.send(500);
            next();
          }
        });

      } else {
        // filename does not exist
        res.send(500);
        next();
      }

    } else {
      // request invalid
      res.send(500);
      next();
    }
  }

  // add proxy router
  $this.server.route('get', $this._webhookResource + '/:filename', responder);

}

// create file proxy
Proxy.prototype.create = function(internalUrl, filename, cb) {
  var $this = this;

  var externalUrl = $this._webhookUrl + $this._webhookResource + '/' + filename;

  // search for filename in proxy store
  var found = _.find($this._proxies, function(proxy) {
    return proxy.filename === filename;
  });

  // if not found...
  if(!found) {
    debug('created a file proxy for: %s', filename);
    $this._proxies.push({internalUrl: internalUrl, filename: filename});
    return cb ? cb(null, externalUrl) : externalUrl;
  } else {
    debug('could not create a proxy for: %s (already exists)', filename);
    var err = new Error('proxy already exists');
    return cb ? cb(err, externalUrl) : null;
  }

};

module.exports = Proxy;
