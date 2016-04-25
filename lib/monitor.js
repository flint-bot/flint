'use strict';

var debug = require('debug')('flint-monitor');
var async = require('async');
var _ = require('lodash');

var validate = require('./spark-validator');

function Monitor(flint) {
  this.flint = flint;
  this.sparky = flint.sparky;
  
  var self = this;

  self._rooms = [];
  self._webhooks = [];
  
  self._roomsToAdd = [];
  self._roomsToRemove = [];
  
  self._iteration = 0;
  
  function start() {
    // start monitor
    self.run(1000);
    
    debug('started');
  }
  
  // remove all existing webhooks and start monitor
  self.sparky.webhooks.get(function(err, webhooks) {
    if(!err && webhooks.length > 0) {
      
      async.eachSeries(webhooks, function(webhook, acb) {
        self.sparky.webhook.remove(webhook.id, function() {
          acb();
        });
      }, start);
      
    } else start();
  });
}

Monitor.prototype.run = function(monitorInterval) {
  var self = this;

  async.series([
    
    // get rooms
    function(cb) {
      // run every 5 seconds
      if(self._iteration % 5 === 0) {
        self.sparky.rooms.get(function(err, rooms) {
          if(err) {
            cb(err);
          } else {

            var roomsToAdd = _.differenceBy(rooms, self._rooms, 'id');
            var roomsToRemove = _.differenceBy(self._rooms, rooms, 'id');
            
            self._roomsToAdd = _.concat(self._roomsToAdd, roomsToAdd);
            self._roomsToRemove = _.concat(self._roomsToRemove, roomsToRemove);
            
            self._rooms = rooms;
            cb(null);
          } 
          
        });
      } else {
        cb(null);
      }
    },
    
    // add bot to room
    function(cb) {
      // run every 5 seconds
      if(self._iteration % 5 === 0) {
        var count = 0;
        
        // if there are rooms to add bots to...
        if(self._roomsToAdd && self._roomsToAdd.length > 0) {
          async.whilst(
            // while...
            function() { return self._roomsToAdd.length > 0; }, 
            
            // do...
            function(acb) {
              var roomToAdd = self._roomsToAdd.shift();
              
              self.flint.spawn(roomToAdd.id, function(err, bot) {
                if(!err) count++;
                acb();
              });
            }, 
            
            // final
            function() {
              if(count > 0) debug('found %s unassociated room(s)', count);
              cb(null);
            });
            
        } else {
          // no rooms need bots
          cb(null);
        }
      } else {
        cb(null);
      }
    },
    
    // remove bot if not attached to room
    function(cb) {
      // run every 15 seconds
      if(self._iteration % 15 === 0) {
        var count = 0;
        
        // if there are rooms that are deleted...
        if(self._roomsToRemove && self._roomsToRemove.length > 0) {
          async.whilst(
            // while...
            function() { return self._roomsToRemove.length > 0; }, 
            
            // do...
            function(acb) {
              var roomToRemove = self._roomsToRemove.shift();
              var bot = _.find(self.flint.bots, function(bot) {
                return bot.myroom.id === roomToRemove.id;
              });
              
              // remove bot if found
              if(bot) {
                self.flint.despawn(bot, function(err) {
                  if(!err) {
                    count++;
                    
                    // update removed rooms
                    self._rooms = _.filter(self._rooms, function(room) {
                      return bot.myroom.id !== room.id;
                    });
                  }
                  acb();
                });
              } else {
                acb();
              }
            }, 
            
            // final
            function() {
              if(count > 0) debug('found %s unassociated bot(s)', count);
              cb(null);
            });
            
        } else {
          // no rooms are dead
          cb(null);
        }
      } else {
        cb(null);
      }
    },
    
    // run a room rollcall
    function(cb) {
      // run every 600 seconds
      if(self._iteration % 600 === 0) {
        async.eachSeries(self.flint.bots, function(bot, acb) {
          bot.rollcall(function(err) {
            acb(null, err);
          });
        }, function(err, failed) {
          if(failed instanceof Array && failed.length > 0) {
            debug('could not audit users in %s room(s)', failed.length);
          }
          cb(null);
        });
      } else {
        cb(null);
      }
        
    },
    
    // exit rooms that are empty
    function(cb) {
      // run every 120 seconds
      if(self._iteration % 120 === 0) {
        var count = 0;
        
        async.eachSeries(self.flint.bots, function(bot, acb) {
          if(bot.companions.length === 0) {
            // exit
            bot.exit(function(err) {
              if(!err) count++;
              acb();
            });
          } else {
            acb();
          }
     
        }, function() {
          if(count > 0) {
            debug('removed %s bot(s) from empty room(s)', count);
          }
          cb(null);
        }); 
      } else {
        cb(null);
      }
    }
    
  ], function(err, results) {
    if(err) {
      debug('received error in current monitor interval: %s', err.message || 'undefined');
    }
    
    self._iteration++;
    self._iteration = self._iteration % 999999;
    
    // if monitorInterval parameter passed to function
    if(typeof monitorInterval === 'number') {
      // restart after interval
      setTimeout(function() {
        self.run(monitorInterval);
      }, monitorInterval);
    }
  });

};

module.exports = Monitor;
