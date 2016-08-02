/**
 * @file Defines Flint Bot Class
 * @author Nicholas Marus <nmarus@gmail.com>
 * @license LGPL-3.0
 */

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
 * @property {boolean} isGroup - If bot is Group
 * @property {boolean} isDirect - If bot is 1:1/Direct
 * @property {boolean} isTeam - if bot is in Team
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

  this.spark = this.flint.spark;

  this.batchDelay = this.flint.batchDelay;

  //randomize distribution of when audit event should take place for this bot instance...
  this.auditTrigger = Math.floor((Math.random() * this.flint.auditDelay)) + 1;

  this.active = false;

  // data local to this bot instance
  this._data = {};
  
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
 * @returns {Promise.<Bot>}
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
          return when(true);
        })
        .delay(this.batchDelay);
    } else {
      return when.reject(new Error('not a valid email'));
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
        return () => add(e, asModerator).catch(err => this.debug(err.message));
      });

      // run batch
      return sequence(batch).then(() => when(this));
    }

    // else, add using email
     else if(typeof email === 'string' || (email instanceof Array && email.length === 1)) {
      if(email instanceof Array) {
        email = _.toLower(email[0]);
      }

      return add(email, asModerator).then(() => when(this));
    }

    else {
      return when.reject(new Error('invalid parameter passed to add()'));
    }
  }
};

/**
 * Instructs Bot to remove person from room.
 * 
 * @function
 * @param {(String|Array)} email(s) - Email Address (or Array of Email Addresses) of Person(s) to remove from room.
 * @returns {Promise.<Bot>}
 * 
 * @example
 * // remove one person to room by email
 * bot.remove('john@test.com');
 * 
 * @example
 * // remove 3 people from room by email
 * bot.remove(['john@test.com', 'jane@test.com', 'bill@test.com']);
 */
Bot.prototype.remove = function(email) {

  // remove membership by email address from this room
  var remove = e => {
    if(validator.isEmail(e) && _.includes(_.map(this.memberships, 'personEmail'), e)) {
      return this.spark.membershipByRoomByEmail(this.room.id, e)
        .then(membership => this.spark.membershipRemove(membership.id))
        .then(() => {
          this.debug('Removed "%s" from room "%s"', e, this.room.title);
          return when(true);
        })
        .delay(this.batchDelay);
    } else {
      return when.reject(new Error('not a valid email'));
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
        return () => remove(e).catch(err => this.debug(err.message));
      });

      // run batch
      return sequence(batch).then(() => when(this));
    }

    // else, remove using email
    else if(typeof email === 'string' || (email instanceof Array && email.length === 1)) {
      if(email instanceof Array) {
        email = email[0];
      }

      return remove(email).then(() => when(this));
    }

    else {
      return when.reject(new Error('invalid parameter passed to remove()'));
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
  // validate bot is not a machine (bot) account
  if(this.flint.machine) {
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
  
  // validate bot is not a machine (bot) account
  if(this.flint.machine) {
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
  
  // validate bot is not a machine (bot) account
  if(this.flint.machine) {
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
  
  // validate bot is not a machine (bot) account
  if(this.flint.machine) {
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
 * @param {String|Object} message -Message to send to room as either string or object.
 * @returns {Promise.<Message>}
 * 
 * @example
 * flint.hears('/hello', function(bot, trigger) {
 *   bot.say('hello');
 * });
 * @example
 * flint.hears('/hello', function(bot, trigger) {
 *   bot.say({markdown: '*Hello <@personEmail:' + trigger.personEmail + '|' + trigger.personDisplayName + '>*'});
 * });
 * @example
 * flint.hears('/file', function(bot, trigger) {
 *   bot.say({text: 'Here is your file!', file: 'http://myurl/file.doc'});
 * });
 */
Bot.prototype.say = function(message) {
  // parse args
  var args = Array.prototype.slice.call(arguments);

  // if message is object
  if(typeof args[0] === 'object') {
    return this.spark.messageSendRoom(this.room.id, args[0]);
  }

  // if message is string
  else if(typeof args[0] === 'string') {
    message = util.format.apply(null, args);
    return this.spark.messageSendRoom(this.room.id, { text: message });
  }

  else {
    return when.reject(new Error('Invalid formatted message'));
  }
};

/**
 * Upload a file to a room using a Reeadable Stream
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
 * Send text with optional file in a direct message.
 * 
 * @function
 * @param {String} email - Email of person to send Direct Message.
 * @param {String|Object} message - Message to send to room as either string or object.
 * @returns {Promise.<Message>}
 * 
 * @example
 * flint.hears('/dm', function(bot, trigger) {
 *   var email = trigger.args[1];
 *   bot.dm(email, 'hello');
 * });
 * 
 * @example
 * flint.hears('/dm', function(bot, trigger) {
 *   var email = trigger.args[1];
 *   bot.dm(email, {text: 'hello', file: 'http://myurl/file.doc'});
 * });
 */
Bot.prototype.dm = function(email, message) {
  // parse args
  var args = Array.prototype.slice.call(arguments);
  email = args.shift();

  // if message is object
  if(validator.isEmail(email) && typeof args[0] === 'object') {
    return this.spark.messageSendPerson(email, message);
  }

  // if message is string
  else if(validator.isEmail(email) && typeof args[0] === 'string') {
    message = util.format.apply(null, args);
    return this.spark.messageSendPerson(email, { text: message });
  }

  else {
    return when.reject(new Error('Invalid formatted message'));
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
      
      // if bot account and attempting to delte own message...
      if(this.flint.machine && message.personId === this.person.id) {
        return this.spark.messageRemove(messageId);
      }
      
      // bot can delete message
      else if((this.isLocked && this.isModerator) || message.personId === this.person.id) {
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
  if(this.flint.machine) {
    return when.reject(new Error('Bot accounts can not read room messages'));
  } else {
    count = parseInt(count, 10);
    return this.spark.messagesGet(this.room.id, count)
      .then(messages => when.map(_.reverse(messages), message => this.flint.parseMessage(message)));  
  }
  
};

/**
 * Store key/value data in this bot instance
 * 
 * @function
 * @param {String} key
 * @param {(String|Number|Boolean|Array|Object|Function)}
 * @returns {Boolean}
 */
Bot.prototype.store = function(key, value) {
  if(typeof key === 'string' && typeof this._data[key] === 'undefined') {
    this._data[key] = value;
    return true;
  } else {
    return false;
  }
};

/**
 * Recall value of data stored by 'key' in this bot instance
 * 
 * @function
 * @param {String} key
 * @returns {(String|Number|Boolean|Array|Object|Function)}
 */
Bot.prototype.recall = function(key) {
  if(typeof key === 'string' && typeof this._data[key] !== 'undefined') {
    return this._data[key];
  } else {
    return false;
  }
};

/**
 * Forget a key or entire store.
 * 
 * @function
 * @param {String} [key] - Optional key value to forget. If key is not passed, bot forgets everything.
 * @returns {Boolean}
 */
Bot.prototype.forget = function(key) {
  if(typeof key !== 'undefined' && typeof key === 'string') {
    
    // if key exists...
    if(typeof this._data[key] !== 'undefined') {
      this._data[key] = undefined;
      return true;
    } 
    
    // key does not exist
    else {
      return false;
    }
  }
  
  else {
    this._data = {};
    return true;
  }
};

module.exports = Bot;
