'use strict';

var EventEmitter = require('events').EventEmitter;
var validator = require('validator');
var moment = require('moment');
var debug = require('debug')('flint-bot');
var async = require('async');
var util = require('util');
var _ = require('lodash');

var u = require('./flint-utils');

// command delay
var _iterationDelay = 2000;

function Bot(flint) {
  this.flint = flint;
  this.sparky = this.flint.sparky;
  this.server = this.flint.server;

  var self = this;
  
  // enable event emitter
  EventEmitter.call(self);
  
  // instance id
  self.id = u.genRand(24);

  // state of bot
  self.active = false;
  
  // objects of bot in room
  self.myroom = {};
  self.myperson = {};
  self.mymembership = {};
  self.mywebhook = {};
  
  self.myemail = '';
  
  // emails of users in room
  self.companions = [];
  
  // last activity
  self.lastActivity = moment();

  // key:value object memory for bot instance
  self._memory = {};

  // array of repeater tasks for bot
  self._repeater = [];

  // array of scheduler tasks for bot
  self._scheduler = [];
  
  // handle internal events
  self.on('start', function() {
    // start recurring tasks
    self.repeaterStart();
    self.schedulerStart();
    
    // do initial rollcall
    self.rollcall();
    
    // optionally announce bot in room
    if(flint.config.announceMessage) self.say(flint.config.announceMessage);
  });
  self.on('stop', function() {
    // stop recurring tasks
    self.repeaterStop();
    self.schedulerStop();
  });
}
util.inherits(Bot, EventEmitter);

//
// BOT UTILITY
//

// Stop polling this bot instance
Bot.prototype.stop = function() {
  var self = this;

  // if not stopped...
  if(self.active) {
    // change bot state
    self.active = false;
    
    // emit event
    self.emit('stop');
  }
  return self;
};

// Start polling this bot instance
Bot.prototype.start = function() {
  var self = this;

  // if not started...
  if(!self.active) {
    // change bot state
    self.active = true;
    
    // emit event
    self.emit('start');
  }
  return self;
};

// is bot moderated? 
Bot.prototype.isModerated = function(cb) {
  var self = this;
  self.sparky.room.get(self.myroom.id, function(err, room) {
    if(!err) {
      cb(room[0].isLocked);
    } else {
      cb(null);
    }
  });
};

// exit from room
Bot.prototype.exit = function(cb) {
  var self = this;
  
  self.stop();
  
  self.sparky.membership.remove(self.mymembership.id, cb);
};


//
// ADMIN
//

// Add person to room
Bot.prototype.add = function(email, cb) {
  var self = this;

  if(email instanceof Array) {
    async.eachSeries(email, function(e, acb){
      self.add(e);
      // delay between
      setTimeout(function() { acb() }, _iterationDelay);
    });
    cb ? cb(null, email) : null;
  } else {
      if(validator.isEmail(email)) {
        self.sparky.membership.add(self.myroom.id, email, cb);
      } else {
        cb ? cb(new Error('not a valid email'), null) : null;
      }
  }
  return self;
};

// Remove a person from room
Bot.prototype.remove = function(email, cb) {
  var self = this;

  if(email instanceof Array) {
    async.eachSeries(email, function(e, acb){
      self.remove(e);
      // delay between
      setTimeout(function() { acb() }, _iterationDelay);
    });
    cb ? cb(null, email) : null;
  } else {
    if(validator.isEmail(email)) {
      self.sparky.membership.byRoomByEmail(self.myroom.id, email, function(err, membership) {
        if(err) {
          cb ? cb(err, null) : null;
        } else {
          self.sparky.membership.remove(membership[0].id, cb);
        }
      });
    } else {
      cb ? cb(new Error('not a valid email'), null) : null;
    }
  }
  return self;
};

// Get person object from email or personId
Bot.prototype.inspect = function(person, cb) {
  var self = this;

  // check if person passed as email address
  if(validator.isEmail(person)) {
    self.sparky.person.byEmail(person, function(err, personId) {
    if(err) {
      cb ? cb(err, null) : null;
    } else {
      cb ? cb(null, personId[0]) : null;
    }
    });
    return self;
  } 

  // check if person passed as personID
  else {
    self.sparky.person.get(person, function(err, personId) {
    if(err) {
      cb ? cb(err, null) : null;
    } else {
      cb ? cb(null, personId[0]) : null;
    }
    });
    return self;
  }
};

// Get email addresses of all people in room
Bot.prototype.rollcall = function(cb) {
  var self = this;
  
  // populate array with self while spark call is ran
  self.companions.push(self.myemail);

  self.sparky.memberships.byRoom(self.myroom.id, function(err, memberships) {
    if(err) {
      cb ? cb(err, null) : null;
    } else {
      var emails = _.map(memberships, function(membership) {
        return _.toLower(membership.personEmail);
      });
      // populate companions with everyone else in room
      self.companions = _.difference(emails, [ self.myemail ]);
      cb ? cb(null, emails) : null;
    }
  });
  return self;
};

// Create new room named 'name' with bot and people by email
Bot.prototype.room = function(name, emails, cb) {
  var self = this;
  self.sparky.room.add(name, function(err, room) {
    if(err) {
      cb ? cb(err, null) : null;
    } else {
      async.eachSeries(emails, function(email, acb) {
        self.sparky.membership.add(room[0].id, email, function() {
          // delay between
          setTimeout(function() { acb() }, _iterationDelay);
        });
      }, function() {
        cb ? cb(null, room) : null;
      });
    }
  });
  return self;
};

// Kill room
Bot.prototype.implode = function(cb) {
  var self = this;
  
  // stop bot
  self.stop();

  var companions = [];
  
  // remove room
  async.series([
    
    // get room companions
    function(acb) {
      self.rollcall(function(err, emails) {
        if(!err) companions = _.difference(emails, [ self.myemail ]);
        acb(err);
      });
    },
    
    // remove companions from room
    function(acb) {
      var deleteRoomDelay = (_iterationDelay * companions.length) + 10000;
      
      self.remove(companions, function(err) {
        if(err) {
          acb(err);
        } else {
          // delay after removing
          setTimeout(function() { acb(err) }, deleteRoomDelay);
        }
      });
    },
    
    // verify room has onlybot
    function(acb) {
      self.rollcall(function(err, emails) {
        acb(err || emails.length !== 1 || emails[0] !== self.myemail);
      });
    },
    
    // remove room
    function(acb) {
      self.sparky.room.remove(self.myroom.id, function(err) {
        acb(err);
      });
    }
  
  ], function(err) {
    if(err) {
      debug('error removing imploded room');
      
      cb ? cb(new Error('error removing imploded room')) : null;
    } else {
      debug('removed imploded room');
      
      cb ? cb(null) : null;
    }
    
  });
  
};

//
// MESSAGE
//

// Send text with optional file to room
Bot.prototype.say = function(message, cb) {
  var self = this;

  // parse args
  var args = Array.prototype.slice.call(arguments);
  cb = typeof args[args.length - 1] === 'function' ? cb = args.pop() : null;
  message = args[0];

  // if message is object
  if(typeof message === 'object') {
    self.sparky.message.send.room(self.myroom.id, message, cb);
  }

  // if message is string
  else if(typeof message === 'string') {
    message = util.format.apply(this, args);
    self.sparky.message.send.room(self.myroom.id, { text: message }, cb);
  }

  // else...
  else {
    cb ? cb(new Error('invalid formated message'), null) : null;
  }
  return self;
};

// Send a file to room
Bot.prototype.file = function(url, cb) {
  var self = this;

  // validate url
  if(validator.isURL(url)) {
    self.sparky.message.send.room(self.myroom.id, { file: url }, cb);
  } 

  // url is invalid
  else {
    cb ? cb(new Error('invalid formated url'), null) : null;
  }

  return self;
};

// Send text with optional file in a direct message
Bot.prototype.dm = function(email, message, cb) {
  var self = this;
  
  // parse args
  var args = Array.prototype.slice.call(arguments);
  email = args.shift();
  cb = typeof args[args.length - 1] === 'function' ? cb = args.pop() : null;
  message = args[0];

  // if message is object
  if(validator.isEmail(email) && typeof message === 'object') {
    self.sparky.message.send.person(email, message, cb);
  }

  // if message is string
  else if(validator.isEmail(email) && typeof message === 'string') {
    message = util.format.apply(this, args);
    self.sparky.message.send.person(email, { text: message }, cb);
  }

  // else...
  else {
    cb ? cb(new Error('invalid formated message'), null) : null;
  }
  return self;
};

// get messages from room
Bot.prototype.getMessages = function(count, cb) {
  var self = this;

  // get messages
  self.sparky.messages.get(self.myroom.id, count, function(err, messages) {
    if(err || messages.length === 0) {
      debug('was not able to capture any messages from room');
      
      cb(err, null);
    } else {
      debug('captured %s existing messages in room', messages.length);

      // parse messages
      async.eachSeries(messages, function(message, acb) {
        self.flint.parseMessage(message, function(parsedMessage) {
          message = parsedMessage;
          acb();
        });
      }, function() {
        cb(null, messages);
      });
    }
  });
  return self;
};

//
// REPEATER
//

// Start the processes that checks the repeater task queue every 5 seconds.
Bot.prototype.repeaterStart = function() {
  var self = this;

  // monitor repeater for tasks
  self._repeatInterval = setInterval(function() {

    if(self._repeater.length > 0) {

      _.forEach(self._repeater, function(repeat) {
        // if now > lastran + interval
        if(moment() > moment(repeat.lastRan).add(repeat.interval, 'ms')) {
          debug('running a repeated task');
          
          //run
          repeat.action(self);

          // set last ran to current time;
          repeat.lastRan = moment();
        }
      });
    }

  }, 5 * 1000); // check for repeated tasks every 5000ms (5sec)
};

// Stop the polling of repeater tasks
Bot.prototype.repeaterStop = function() {
  var self = this;

  if(self._repeatInterval) clearInterval(self._repeatInterval);
};

// Remove all repeater tasks
Bot.prototype.repeaterReset = function() {
  var self = this;

  self.repeaterStop();
  self._repeater = [];
  self.repeaterStart();
};

// Define an action to run every 'interval' seconds
Bot.prototype.repeat = function(action, interval) {
  var self = this;
  interval = interval;

  self._repeater.push({
    action: action,
    interval: interval,
    lastRan: moment()
  });
  debug('added an task to a repeater task queue');
  return self;
};

//
// SCHEDULER
//

// Start the processes that checks the scheduler task queue every 1 minute.
Bot.prototype.schedulerStart = function() {
  var self = this;

  // monitor scheduler for tasks
  self._schedulerInterval = setInterval(function() {
    
    var now = moment();

    if(self._scheduler.length > 0) {

      _.forEach(self._scheduler, function(schedule) {
        // if now > when
        if(moment(schedule.when) < now) {
          debug('running a scheduled task');

          // run
          schedule.action(self);
        }
      });

      // filter tasks that occur after now and replace _scheduler
      self._scheduler = _.filter(self._scheduler, function(schedule) {
        return moment(schedule.when) > now;
      });

    }

  }, 60 * 1000); // check for scheduled tasks every 60s
};

// Stop the polling of scheduler tasks
Bot.prototype.schedulerStop = function() {
  var self = this;

  if(self._schedulerInterval) clearInterval(self._schedulerInterval);
};

// Remove all scheduler tasks
Bot.prototype.schedulerReset = function() {
  var self = this;

  self.schedulerStop();
  self._scheduler = [];
  self.schedulerStart();
};

// Define an action to run once at a specific date/time
Bot.prototype.schedule = function(action, when, cb) {
  var self = this;

  // validate and normalize 'when' to moment object
  if(moment(when).isValid() && moment(when) > moment()) {
    when = moment(when);
    self._scheduler.push({
      action: action,
      when: when,
    });
    debug('added an task to a scheduler task queue');
    cb ? cb(null) : null;
  } else {
    debug('got an invalid date/time format when trying to add a scheduled task');
    cb ? cb(new Error('invalid date/time format')) : null;
  }
  return self;
};

//
// MEMORY
//

// Store namespace/key/value data
Bot.prototype.store = function(namespace, key, value) {
  var self = this;

  if(!self._memory[namespace]) {
    self._memory[namespace] = [];
  }
  
  if(!self._memory[namespace][key]) {
    self._memory[namespace][key] = [];
  }
  
  if(value) {
    self._memory[namespace][key] = value;
  }
  
};

// Recall value stored in namespace/key
Bot.prototype.recall = function(namespace, key) {
  var self = this;
  
  if(namespace && key && self._memory[namespace] && self._memory[namespace][key]) {
    return self._memory[namespace][key];
  }
  
  else if(namespace && self._memory[namespace]) {
    return self._memory[namespace];
  } 
  
  else {
    return false;
  }
  
};

// forget all values stored in namespace/key
Bot.prototype.forget = function(namespace, key) {
  var self = this;
  
  if(namespace && key) {
    self._memory[namespace][key] = null;
  }
  
  else if(namespace) {
    self._memory[namespace] = null;
  }
  
  else {
    self._memory = {};
  }
};

module.exports = Bot;
