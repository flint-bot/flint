'use strict';

var EventEmitter = require('events').EventEmitter;
var validator = require('node-sparky/validator');
var sequence = require('when/sequence');
var Stream = require("stream");
var moment = require('moment');
var _debug = require('debug')('bot');
var util = require('util');
var when = require('when');
var poll = require('when/poll');
var _ = require('lodash');

var u = require('./utils');

// format makrdown type
function markdownFormat(str) {
  // if string...
  if(str && typeof str === 'string') {

    // process characters that do not render visibly in markdown
    str = str.replace(/\<(?!@)/g, '&lt;');
    str = str.split('').reverse().join('').replace(/\>(?!.*@\<)/g, ';tg&').split('').reverse().join('');

    return str;
  }

  // else return empty
  else {
    return '';
  }
}

// format html type (place holder for now, does nothing)
function htmlFormat(str) {
  return str;
}

/**
 * Creates a Bot instance that is then attached to a Spark Room.
 *
 * @constructor
 * @param {Object} flint - The flint object this Bot spawns under.
 * @property {string} id - Bot UUID
 * @property {boolean} active - Bot active state
 * @property {object} person - Bot Person Object
 * @property {string} email - Bot email
 * @property {object} team - Bot team object
 * @property {object} room - Bot room object
 * @property {object} membership - Bot membership object
 * @property {boolean} isLocked - If bot is locked
 * @property {boolean} isModerator - If bot is a moderator
 * @property {boolean} isGroup - If bot is in Group Room
 * @property {boolean} isDirect - If bot is in 1:1/Direct Room
 * @property {string} isDirectTo - Recipient Email if bot is in 1:1/Direct Room
 * @property {boolean} isTeam - If bot is in Team Room
 * @property {date} lastActivity - Last bot activity
 */
function Bot(flint) {
  EventEmitter.call(this);

  this.id = u.genUUID64();

  this.flint = flint;
  this.options = flint.options;

  this.debug = function(message) {
    message = util.format.apply(null, Array.prototype.slice.call(arguments));

    if(typeof flint.debugger === 'function') {
      flint.debugger(message, this.id);
    } else {
      _debug(message);
    }
  };

  //randomize distribution of when audit event should take place for this bot instance...
  this.auditTrigger = Math.floor((Math.random() * this.flint.auditDelay)) + 1;

  this.spark = this.flint.spark;
  this.batchDelay = this.flint.batchDelay;
  this.active = false;
  this.room = {};
  this.team = {};
  this.person = this.flint.person;
  this.membership = {};
  this.memberships = [];
  this.email = this.flint.email;
  this.isLocked = false;
  this.isModerator = false;
  this.isGroup = false;
  this.isDirect = false;
  this.isTeam = false;
  this.lastActivity = moment().utc().toDate();

  this.on('error', err => {
    if(err) {
      this.debug(err.stack);
    }
  });
}
util.inherits(Bot, EventEmitter);

/**
 * Stop Bot.
 *
 * @function
 * @private
 * @returns {Boolean}
 *
 * @example
 * bot.stop();
 */
Bot.prototype.stop = function() {
  // if not stopped...
  if(this.active) {

    this.emit('stop', this);

    this.active = false;
    return true;
  } else {
    return false;
  }
};

/**
 * Start Bot.
 *
 * @function
 * @private
 * @returns {Boolean}
 *
 * @example
 * bot.start();
 */
Bot.prototype.start = function() {
  // if not started...
  if(!this.active) {

    this.emit('start', this);

    this.active = true;
    return true;
  } else {
    return false;
  }
};

/**
 * Instructs Bot to exit from room.
 *
 * @function
 * @returns {Promise.<Boolean>}
 *
 * @example
 * bot.exit();
 */
Bot.prototype.exit = function() {
  if(!this.isGroup) {
    return when(false);
  } else {

    return this.spark.membershipRemove(this.membership.id)
      .then(() => {
        return when(true);
      })
      .catch(() => {
        return when(false);
      });
  }
};

/**
 * Instructs Bot to add person(s) to room.
 *
 * @function
 * @param {(String|Array)} email(s) - Email Address (or Array of Email Addresses) of Person(s) to add to room.
 * @param {Boolean} [moderator]
 * Add as moderator.
 * @returns {Promise.<Array>} Array of emails added
 * @example
 * // add one person to room by email
 * bot.add('john@test.com');
 * @example
 * // add one person as moderator to room by email
 * bot.add('john@test.com', true)
 *   .catch(function(err) {
 *     // log error if unsuccessful
 *     console.log(err.message);
 *   });
 * @example
 * // add 3 people to room by email
 * bot.add(['john@test.com', 'jane@test.com', 'bill@test.com']);
 */
Bot.prototype.add = function(email, asModerator) {

  // validate to boolean
  asModerator = (typeof asModerator === 'boolean' && asModerator);

  // function to add membership by email address to this room
  var add = (e, m) => {
    if(validator.isEmail(e)) {
      return this.spark.membershipAdd(this.room.id, e, m)
        .then(membership => {
          this.debug('Added "%s" to room "%s"', e, this.room.title);
          return when(e);
        })
        .catch(err => when(false))
        .delay(this.batchDelay);
    } else {
      return when(false);
    }
  };

  if(!this.isGroup) {
    return when.reject(new Error('can not add person to a 1:1 room'));
  } else {
    if(this.isLocked && !this.isModerator) {
      return when.reject(new Error('room is locked and bot is not moderator'));
    }

    if(!this.isLocked && asModerator) {
      return when.reject(new Error('can not add moderator to a unlocked room'));
    }

    // if passed as array, create batch process
    if(email instanceof Array && email.length > 1) {

      // create batch
      var batch = _.map(email, e => {
        e = _.toLower(e);
        return () => add(e, asModerator).catch(err => this.debug(err.stack));
      });

      // run batch
      return sequence(batch).then(batchResult => {
        batchResult = _.compact(batchResult);

        // if array of resulting emails is not empty...
        if(batchResult instanceof Array && batchResult.length > 0) {
          return batchResult;
        } else {
          return when.reject('invalid email(s) or email not specified');
        }
      });
    }

    // else, add using email
     else if(typeof email === 'string' || (email instanceof Array && email.length === 1)) {
      if(email instanceof Array) {
        email = _.toLower(email[0]);
      }

      return add(email, asModerator).then(result => {
        // if resulting email is not false
        if(result) {
          return when([result]);
        } else {
          return when.reject('invalid email(s) or email not specified');
        }
      });
    }

    else {
      return when.reject(new Error('invalid parameter passed to bot.add()'));
    }
  }
};

/**
 * Instructs Bot to remove person from room.
 *
 * @function
 * @param {(String|Array)} email(s) - Email Address (or Array of Email Addresses) of Person(s) to remove from room.
 * @returns {Promise.<Array>} Array of emails removed
 *
 * @example
 * // remove one person to room by email
 * bot.remove('john@test.com');
 *
 * @example
 * // remove 3 people from room by email
 * bot.remove(['john@test.com', 'jane@test.com', 'bill@test.com']);
 */

 // needs to be fixed to pass through errors, or pass through list of users removed.
Bot.prototype.remove = function(email) {

  // remove membership by email address from this room
  var remove = e => {
    if(validator.isEmail(e) && _.includes(_.map(this.memberships, 'personEmail'), e)) {
      return this.spark.membershipByRoomByEmail(this.room.id, e)
        .then(membership => this.spark.membershipRemove(membership.id))
        .then(() => {
          this.debug('Removed "%s" from room "%s"', e, this.room.title);
          return when(e);
        })
        .catch(err => when(false))
        .delay(this.batchDelay);
    } else {
      return when(false);
    }
  };

  if(!this.isGroup) {
    return when.reject(new Error('can not remove person from a 1:1 room'));
  } else {
    if(this.isLocked && !this.isModerator) {
      return when.reject(new Error('room is locked and bot is not moderator'));
    }

    // if passed as array, create batch process
    if(email instanceof Array && email.length > 1) {

      // create batch
      var batch = _.map(email, e => {
        return () => remove(e).catch(err => this.debug(err.stack));
      });

      // run batch
      return sequence(batch).then(batchResult => {
        batchResult = _.compact(batchResult);

        // if array of resulting emails is not empty...
        if(batchResult instanceof Array && batchResult.length > 0) {
          return batchResult;
        } else {
          return when.reject('invalid email(s) or email not specified');
        }
      });
    }

    // else, remove using email
    else if(typeof email === 'string' || (email instanceof Array && email.length === 1)) {
      if(email instanceof Array) {
        email = email[0];
      }

      return remove(email).then(result => {
        // if resulting email is not false
        if(result) {
          return when([result]);
        } else {
          return when.reject('invalid email(s) or email not specified');
        }
      });
    }

    else {
      return when.reject(new Error('invalid parameter passed to bot.remove()'));
    }
  }
};

/**
 * Get membership object from room using email.
 *
 * @function
 * @private
 * @param {String} email - Email of person to retrieve membership object of.
 * @returns {Promise.<Membership>}
 *
 * @example
 * bot.getMembership('john@test.com')
 *   .then(function(membership) {
 *     console.log('john@test.com is moderator: %s', membership.isModerator);
 *   });
 */
Bot.prototype.getMembership = function(email) {

  // check if person passed as email address
  if(validator.isEmail(email)) {

    // check for person in room
    var person = _.find(this.memberships, membership => {
      return (_.toLower(membership.personEmail) === _.toLower(email));
    });

    if(person) {
      return when(person);
    } else {
      return when.reject(new Error('Person not found in room'));
    }

  } else {
    return when.reject(new Error('Not a valid email'));
  }
};

/**
 * Get room moderators.
 *
 * @function
 * @returns {Promise.<Array>}
 *
 * @example
 * bot.getModerators()
 *   .then(function(moderators) {
 *     console.log(moderators);
 *   });
 */
Bot.prototype.getModerators = function() {
  return when(_.filter(this.memberships, membership => {
    return (membership.isModerator);
  }));
};

/**
 * Create new room with people by email
 *
 * @function
 * @param {String} name - Name of room.
 * @param {Array} emails - Emails of people to add to room.
 * @returns {Promise.<Bot>}
 */
Bot.prototype.newRoom = function(name, emails) {
  var newRoom = {};
  var newRoomBot = {};

  // add room
  return this.spark.roomAdd(name)

   // create room
    .then(room => {

      var count = 0;

      // find bot function
      var bot = () => {
        // get bot for new room
        return _.find(this.flint.bots, bot => {
          return (bot.room.id === room.id);
        });
      };

      // validate results of find bot function
      var isReady = (result) => {
        count++;
        // cap wait time at 150 * 100 ms
        if(count > 150) {
          return true;
        } else {
          return (typeof result !== 'undefined');
        }
      };

      // poll find bot every 100ms and return fulfilled promise when result function is true
      return poll(bot, 100, isReady)
        .then(bot => {
          if(!bot) {
            return when.reject(new Error('Flint timed out when creating a new room'));
          } else {
            newRoomBot = bot;
            newRoom = room;
            return when(bot);
          }
        });
    })

    // add users to room
    .then(bot => {
      return bot.add(emails)
        .catch(() => {
          return when(true);
        });
    })

    // return new Bot
    .then(() => when(newRoomBot))

    // if error, attempt to remove room before rejecting
    .catch(err => {

      if(newRoom && newRoom.id) {
        this.spark.roomRemove(newRoom.id)
          .catch(() => {});
      }

      return when.reject(err);
    });
};

/**
 * Create new Team Room
 *
 * @function
 * @param {String} name - Name of room.
 * @param {Array} emails - Emails of people to add to room.
 * @returns {Promise.<Bot>}
 */
Bot.prototype.newTeamRoom = function(name, emails) {
  // new room
  var newTeamRoom = {};
  var newTeamRoomBot = {};

  if(this.isTeam) {
    var teamId = this.team.id;
  } else {
    return when.reject(new Error('This room is not part of a spark team'));
  }

  // add room
  return this.spark.teamRoomAdd(teamId, name)

    // create room
    .then(room => {

      var count = 0;

      // find bot function
      var bot = () => {
        // get bot for new room
        return _.find(this.flint.bots, bot => {
          return (bot.room.id === room.id);
        });
      };

      // validate results of find bot function
      var isReady = (result) => {
        count++;
        if(count > 150) {
          return true;
        } else {
          return (typeof result !== 'undefined');
        }
      };

      // poll find bot every 100ms and return fulfilled promise when result function is true
      return poll(bot, 100, isReady)
        .then(bot => {
          if(!bot) {
            return when.reject(new Error('Flint timed out when creating a new room'));
          } else {
            newTeamRoomBot = bot;
            newTeamRoom = room;
            return when(bot);
          }
        });
    })

    // add users to room
    .then(bot => {
      return bot.add(emails)
        .catch(() => {
          return when(true);
        });
    })

    // return new Bot
    .then(() => when(newTeamRoomBot))

    // if error, attempt to remove room before rejecting
    .catch(err => {

      if(newTeamRoom && newTeamRoom.id) {
        this.spark.roomRemove(newTeamRoom.id)
          .catch(() => {
            // ignore remove room errors
          });
      }

      return when.reject(err);
    });
};

/**
 * Enable Room Moderation.Enable.
 *
 * @function
 * @returns {Promise.<Bot>}
 *
 * @example
 * bot.moderateRoom()
 *   .then(function(err) {
 *     console.log(err.message)
 *   });
 */
Bot.prototype.moderateRoom = function() {
  // validate flint is not a bot account
  if(this.flint.isBotAccount) {
    return when.reject(new Error('Bot accounts can not change moderation status in rooms'));
  }

  // set moderator
  if(!this.isGroup || this.isTeam) {
    return when.reject(new Error('Can not change moderation status on 1:1 or Team room'));
  }

  else if(this.isLocked) {
    return when.reject(new Error('Room is already moderated'));
  }

  else {
    return this.spark.membershipSetModerator(this.membership.id)
      .then(() => when(this));
  }
};

/**
 * Disable Room Moderation.
 *
 * @function
 * @returns {Promise.<Bot>}
 *
 * @example
 * bot.unmoderateRoom()
 *   .then(function(err) {
 *     console.log(err.message)
 *   });
 */
Bot.prototype.unmoderateRoom = function() {

  // validate flint is not a bot account
  if(this.flint.isBotAccount) {
    return when.reject(new Error('Bot accounts can not change moderator status in rooms'));
  }

  if(!this.isGroup || this.isTeam) {
    return when.reject(new Error('Can not change moderation status on 1:1 or Team room'));
  }

  else if(!this.isLocked) {
    return when.reject(new Error('Room is not moderated'));
  }

  else if(this.isLocked && !this.isModerator) {
    return when.reject(new Error('Flint is not a moderator in this room'));
  }

  else {
    return this.getModerators()
      .then(moderators => {

        // create batch
        var batch = _.map(moderators, m => {
          return () => this.moderatorClear(m.personEmail).delay(this.batchDelay);
        });

        // run batch
        return sequence(batch);

      })

      // remove bot as moderator
      .then(() => this.spark.membershipClearModerator(this.membership.id))
      .then(() => when(this));
  }
};

/**
 * Assign Moderator in Room
 *
 * @function
 * @param {(String|Array)} email(s) - Email Address (or Array of Email Addresses) of Person(s) to assign as moderator.
 * @returns {Promise.<Bot>}
 *
 * @example
 * bot.moderatorSet('john@test.com')
 *   .then(function(err) {
 *     console.log(err.message)
 *   });
 */
Bot.prototype.moderatorSet = function(email) {

  // function to set moderator by email address to this room
  var set = e => {
    return this.getMembership(e)
      .then(membership => this.spark.membershipSetModerator(membership.id))
      .then(membership => when(this));
  };

  // validate bot is not a bot account
  if(this.flint.isBotAccount) {
    return when.reject(new Error('Bot accounts can not change moderator status in rooms'));
  }

  if(!this.isGroup || this.isTeam) {
    return when.reject(new Error('Can not change moderation status on 1:1 or Team room'));
  }

  else if(!this.isLocked) {
    return when.reject(new Error('Room is not moderated'));
  }

  else if(this.isLocked && !this.isModerator) {
    return when.reject(new Error('Flint is not moderator in this room'));
  }

  else {
    if(email instanceof Array) {

      // create batch
      var batch = _.map(email, e => {
        return () => set(e).delay(this.batchDelay);
      });

      // run batch
      return sequence(batch).then(() => when(this));

    }

    else if(typeof email === 'string') {
      return set(email).then(() => when(this));
    }

    else {
      return when.reject(new Error('Invalid parameter passed to moderatorSet'));
    }
  }
};

/**
 * Unassign Moderator in Room
 *
 * @function
 * @param {(String|Array)} email(s) - Email Address (or Array of Email Addresses) of Person(s) to unassign as moderator.
 * @returns {Promise.<Bot>}
 *
 * @example
 * bot.moderatorClear('john@test.com')
 *   .then(function(err) {
 *     console.log(err.message)
 *   });
 */
Bot.prototype.moderatorClear = function(email) {

  // function to set moderator by email address to this room
  var clear = e => {
    return this.getMembership(e)
      .then(membership => this.spark.membershipClearModerator(membership.id))
      .then(membership => when(this));
  };

  // validate bot is not a bot account
  if(this.flint.isBotAccount) {
    return when.reject(new Error('Bot accounts can not change moderator status in rooms'));
  }

  if(!this.isGroup || this.isTeam) {
    return when.reject(new Error('Can not change moderation status on 1:1 or Team room'));
  }

  else if(!this.isLocked) {
    return when.reject(new Error('Room is not moderated'));
  }

  else if(this.isLocked && !this.isModerator) {
    return when.reject(new Error('Flint is not a moderator in this room'));
  }

  else {
    if(email instanceof Array) {

      // create batch
      var batch = _.map(email, e => {
        return () => clear(e).delay(this.batchDelay);
      });

      // run batch
      return sequence(batch).then(() => when(this));

    }

    else if(typeof email === 'string') {
      return clear(email).then(() => when(this));
    }

    else {
      return when.reject(new Error('Invalid parameter passed to moderatorClear'));
    }
  }
};

/**
 * Remove a room and all memberships.
 *
 * @function
 * @returns {Promise.<Boolean>}
 *
 * @example
 * flint.hears('/implode', function(bot, trigger) {
 *   bot.implode();
 * });
 */
Bot.prototype.implode = function() {

  // validate room is group
  if(!this.isGroup || this.isTeam) {
    return when.reject(new Error('Can not implode a 1:1 or Team room'));
  }

  // validate bot is moderator if room is locked
  if(this.isLocked && !this.isModerator) {
    return when.reject(new Error('Flint is not moderator in this room'));
  }

  return this.spark.roomRemove(this.room.id)
    .then(() => when(true))
    .catch(() => when(false));
};

/**
 * Send text with optional file to room.
 *
 * @function
 * @param {String} [format=text] - Set message format. Valid options are 'text' or 'markdown'.
 * @param {String|Object} message - Message to send to room. This can be a simple string, or a object for advanced use.
 * @returns {Promise.<Message>}
 *
 * @example
 * // Simple example
 * flint.hears('/hello', function(bot, trigger) {
 *   bot.say('hello');
 * });
 *
 * @example
 * // Simple example to send message and file
 * flint.hears('/file', function(bot, trigger) {
 *   bot.say({text: 'Here is your file!', file: 'http://myurl/file.doc'});
 * });
 *
 * @example
 * // Markdown Method 1 - Define markdown as default
 * flint.messageFormat = 'markdown';
 * flint.hears('/hello', function(bot, trigger) {
 *   bot.say('**hello**, How are you today?');
 * });
 *
 * @example
 * // Markdown Method 2 - Define message format as part of argument string
 * flint.hears('/hello', function(bot, trigger) {
 *   bot.say('markdown', '**hello**, How are you today?');
 * });
 *
 * @example
 * // Mardown Method 3 - Use an object (use this method of bot.say() when needing to send a file in the same message as markdown text.
 * flint.hears('/hello', function(bot, trigger) {
 *   bot.say({markdown: '*Hello <@personEmail:' + trigger.personEmail + '|' + trigger.personDisplayName + '>*'});
 * });
 */
Bot.prototype.say = function(format, message) {

  // set default format type
  format = this.flint.messageFormat;

  // parse function args
  var args = Array.prototype.slice.call(arguments);

  // determine if a format is defined in arguments
  // first and second arguments should be string type
  // first argument should be one of the valid formats
  var formatDefined = (args.length > 1 && typeof args[0] === 'string' && typeof args[1] === 'string' && _.includes(['text', 'markdown', 'html'], _.toLower(args[0])));

  // if format defined in function arguments, overide default
  if(formatDefined) {
    format = _.toLower(args.shift());
  }

  // if message is object (raw)
  if(typeof args[0] === 'object') {
    return this.spark.messageSendRoom(this.room.id, args[0]);
  }

  // if message is string
  else if(typeof args[0] === 'string') {
    // apply string formatters to remaining arguments
    message = util.format.apply(null, args);

    // if markdown, apply markdown formatter to contructed message string
    message = format === 'markdown' ? markdownFormat(message) : message;

    // if html, apply html formatter to contructed message string
    message = format === 'html' ? htmlFormat(message) : message;

    // construct message object
    var messageObj = {};
    messageObj[format] = message;

    // send constructed message object to room
    return this.spark.messageSendRoom(this.room.id, messageObj);
  }

  else {
    return when.reject(new Error('Invalid function arguments'));
  }
};


/**
 * Send text with optional file in a direct message. This sends a message to a 1:1 room with the user (creates 1:1, if one does not already exist)
 *
 * @function
 * @param {String} email - Email of person to send Direct Message.
 * @param {String} [format=text] - Set message format. Valid options are 'text' or 'markdown'.
 * @param {String|Object} message - Message to send to room. This can be a simple string, or a object for advanced use.
 * @returns {Promise.<Message>}
 *
 * @example
 * // Simple example
 * flint.hears('/dm', function(bot, trigger) {
 *   bot.dm('someone@domain.com', 'hello');
 * });
 *
 * @example
 * // Simple example to send message and file
 * flint.hears('/dm', function(bot, trigger) {
 *   bot.dm('someone@domain.com', {text: 'Here is your file!', file: 'http://myurl/file.doc'});
 * });
 *
 * @example
 * // Markdown Method 1 - Define markdown as default
 * flint.messageFormat = 'markdown';
 * flint.hears('/dm', function(bot, trigger) {
 *   bot.dm('someone@domain.com', '**hello**, How are you today?');
 * });
 *
 * @example
 * // Markdown Method 2 - Define message format as part of argument string
 * flint.hears('/dm', function(bot, trigger) {
 *   bot.dm('someone@domain.com', 'markdown', '**hello**, How are you today?');
 * });
 *
 * @example
 * // Mardown Method 3 - Use an object (use this method of bot.dm() when needing to send a file in the same message as markdown text.
 * flint.hears('/dm', function(bot, trigger) {
 *   bot.dm('someone@domain.com', {markdown: '*Hello <@personEmail:' + trigger.personEmail + '|' + trigger.personDisplayName + '>*'});
 * });
 */
Bot.prototype.dm = function(email, format, message) {
  // parse function args
  var args = Array.prototype.slice.call(arguments);

  message = args.length > 0 ? args.pop() : false;
  email = args.length > 0 ? args.shift() : false;
  format = args.length > 0 && _.includes(['markdown', 'html', 'text'], format) ? args.shift() : this.flint.messageFormat || 'text';

  if(email && validator.isEmail(email) && (typeof message === 'string' || typeof message === 'object')) {

    if(typeof message === 'object') {
      return this.spark.messageSendPerson(email, message);
    }

    if(typeof message === 'string') {
      var msgObj = {};

      // if markdown, apply markdown formatter to contructed message string
      message = format === 'markdown' ? markdownFormat(message) : message;

      // if html, apply html formatter to contructed message string
      message = format === 'html' ? htmlFormat(message) : message;

      msgObj[format] = message;
      return this.spark.messageSendPerson(email, msgObj);
    }
  }

  else {
    return when.reject(new Error('Invalid function arguments'));
  }
};

/**
 * Upload a file to a room using a Readable Stream
 *
 * @function
 * @param {String} filename - File name used when uploading to room
 * @param {Stream.Readable} stream - Stream Readable
 * @returns {Promise.<Message>}
 *
 * @example
 * flint.hears('/file', function(bot, trigger) {
 *
 *   // define filename used when uploading to room
 *   var filename = 'test.png';
 *
 *   // create readable stream
 *   var stream = fs.createReadStream('/my/file/test.png');
 *
 *   bot.uploadStream(filename, stream);
 * });
 */
Bot.prototype.uploadStream = function(filename, stream) {
  if(typeof filename === 'string' && stream instanceof Stream) {
    return this.spark.messageStreamRoom(this.room.id, { filename: filename, stream: stream });
  } else {
    return when.reject(new Error('Invalid stream'));
  }
};

/**
 * Upload a file to room.
 *
 * @function
 * @param {String} filepath - File Path to upload
 * @returns {Promise.<Message>}
 *
 * @example
 * flint.hears('/file', function(bot, trigger) {
 *   bot.upload('test.png');
 * });
 */
Bot.prototype.upload = function(filepath) {
  if(typeof filepath === 'string') {
    return this.spark.upload(this.room.id, filepath);
  } else {
    return when.reject(new Error('Invalid file'));
  }
};

/**
 * Remove Message By Id.
 *
 * @function
 * @param {String} messageId
 * @returns {Promise.<Message>}
 */
Bot.prototype.censor = function(messageId) {
  return this.flint.getMessage(messageId)
    .then(message => {

      // if bot can delete a message...
      if((this.isLocked && this.isModerator && !this.flint.isBotAccount) || message.personId === this.person.id) {
        return this.spark.messageRemove(messageId);
      }

      else {
        return when.reject(new Error('Can not remove this message'));
      }
    });
};

/**
 * Set Title of Room.
 *
 * @function
 * @param {String} title
 * @returns {Promise.<Room>}
 *
 * @example
 * bot.roomRename('My Renamed Room')
 *   .then(function(err) {
 *     console.log(err.message)
 *   });
 */
Bot.prototype.roomRename = function(title) {
  if(!this.isGroup) {
    return when.reject(new Error('Can not set title of 1:1 room'));
  }

  else if(this.isLocked && !this.isModerator) {
    return when.reject(new Error('Flint is not moderator in this room'));
  }

  else {
    return this.spark.roomRename(this.room.id, title);
  }
};

/**
 * Get messages from room. Returned data has newest message at bottom.
 *
 * @function
 * @param {Integer} count
 * @returns {Promise.<Array>}
 *
 * @example
 * bot.getMessages(5).then(function(messages) {
 *   messages.forEach(function(message) {
 *     // display message text
 *     if(message.text) {
 *       console.log(message.text);
 *     }
 *   });
 * });
 */
Bot.prototype.getMessages = function(count) {
  if(this.flint.isBotAccount) {
    return when.reject(new Error('Bot accounts can not read room messages'));
  } else {
    count = typeof count !== 'number' && parseInt(count, 10) ? parseInt(count, 10) : count;
    return this.spark.messagesGet(this.room.id, count)
      .then(messages => when.map(_.reverse(messages), message => this.flint.parseMessage(message)));
  }

};

/**
 * Store key/value data.
 *
 * @function
 * @param {String} key - Key under id object
 * @param {(String|Number|Boolean|Array|Object)} value - Value of key
 * @returns {(Promise.<String>|Promise.<Number>|Promise.<Boolean>|Promise.<Array>|Promise.<Object>)}
 */
Bot.prototype.store = null;

/**
 * Recall value of data stored by 'key'.
 *
 * @function
 * @param {String} [key] - Key under id object (optional). If key is not passed, all keys for id are returned as an object.
 * @returns {(Promise.<String>|Promise.<Number>|Promise.<Boolean>|Promise.<Array>|Promise.<Object>)}
 */
Bot.prototype.recall = null;

/**
 * Forget a key or entire store.
 *
 * @function
 * @param {String} [key] - Key under id object (optional). If key is not passed, id and all children are removed.
 * @returns {(Promise.<String>|Promise.<Number>|Promise.<Boolean>|Promise.<Array>|Promise.<Object>)}
 */
Bot.prototype.forget = null;

module.exports = Bot;
