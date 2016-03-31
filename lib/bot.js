var debug = require('debug')('flint');

var validator = require('validator');
var utility = require('./utility');
var moment = require('moment');
var async = require('async');
var util = require('util');
var _ = require('lodash');

// command delay
var _delay = 1000;

// constructor
function Bot(flint) {
  this.sparky = flint.sparky;
  this.server = flint.server;
  this.subscriber = flint.subscriber;

  var self = this;

  // room object of bot location
  self._room = {};

  // person object of bot controller
  self._person = {};

  // membership object of bot in room
  self._membership = {};

  // key:value object memory for bot instance
  self._memory = {};

  // array of subscriptions for bot
  self._subscriptions = [];

  // array of repeater tasks for bot
  self._repeater = [];

  // array of scheduler tasks for bot
  self._scheduler = [];

  // start polling the repeater task queue
  self.repeaterStart();

  // start polling the scheduler task queue
  self.schedulerStart();
}

//
// ADMIN
//

// Add person to room
Bot.prototype.add = function(email, cb) {
  var self = this;

  if(email instanceof Array) {
    async.each(email, function(e, acb){
      self.add(e);
      // delay between
      setTimeout(function() { acb() }, _delay);
    });
    cb ? cb(null, email) : null;
  } else {
      if(validator.isEmail(email)) {
        self.sparky.membership.add(self._room.id, email, cb);
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
    async.each(email, function(e, acb){
      self.remove(e);
      // delay between
      setTimeout(function() { acb() }, _delay);
    });
    cb ? cb(null, email) : null;
  } else {
    if(validator.isEmail(email)) {
      self.sparky.membership.byRoomByEmail(self._room.id, email, function(err, membership) {
        if(err) {
          cb ? cb(err, null) : null;
        } else {
          if(membership && membership[0].id) self.sparky.membership.remove(membership[0].id, cb);
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

// Detroy this bot instance
Bot.prototype.destroy = function() {
  var self = this;

  self.repeaterStop();
  self.schedulerStop();
  delete this;
  debug('has destroyed the bot');
};

// Get email addresses of all people in room
Bot.prototype.rollcall = function(cb) {
  var self = this;

  self.sparky.memberships.byRoom(self._room.id, function(err, memberships) {
    if(err) {
      cb ? cb(err, null) : null;
    } else {
      var emails = _.map(memberships, function(membership) {
        return _.toLower(membership.personEmail);
      });
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
      async.each(email, function(e, acb){
        self.sparky.membership.add(room[0].id, email);
        // delay between
        setTimeout(function() { acb() }, _delay);
      });
      cb ? cb(null, room) : null;
    }
  });
  return self;
};

// Kill room
Bot.prototype.implode = function(cb) {
  var self = this;

  self.rollcall(function(err, emails) {
    if(!err) {
      // remove bot from list of people in room
      var emails = _.difference(emails, [ self._person.emails[0] ]);
      // remove all from room
      self.remove(emails, function(err, email) {
        // delay before removing room
        setTimeout(function() {
          self.sparky.room.remove(self._room.id, function(err, room) {
            cb ? cb(err, room) : null;
          });
        }, (_delay * emails.length * 2) + 10000;
      });
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
  message = args.shift();
  if(typeof args[0] === 'function') {
    cb = args.shift();
  } else if(typeof args[args.length - 1] === 'function') {
    cb = args.pop();
  } else {
    cb = null;
  }

  // if message is object
  if(typeof message === 'object') {
    self.sparky.message.send.room(self._room.id, message, cb);
  }

  // if message is string
  else if(typeof message === 'string') {
    // if optional args are found, assume formatter
    if(args.length > 0) {
      args.unshift(message);
      message = util.format.apply(this, args);
    }
    self.sparky.message.send.room(self._room.id, { text: message }, cb);
  }
  
  // message is invalid
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
    self.sparky.message.send.room(self._room.id, { file: url }, cb);
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
  message = args.shift();
  if(typeof args[0] === 'function') {
    cb = args.shift();
  } else if(typeof args[args.length - 1] === 'function') {
    cb = args.pop();
  } else {
    cb = null;
  }

  // if message is object
  if(typeof message === 'object') {
    self.sparky.message.send.person(email, message, cb);
  }

  // if message is string
  else if(typeof message === 'string') {
    // if optional args are found, assume formatter
    if(args.length > 0) {
      args.unshift(message);
      message = util.format.apply(this, args);
    }
    self.sparky.message.send.person(email, { text: message }, cb);
  }
  
  // message is invalid
  else {
    cb ? cb(new Error('invalid formated message'), null) : null;
  }

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

      self._repeater.forEach(function(repeat) {
        if(repeat.lastRan < moment().subtract(repeat.interval, 'ms')) {
          repeat.action(self);
          debug('ran a repeated task');
          // set last ran to current time;
          repeat.lastRan = moment();
        }
      });
    }

  }, 5000); // check for repeated tasks every 5000ms (5sec)
  debug('started polling a new repeater task queue');
};

// Stop the polling of repeater tasks
Bot.prototype.repeaterStop = function() {
  var self = this;

  if(self._repeatInterval) clearInterval(self._repeatInterval);
  debug('stopped polling a repeater task queue');
};

// Remove all repeater tasks
Bot.prototype.repeaterReset = function() {
  var self = this;

  self.repeaterStop();
  self._repeater = [];
  self.repeaterStart();
  debug('reset a repeater');
};

// Define an action to run every 'interval' seconds
Bot.prototype.repeat = function(action, interval) {
  var self = this;
  interval = interval;

  self._repeater.push({
    action: action,
    interval: interval * 1000,
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

    if(self._scheduler.length > 0) {

      var now = moment();

      self._scheduler.forEach(function(schedule) {
        if(now > schedule.when) {
          schedule.action(self);
          debug('ran a scheduled task');
        }
      });

      // filter tasks that occur after now and replace _scheduler
      self._scheduler = _.filter(self._scheduler, function(schedule) {
        return now < schedule.when;
      });

    }

  }, 60000); // check for scheduled tasks every 60000ms (60sec)
  debug('started polling a new scheduler task queue');
};

// Stop the polling of scheduler tasks
Bot.prototype.schedulerStop = function() {
  var self = this;

  if(self._schedulerInterval) clearInterval(self._schedulerInterval);
  debug('stopped polling a scheduled task queue');
};

// Remove all scheduler tasks
Bot.prototype.schedulerReset = function() {
  var self = this;

  self.schedulerStop();
  self._scheduler = [];
  self.schedulerStart();
  debug('reset a scheduler');
};

// Define an action to run once at a specific date/time
Bot.prototype.schedule = function(action, when, cb) {
  var self = this;

  // normalize 'when' to date type
  when = when.isValid() ? when : moment(when);

  // validate 'when' and that it occurs in future
  if(when.isValid() && when > moment()) {
    self._scheduler.push({
      action: action,
      when: when,
    });
    debug('added an task to a scheduler task queue');
    cb ? cb(null) : null;
  }
  else {
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

//
// External Hooks
//

// subscribes bot to a published resource
Bot.prototype.subscribe = function(name, fn, cb) {
  var self = this;

  // search for name in bot object's subscriptions
  var found = _.find(self._subscriptions, function(sub) {
    return sub.name === name;
  });

  if(!found) {
    self.subscriber.attach(name, fn, function(err, id) {
      if(!err) {
        debug('attached subscriber to room: %s', self._room.title);
        // track subsciption id on bot object
        self._subscriptions.push({name: name, id: id});
      } else {
        debug('could not attach subscriber to room: %s (subscriber does not exist)', self._room.title);
      }
      cb ? cb(err) : null;
    });
  } else {
    debug('could not attach subscriber to room: %s (subscription already exists)', self._room.title);
    var err = new Error('name already exists');
    cb ? cb(err) : null;
  }
};

// unsubscribes bot from a published resource
Bot.prototype.unsubscribe = function(name) {
  var self = this;

  // get subscription by name
  var subscription = _.find(self._subscriptions, ['name', name]);

  // if subscribed
  if(subscription) {
    debug('detatched subscriber from room: %s', self._room.title);
    // detach bot from subscriber
    self.subscriber.detach(subscription.id);
  } else {
    debug('could not detach subscriber from room: %s (subscription does not exist)', self._room.title);
  }

  // remove subscription reference from room
  self._subscriptions = _.reject(self._subscriptions, ['name', name]);

};

module.exports = Bot;
