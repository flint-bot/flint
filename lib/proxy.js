var debug = require('debug')('flint');

var validator = require('validator');
var utility = require('./utility');
var request = require('request');
var moment = require('moment');
var _ = require('lodash');

var expire = 60;

// constructor
function Proxy(flint) {
  this.server = flint.server;

  var $this = this;

  // get webhook url
  $this._webhookUrl = flint._webhookUrl;

  // set webhook path
  $this._webhookResource = '/proxy';

  // proxy store
  // [{url: <url>, filename: <filename>, created: <time>}]
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
        request({url: found.url, encoding: null}, function(err, intRes, intBody) {
          if (!err && intRes.statusCode == 200) {
            var contentType = intRes.headers['content-type'];
            res.writeHead(200, {'Content-Type': contentType});
            res.end(intBody);
            next();
          } else {
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

  // expire routes
  setInterval(function() {
    $this._proxies = _.reject($this._proxies, function(proxy) {
      return (moment() > moment(proxy.created).add(expire, 'seconds'));
    });
  }, 15 * 1000);

  // add proxy router
  $this.server.route('get', $this._webhookResource + '/:filename', responder);
}

// create file proxy
Proxy.prototype.create = function(url, filename) {
  var $this = this;

  var externalUrl = $this._webhookUrl + $this._webhookResource + '/' + filename;

  // search for filename in proxy store
  var found = _.find($this._proxies, function(proxy) {
    return proxy.filename === filename;
  });

  // if not found...
  if(!found) {
    $this._proxies.push({url: url, filename: filename, created: moment()});
  } else {
    // overwrite url and reset created timestamp
    found.url = url;
    found.created = moment();
  }
  debug('created a file proxy for: %s', filename);
  return externalUrl;
};

module.exports = Proxy;
