var debug = require('debug')('flint');

var validator = require('validator');
var moment = require('moment');
var async = require('async');
var util = require('util');
var _ = require('lodash');

// command delay
var _delay = 1000;

// constructor
function Bot(sparky) {
  this.sparky = sparky;

  var $this = this;

  // room object of bot location
  $this._room = {};

  // person object of bot controller
  $this._person = {};

  // membership object of bot in room
  $this._membership = {};

  // key:value object memory for bot instance
  $this._memory = {};

  // aray of repeater tasks for bot
  $this._repeater = [];

  // aray of scheduler tasks for bot
  $this._scheduler = [];

  // start polling the repeater task queue
  $this.repeaterStart();

  // start polling the scheduler task queue
  $this.schedulerStart();
}

//
// ADMIN
//

// Add person to room
Bot.prototype.add = function(email, cb) {
  var $this = this;

  if(Array.isArray(email)) {
    email.forEach(function(e) {
      if(validator.isEmail(e)) {
        $this.add(e);
      }
    });
    cb ? cb(null, email) : null;
  } else {
    setTimeout(function() {
      if(validator.isEmail(email)) {
        $this.sparky.membership.add($this._room.id, email, cb);
      } else {
        cb ? cb(new Error('not a valid email'), null) : null;
      }
    }, _delay);
  }
  return $this;
};

// Remove a person from room
Bot.prototype.remove = function(email, cb) {
  var $this = this;

  if(Array.isArray(email)) {
    email.forEach(function(e) {
      if(validator.isEmail(e)) {
        $this.remove(e);
      }
    });
    cb ? cb(null, email) : null;
  } else {
    setTimeout(function() {
      if(validator.isEmail(email)) {
        $this.sparky.membership.byRoomByEmail($this._room.id, email, function(err, membership) {
          if(err) {
            cb ? cb(err, null) : null;
          } else {
            $this.sparky.membership.remove(membership[0].id, cb);
          }
        });
      } else {
        cb ? cb(new Error('not a valid email'), null) : null;
      }
    }, _delay);
  }
  return $this;
};

// Get person object from email or personId
Bot.prototype.inspect = function(person, cb) {
  var $this = this;

  // check if person passed as email address
  if(validator.isEmail(person)) {
    $this.sparky.person.byEmail(person, function(err, personId) {
    if(err) {
      cb ? cb(err, null) : null;
    } else {
      cb ? cb(null, personId[0]) : null;
    }
    });
    return $this;
  } 

  // check if person passed as personID
  else {
    $this.sparky.person.get(person, function(err, personId) {
    if(err) {
      cb ? cb(err, null) : null;
    } else {
      cb ? cb(null, personId[0]) : null;
    }
    });
    return $this;
  }
};
// Alias deprecated command
Bot.prototype.getPerson = function(person, cb) {
  this.inspect(person, cb);
};

// Detroy this bot instance
Bot.prototype.destroy = function() {
  var $this = this;

  $this.repeaterStop();
  $this.schedulerStop();
  delete this;
  debug('has destroyed the bot');
};

// Get email addresses of all people in room
Bot.prototype.rollcall = function(cb) {
  var $this = this;

  $this.sparky.memberships.byRoom($this._room.id, function(err, memberships) {
    if(err) {
      cb ? cb(err, null) : null;
    } else {
      var emails = _.map(memberships, function(membership) {
        if(membership.personEmail || membership.personEmail !== '' || membership.personEmail != undefined) {
          return _.toLower(membership.personEmail);
        }
      });
      cb ? cb(null, emails) : null;
    }
  });
  return $this;
};
// Alias deprecated command
Bot.prototype.getPeople = function(cb) {
  this.rollcall(cb);
};

// Create new room named 'name' with bot and people by email
Bot.prototype.room = function(name, emails, cb) {
  var $this = this;

  $this.sparky.room.add(name, function(err, room) {
    if(err) {
       cb ? cb(err, null) : null;
    } else {
      async.each(emails, function(email, callback) {
        if(validator.isEmail(email)) {
          $this.sparky.membership.add(room[0].id, email, function(err) {
            setTimeout(function() {
              callback(err);
            }, _delay);
          });
        }
      });
      cb ? cb(null, room) : null;
    }
  });
  return $this;
};

// Kill room
Bot.prototype.implode = function(cb) {
  var $this = this;

  $this.getPeople(function(err, people) {
    if(!err) {
      // remove bot from list of people in room
      people = _.difference(people, [ $this._person.emails[0] ]);
      // remove all from room
      async.each(people, function(person, callback) {
        $this.remove(person, function(err) {
          setTimeout(function() {
            callback(err);
          }, _delay);
        });
      }, function(err) {
        if(!err) {
          // delay 60 seconds before removing room
          setTimeout(function() {
            $this.sparky.room.remove($this._room.id, cb);
          }, 60000);
        } else {
          cb ? cb(err, people) : null;
        }
      });
    }
  });
};

//
// MESSAGE
//

// Send text with optional file to room
Bot.prototype.say = function(message, cb) {
  var $this = this;

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
    $this.sparky.message.send.room($this._room.id, message, cb);
  }

  // if message is string
  else if(typeof message === 'string') {
    // if optional args are found, assume formatter
    if(args.length > 0) {
      args.unshift(message);
      message = util.format.apply(this, args);
    }
    $this.sparky.message.send.room($this._room.id, { text: message }, cb);
  }
  
  // message is invalid
  else {
    cb ? cb(new Error('invalid formated message'), null) : null;
  }

  return $this;
};

// Send a file to room
Bot.prototype.file = function(url, cb) {
  var $this = this;

  // validate url
  if(validator.isURL(url)) {
    $this.sparky.message.send.room($this._room.id, { file: url }, cb);
  } 

  // url is invalid
  else {
    cb ? cb(new Error('invalid formated url'), null) : null;
  }

  return $this;
};

// Send text with optional file in a direct message
Bot.prototype.dm = function(email, message, cb) {
  var $this = this;

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
    $this.sparky.message.send.person(email, message, cb);
  }

  // if message is string
  else if(typeof message === 'string') {
    // if optional args are found, assume formatter
    if(args.length > 0) {
      args.unshift(message);
      message = util.format.apply(this, args);
    }
    $this.sparky.message.send.person(email, { text: message }, cb);
  }
  
  // message is invalid
  else {
    cb ? cb(new Error('invalid formated message'), null) : null;
  }

  return $this;
};

//
// REPEATER
//

// Start the processes that checks the repeater task queue every 5 seconds.
Bot.prototype.repeaterStart = function() {
  var $this = this;

  // monitor repeater for tasks
  $this._repeatInterval = setInterval(function() {

    if($this._repeater.length > 0) {

      $this._repeater.forEach(function(repeat) {
        if(repeat.lastRan < moment().subtract(repeat.interval, 'ms')) {
          repeat.action($this);
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
  var $this = this;

  if($this._repeatInterval) clearInterval($this._repeatInterval);
  debug('stopped polling a repeater task queue');
};

// Remove all repeater tasks
Bot.prototype.repeaterReset = function() {
  var $this = this;

  $this.repeaterStop();
  $this._repeater = [];
  $this.repeaterStart();
  debug('reset a repeater');
};

// Define an action to run every 'interval' seconds
Bot.prototype.repeat = function(action, interval) {
  var $this = this;
  interval = interval;

  $this._repeater.push({
    action: action,
    interval: interval * 1000,
    lastRan: moment()
  });
  debug('added an task to a repeater task queue');
  return $this;
};

//
// SCHEDULER
//

// Start the processes that checks the scheduler task queue every 1 minute.
Bot.prototype.schedulerStart = function() {
  var $this = this;

  // monitor scheduler for tasks
  $this._schedulerInterval = setInterval(function() {

    if($this._scheduler.length > 0) {

      var now = moment();

      $this._scheduler.forEach(function(schedule) {
        if(now > schedule.when) {
          schedule.action($this);
          debug('ran a scheduled task');
        }
      });

      // filter tasks that occur after now and replace _scheduler
      $this._scheduler = _.filter($this._scheduler, function(schedule) {
        return now < schedule.when;
      });

    }

  }, 60000); // check for scheduled tasks every 60000ms (60sec)
  debug('started polling a new scheduler task queue');
};

// Stop the polling of scheduler tasks
Bot.prototype.schedulerStop = function() {
  var $this = this;

  if($this._schedulerInterval) clearInterval($this._schedulerInterval);
  debug('stopped polling a scheduled task queue');
};

// Remove all scheduler tasks
Bot.prototype.schedulerReset = function() {
  var $this = this;

  $this.schedulerStop();
  $this._scheduler = [];
  $this.schedulerStart();
  debug('reset a scheduler');
};

// Define an action to run once at a specific date/time
Bot.prototype.schedule = function(action, when, cb) {
  var $this = this;

  // normalize 'when' to date type
  when = when.isValid() ? when : moment(when);

  // validate 'when' and that it occurs in future
  if(when.isValid() && when > moment()) {
    $this._scheduler.push({
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
  return $this;
};

//
// MEMORY
//

// Store namespace/key/value data
Bot.prototype.remember = function(namespace, key, value) {
  var $this = this;

  if(!$this._memory[namespace]) {
    $this._memory[namespace] = [];
  }
  
  if(!$this._memory[namespace][key]) {
    $this._memory[namespace][key] = [];
  }
  
  if(value) {
    $this._memory[namespace][key] = value;
  }
  
};

// Recall value stored in namespace/key
Bot.prototype.recall = function(namespace, key) {
  var $this = this;
  
  if(namespace && key && $this._memory[namespace] && $this._memory[namespace][key]) {
    return $this._memory[namespace][key];
  }
  
  else if(namespace && $this._memory[namespace]) {
    return $this._memory[namespace];
  } 
  
  else {
    return false;
  }
  
};

// forget all values stored in namespace/key
Bot.prototype.forget = function(namespace, key) {
  var $this = this;
  
  if(namespace && key) {
    $this._memory[namespace][key] = null;
  }
  
  else if(namespace) {
    $this._memory[namespace] = null;
  }
  
  else {
    $this._memory = {};
  }
};

module.exports = Bot;
