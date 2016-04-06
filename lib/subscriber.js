'use strict';

var debug = require('debug')('flint-subscriber');
var _ = require('lodash');

var u = require('./flint-utils');

// constructor
function Subscriber(flint) {
  this.server = flint.server;

  var self = this;

  // get base url
  self._url = flint.url;

  // set base url path
  self._resource = '/s';

  // subscription store
  // [{
  //   name: < name > ,
  //   actions: [{
  //     id: < id > ,
  //     run: < function >
  //   }]
  // }]
  self._subscriptions = [];

  // function to respond to http request
  function responder(req, res, next) {
    // check for route param in request
    if(req.params.route) {
      // search for route name in subscriptions
      var found = _.find(self._subscriptions, function(sub) {
        return sub.name === req.params.route;
      });

      if(found) {
        // if route param is found...
        res.send(200);
        next();
        found.actions.forEach(function(action) {
          // execute actions attached to route
          action.run(req);
        });
      } else {
        // route does not exist
        res.send(500);
        next();
      }

    } else {
      // request invalid
      res.send(500);
      next();
    }
  }

  // add subscriber routers
  self.server.route('get', self._resource + '/:route', responder);
  self.server.route('post', self._resource + '/:route', responder);
  self.server.route('put', self._resource + '/:route', responder);
  self.server.route('del', self._resource + '/:route', responder);

}

// create a subscriber
Subscriber.prototype.create = function(name, cb) {
  var self = this;

  var webhook = self._url + self._resource + '/' + name;

  // search for route name in subscriptions
  var found = _.find(self._subscriptions, function(sub) {
    return sub.name === name;
  });

  // if not found...
  if(!found) {
    debug('created a subscriber named: %s', name);
    self._subscriptions.push({name: name, actions: []});
    return cb ? cb(null, webhook) : webhook;
  } else {
    debug('could not create a subscriber named: %s (already exists)', name);
    var err = new Error('subscriber already exists');
    return cb ? cb(err, webhook) : null;
  }

};

// attach a function to subscriber
Subscriber.prototype.attach = function(name, fn, cb) {
  var self = this;

  // search for route name in subscriptions
  var found = _.find(self._subscriptions, function(sub) {
    return sub.name === name;
  });

  // if found, add
  if(found) {
    debug('attached to subscriber: %s', name);
    var id = u.genRand(8);
    found.actions.push({id: id, run: fn});
    return cb ? cb(null, id) : id;
  } else {
    debug('could not attach to subscriber: %s (does not exist)', name);
    var err = new Error('subscriber does not exist');
    return cb ? cb(err, null) : null;
  }
};

// detach a subscriber by id
Subscriber.prototype.detach = function(id) {
  var self = this;

  _.forEach(self._subscriptions, function(sub) {
    sub.actions = _.reject(sub.actions, ['id', id]);
  });

  debug('detatched id:%s from a subscriber', id);
};

module.exports = Subscriber;
