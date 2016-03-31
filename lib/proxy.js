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

  var self = this;

  // get base url
  self._url = flint._url;

  // set base url path
  self._resource = '/p';

  // proxy store
  // [{url: <url>, filename: <filename>, created: <time>}]
  self._proxies = [];

  // function to respond to http request
  function responder(req, res, next) {
    // check for filename param in request
    if(req.params.filename) {
      // search for external url in proxy store
      var found = _.find(self._proxies, function(proxy) {
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
    self._proxies = _.reject(self._proxies, function(proxy) {
      return (moment() > moment(proxy.created).add(expire, 'seconds'));
    });
  }, 15 * 1000);

  // add proxy router
  self.server.route('get', self._resource + '/:filename', responder);
}

// create file proxy
Proxy.prototype.create = function(url, filename) {
  var self = this;

  var externalUrl = self._url + self._resource + '/' + filename;

  // search for filename in proxy store
  var found = _.find(self._proxies, function(proxy) {
    return proxy.filename === filename;
  });

  // if not found...
  if(!found) {
    self._proxies.push({url: url, filename: filename, created: moment()});
  } else {
    // overwrite url and reset created timestamp
    found.url = url;
    found.created = moment();
  }
  debug('created a file proxy for: %s', filename);
  return externalUrl;
};

module.exports = Proxy;
