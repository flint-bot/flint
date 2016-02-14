var debug = require('debug')('flint');

var async = require('async');
var _ = require('lodash');


module.exports = function (flint) {
  var flint = flint;

  var $this = this;

  $this.sparky = flint.sparky;

  $this._rooms = [];
  $this._webhooks = [];

  // remove all webhooks
  $this.sparky.webhooks.get(function(err, webhooks) {
    if(!err && webhooks.length > 0) {
      webhooks.forEach(function(webhook) {
        $this.sparky.webhook.remove(webhook.id, function(err) {
          if(!err) debug('removed a webhook');
        });
      });
    }
  });

  // room monitor
  setInterval(function() {

    async.series([
      // get rooms that are active
      function(cb) {
        $this.sparky.rooms.get(function(err, rooms) {
          if(!err) $this._rooms = rooms;
          return cb(null);
        });
      },

      // get registered webhooks from api
      function(cb) {
        $this.sparky.webhooks.get(function(err, webhooks) {
          if(!err) $this._webhooks = webhooks;
          return cb(err);
        });
      },

      // remove duplicate hooks for same room
      function(cb){
        var webhooksUniq = _.uniqBy($this._webhooks, 'name');
        var webhooksDupe = _.differenceBy($this._webhooks, webhooksUniq, 'id');
        if(webhooksDupe.length > 0) {
          webhooksDupe.forEach(function(webhook) {
            debug('found a duplicate webhook');
            $this.sparky.webhook.remove(webhook.id, function(err) {
              if(err) debug('encountered an error removing a deplicate webhook');
            });
          });
        }
        // save unique webhooks
        $this._webhooks = webhooksUniq;
        return cb(null);
      },

      // destroy bots that no longer have a room
      function(cb) {
        // get array of active room IDs from active bots
        var botsActive = _.map(_.map(flint._bots, '_room'), 'id');
        // get array of active room IDs
        var roomsActive = _.map($this._rooms, 'id');
        // compare active bots with active room, return difference (zombies)
        var zombies = _.difference(botsActive, roomsActive);
        if(zombies.length > 0) {
          zombies.forEach(function(roomId, index) {
            debug('found a bot that is not associated with a room');
            var zombie = flint._bots.splice(_.findIndex(flint._bots, function(bot) {
              return bot._room.id === roomId;
            }), 1);
            zombie[0].destroy();
          });
        }
        return cb(null);
      },

      // add bots to rooms
      function(cb) {
        // get array of room IDs with active bots
        var botsActive = _.map(_.map(flint._bots, '_room'), 'id');
        // get array of active room IDs
        var roomsActive = _.map($this._rooms, 'id');
        // compare active rooms with active bots, return difference (drones)
        var drones = _.difference(roomsActive, botsActive);
        if(drones.length > 0) {
          drones.forEach(function(roomId) {
            debug('found a room that is not registered');
            flint.botSpawner(roomId, function(err) {
              if(err) {
                debug('encountered an error attempting to register room');
              } else {
                debug('has registered a room');
                $this.sparky.message.send.room(roomId, {
                  text: 'My systems are now online.' 
                }, function() {});
              }
            });
          });
        }
        return cb(null);
      }

    ], function(err) {

      if(err) { 
        debug('encountered error %s in processing current monitor interval', err[err.length - 1]);
      }

    });

  }, flint.monitorInterval );


};
