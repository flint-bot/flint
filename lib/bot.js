var debug = require('debug')('flint');

var validator = require('validator');
var moment = require('moment');
var async = require('async');
var _ = require('lodash');


// constructor
function Bot(sparky) {
  this.sparky = sparky;

  var $this = this;

  // room object of bot location
  $this._room = {};

  // person object of bot controller
  $this._person = {}

  // membership object of bot in room
  $this._membership = {};

  // webhook object of room that bot is in
  $this._webhook = {};

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

// Add person to room. The 'email' can be either a string or array (or array
// of arrays).
//
// callback(error, membership)
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
      if(validator.isEmail(email)) {
        $this.sparky.membership.add($this._room.id, email, cb);
      } else {
        cb ? cb(new Error('not a valid email'), null) : null;
      }
  }
  return $this;
};

// Remove a person from room. The 'email' can be either a string or array (or
// array of arrays).
//
// callback(error)
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
    $this.sparky.membership.byRoomByEmail($this._room.id, email,
    function(err, membership) {
      if(err) {
        cb ? cb(err, null) : null;
      } else {
        if(validator.isEmail(email)) {
          $this.sparky.membership.remove(membership[0].id, cb);
        } else {
          cb ? cb(new Error('not a valid email'), null) : null;
        }
      }
    });
  }
  return $this;
};

// Detroy this bot instance
Bot.prototype.destroy = function() {
  var $this = this;

  $this.repeaterStop();
  $this.schedulerStop();
  delete $this;
  debug('has destroyed the bot');
};

// Get email addresses of all people in room.
Bot.prototype.getPeople = function(cb) {
  var $this = this;

  $this.sparky.memberships.byRoom($this._room.id, function(err, memberships) {
    if(err) {
      cb ? cb(err, null) : null;
    } else {
      cb ? cb(null, _.map(memberships, 'personEmail')) : null;
    }
  });
  return $this;
};

// Create new room named 'name' with bot and people by email from 'emails'
// array. Does not include person calling this command.
Bot.prototype.room = function(name, emails, cb) {
  var $this = this;

  $this.sparky.room.add(name, function(err, room) {
    if(err) {
       cb ? cb(err, null) : null
    } else {
      emails.forEach(function(email) {
        if(validator.isEmail(email)) {
          $this.sparky.membership.add(room[0].id, email);
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
      var people = _.difference(people, [ $this._person.emails[0] ]);
      // remove all from room
      async.each(people, function(person, callback) {
        $this.remove(person, function(err) {
          callback(err);
        });
      }, function(err) {
        if(!err) $this.remove($this._person.emails[0]);
        cb ? cb(err, people) : null;
      });
    }
  });
};

//
// SAY
//

// Send text or file to room
Bot.prototype.say = function(message, cb) {
  var $this = this;

  // if message is object
  if(typeof message === 'object') {
    $this.sparky.message.send.room($this._room.id, message, cb);
  }

  // if message os string
  if(typeof message === 'string') {
    $this.sparky.message.send.room($this._room.id, { text: message }, cb);
  }
  return $this;
}

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
  var interval = interval;

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
  var when = when.isValid() ? when : moment(when);

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

// Store key/value data
Bot.prototype.remember = function(key, value) {
  $this = this;

  if(!$this._memory[key]) {
    $this._memory[key] = [];
  }
  $this._memory[key].push(value);

};

// Recall value stored in key
Bot.prototype.recall = function(key) {
  $this = this;

  return $this._memory[key] ? $this._memory[key] : null;
};

module.exports = Bot;
