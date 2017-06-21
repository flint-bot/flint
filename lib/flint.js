'use strict';

var EventEmitter = require('events').EventEmitter;
EventEmitter.prototype._maxListeners = 0;
var sequence = require('when/sequence');
var moment = require('moment');
var Spark = require('node-sparky');
var _debug = require('debug')('flint');
var util = require('util');
var when = require('when');
var path = require('path');
var _ = require('lodash');

var MemStore = require('../storage/memory');

var Bot = require('./bot');
var u = require('./utils');

/**
 * Creates an instance of Flint.
 *
 * @constructor Flint
 * @param {Object} options - Configuration object containing Flint settings.
 * @property {string} id - Flint UUID
 * @property {boolean} active - Flint active state
 * @property {boolean} intialized - Flint fully initialized
 * @property {boolean} isBotAccount - Is Flint attached to Spark using a bot account?
 * @property {boolean} isUserAccount - Is Flint attached to Spark using a user account?
 * @property {object} person - Flint person object
 * @property {string} email - Flint email
 * @property {object} spark - The Spark instance used by flint
 *
 * @example
 * var options = {
 *   webhookUrl: 'http://myserver.com/flint',
 *   token: 'Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u'
 * };
 * var flint = new Flint(options);
 */
function Flint(options) {
  EventEmitter.call(this);

  this.id = options.id || u.genUUID64();

  /**
   * Options Object
   *
   * @memberof Flint
   * @instance
   * @namespace options
   * @property {string} token - Spark Token.
   * @property {string} webhookUrl - URL that is used for SPark API to send callbacks.
   * @property {string} [webhookSecret] - If specified, inbound webhooks are authorized before being processed.
   * @property {string} [messageFormat=text] - Default Spark message format to use with bot.say().
   * @property {number} [maxPageItems=50] - Max results that the paginator uses.
   * @property {number} [maxConcurrent=3] - Max concurrent sessions to the Spark API
   * @property {number} [minTime=600] - Min time between consecutive request starts.
   * @property {number} [requeueMinTime=minTime*10] - Min time between consecutive request starts of requests that have been re-queued.
   * @property {number} [requeueMaxRetry=3] - Msx number of atteempts to make for failed request.
   * @property {array} [requeueCodes=[429,500,503]] - Array of http result codes that should be retried.
   * @property {number} [requestTimeout=20000] - Timeout for an individual request recieving a response.
   * @property {number} [queueSize=10000] - Size of the buffer that holds outbound requests.
   * @property {number} [requeueSize=10000] - Size of the buffer that holds outbound re-queue requests.
   * @property {string} [id=random] - The id this instance of flint uses.
   * @property {string} [webhookRequestJSONLocation=body] - The property under the Request to find the JSON contents.
   * @property {Boolean} [removeWebhooksOnStart=true] - If you wish to have the bot remove all account webhooks when starting.
   */
  this.options = options;

  this.active = false;
  this.initialized = false;
  this.storageActive = false;
  this.isBotAccount = false;
  this.isUserAccount = false;
  this.person = {};
  this.email;

  // define location in webhook request to find json values of incoming webhook.
  // note: this is typically 'request.body' but depending on express/restify configuration, it may be 'request.params'
  this.options.webhookRequestJSONLocation = this.options.webhookRequestJSONLocation || 'body';

  // define if flint remove all webhooks attached to token on start (if not defined, defaults to true)
  this.options.removeWebhooksOnStart = typeof this.options.removeWebhooksOnStart === 'boolean' ? this.options.removeWebhooksOnStart : true;

  // define default messageFormat used with bot.say (if not defined, defaults to 'text')
  if(typeof this.options.messageFormat === 'string' && _.includes(['text', 'markdown', 'html'], _.toLower(this.options.messageFormat))) {
    this.messageFormat = _.toLower(this.options.messageFormat);
  } else {
    this.messageFormat = 'text';
  }

  this.batchDelay = options.minTime * 2;
  this.auditInterval;
  this.auditDelay = 300;
  this.auditCounter = 0;
  this.logs = [];
  this.logMax = 1000;
  this.lexicon = [];
  this.bots = [];
  this.spark = {};
  this.webhook = {};

  // register internal events
  this.on('error', err => {
    if(err) {
      console.err(err.stack);
    }
  });
  this.on('start', () => {
    require('./logs')(this);
    this.initialize();
  });
}
util.inherits(Flint, EventEmitter);

/**
 * Internal logger function.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} message - Message to log
 * @returns {string} Formatted message
 */
Flint.prototype.log = function(message) {
  if(this.log.length > this.logMax) {
    this.log = this.log.slice(this.log.length - this.logMax);
  }
  message = (moment().utc().format('YYYY-MM-DD HH:mm:ss') + ' ' + message);
  this.logs.push(message);

  /**
   * Flint log event.
   *
   * @event log
   * @property {string} message - Log Message
   */
  this.emit('log', message);
  return message;
};

/**
 * Internal debug function.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} message - Message to debug
 * @returns {null}
 */
Flint.prototype.debug = function(message) {
  message = util.format.apply(null, Array.prototype.slice.call(arguments));

  if(typeof this.debugger === 'function') {
    this.debugger(message, this.id);
  } else {
    _debug(message);
  }
};

/**
 * Tests, and then sets a new Spark Token.
 *
 * @function
 * @memberof Flint
 * @param {String} token - New Spark Token for Flint to use.
 * @returns {Promise.<String>}
 *
 * @example
 * flint.setSparkToken('Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u')
 *   .then(function(token) {
 *      console.log('token updated to: ' + token);
 *   });
 */
Flint.prototype.setSparkToken = function(token) {
  return this.testSparkToken(token)
    .then(token => {
      this.options.token = token;
      return when(token);
    })
    .catch(() => {
      when.reject(new Error('could not change token, token not valid'));
    });
};

/**
 * Test a new Spark Token.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} token - Test if Token is valid by attempting a simple Spark API Call.
 * @returns {Promise.<String>}
 *
 * @example
 * flint.testSparkToken('Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u')
 *   .then(function() {
 *     console.log('token valid');
 *   })
 *   .catch(function(err) {
 *     console.log(err.message);
 *   });
 */
Flint.prototype.testSparkToken = function(token) {
  var testOptions = _.clone(this.options);
  testOptions.token = token;
  var testSpark = new Spark(testOptions);

  return testSpark.membershipsGet()
    .then(memberships => {
      testSpark = {};
      return when(token);
    })
    .catch(() =>{
      return when.reject(new Error('token not valid'));
    });
};

/**
 * Stop Flint.
 *
 * @function
 * @memberof Flint
 * @returns {Promise.<Boolean>}
 *
 * @example
 * flint.stop();
 */
Flint.prototype.stop = function() {

  // if not stopped...
  if(this.active) {

    return this.getWebhooks()
      // get webhooks
      .then(webhooks => {

        // remove all webhooks on stop
        if(!this.options.removeWebhooksOnStart) {
          var webhooksToRemove = _.filter(webhooks, webhook => {
            return (webhook.name == u.base64encode(this.options.webhookUrl.split('/')[2] + ' ' + this.email));
          });

          if(webhooksToRemove instanceof Array && webhooksToRemove.length > 0) {
            return when.map(webhooksToRemove, webhook => this.spark.webhookRemove(webhook.id))
              .then(() => when(true))
              .catch(() => when(true));
          } else {
            return when(true);
          }
        }

        // else, only remove webhooks this app created
        else {
          return when.map(webhooks, webhook => this.spark.webhookRemove(webhook.id))
            .then(() => when(true))
            .catch(() => when(true));
        }

      })

      .then(() => {
        if(this.auditInterval) clearInterval(this.auditInterval);

        /**
         * Flint stop event.
         *
         * @event stop
         * @property {string} id - Flint UUID
         */
        this.emit('stop', this.id);

        return when.map(this.bots, bot => {
          bot.stop();
          return when(true);
        });
      })

      .then(() => {
        this.bots = [];
        this.spark = {};
        this.webhook = {};
        this.active = false;
        this.initialized = false;
        return when(true);
      });

  } else {
    return when(false);
  }
};

/**
 * Start Flint.
 *
 * @function
 * @memberof Flint
 * @returns {Promise.<Boolean>}
 *
 * @example
 * flint.start();
 */
Flint.prototype.start = function() {

  // if not started...
  if(!this.active) {

    // init storage default storage driver if start is called before
    if(!this.storageActive) {
      // define default storage module
      this.storageDriver(new MemStore());
    }

    // init spark
    this.spark = new Spark(this.options);

    // determine bot identity
    return this.spark.personMe()
      .then(person => this.getPerson(person.emails[0]))

      // get updqated person object
      .then(person => {
        this.person = person;
        this.email = person.email;

        // check if account is bot or user account
        if(this.person.domain === 'sparkbot.io') {
          this.isBotAccount = true;
          this.isUserAccount = false;
        } else {
          this.isBotAccount = false;
          this.isUserAccount = true;
        }

        return when(person);
      })

      // get webhooks
      .then(person => this.getWebhooks())

      // process webhooks
      .then(webhooks => {

        // remove only webhooks this app created
        if(!this.options.removeWebhooksOnStart) {

          var webhooksToRemove = _.filter(webhooks, webhook => {
            return (webhook.name == u.base64encode(this.options.webhookUrl.split('/')[2] + ' ' + this.email));
          });

          if(webhooksToRemove instanceof Array && webhooksToRemove.length > 0) {
            return when.map(webhooksToRemove, webhook => this.spark.webhookRemove(webhook.id));
          } else {
            return when(true);
          }
        }

       // else, remove all webhooks on start
        else {
          return when.map(webhooks, webhook => this.spark.webhookRemove(webhook.id));
        }
      })

      .then(() => {
        if(this.options.webhookUrl) {
          return this.spark.webhookAdd('all', 'all', u.base64encode(this.options.webhookUrl.split('/')[2] + ' ' + this.email))
            .then(webhook => {
              this.webhook = webhook;
              return when(webhook);
            })
            .catch(() => {
              this.webhook = false;
              return when(false);
            });
        } else {
          this.webhook = false;
          return when(false);
        }
      })

      // start
      .then(() => {
        /**
         * Flint start event.
         *
         * @event start
         * @property {string} id - Flint UUID
         */
        this.emit('start', this.id);
        this.active = true;
        return when(true);
      })

      // setup auditor
      .then(() => {
        this.auditInterval = setInterval(() => {
          this.auditBots();
        }, 1000);
        return when(true);
      })

      // handle errors
      .catch(err => {
        throw err;
      });
  } else {
    return when(false);
  }
};

/**
 * Initialize Flint.
 *
 * @function
 * @memberof Flint
 * @private
 * @returns {Promise.<Boolean>}
 *
 * @example
 * flint.initialize();
 */
Flint.prototype.initialize = function() {
  // spawn bots in existing rooms at startup
  return this.spark.membershipsGet()
    .then(memberships => {

      // create batch
      var batch = _.map(memberships, m => {
        return () => this.spawn(m.roomId);
      });

      // run batch
      return sequence(batch)
        .then(() => when(true))
        .catch(err => {
          this.debug(err.stack);
          return when(true);
        });
    })

    .then(() => {
      /**
       * Flint initialized event.
       *
       * @event initialized
       * @property {string} id - Flint UUID
       */
      this.emit('initialized', this.id);
      this.initialized = true;
      return when(true);
    });

};

/**
 * Restart Flint.
 *
 * @function
 * @memberof Flint
 * @returns {Promise.<Boolean>}
 *
 * @example
 * flint.restart();
 */
Flint.prototype.restart = function() {
  return this.stop()
    .then(stopped => {
      if(stopped) {
        return this.start();
      } else {
        return when(false);
      }
    });
};

/**
 * Audit bot objects to verify they are in sync with the Spark API.
 *
 * @function
 * @memberof Flint
 * @private
 * @returns {Promise.<Bot>}
 *
 * @example
 * flint.auditBots();
 */
Flint.prototype.auditBots = function() {
  // only run if Flint has initialized
  if(!this.initialized) {
    return when(true);
  }

  // increment counter
  this.auditCounter++;

  // reset counter when counter exceeds max
  if(this.auditCounter > this.auditDelay) {
    this.auditCounter = 0;
  }

  // update flint.person
  if(this.auditCounter === 0) {
    this.getPerson(this.person.email)
      .then(person => {
        this.person = person;
      })
      .catch(err => this.debug(err.stack));
  }

  // remove duplicate bots
  if(this.auditCounter % 5 === 0) {
    var uniqBots = _.uniqBy(this.bots, bot => bot.room.id);
    var botsToRemove = _.differenceBy(this.bots, uniqBots, 'id');
    _.forEach(botsToRemove, bot => this.despawn(bot.room.id).catch(() => true));
  }

  // check for zombies
  if(this.auditCounter === (this.auditDelay - 1)) {
    this.getRooms()
      .then(rooms => {
        var roomsToAdd = _.differenceBy(rooms, _.map(this.bots, bot => bot.room), 'id');
        _.forEach(roomsToAdd, room => this.spawn(room.id));
      })
      .catch(() => {
        return when(true);
      });
  }

  // exit rooms where bot is only member
  if(this.auditCounter === (this.auditDelay - 1)) {
    _.forEach(this.bots, bot => {
      if(bot.memberships.length === 0 && bot.isGroup && !bot.isTeam) {
        bot.exit();
      }
    });
  }

  return when.map(this.bots, bot => {
    // if auditDelay < bot auditTrigger, reset bot audit trigger
    if(this.auditDelay <= bot.auditTrigger) {
      bot.auditTrigger = Math.floor((Math.random() * this.auditDelay)) + 1;
    }

    // if bot.auditTrigger matches current count inside auditDelay range
    if(this.initialized && bot.auditTrigger === this.auditCounter) {

      // room
      var room = () => this.getRoom(bot.room.id)
        .then(room => {
          // Fix the occassional old room with missing title
          if(typeof room.title === 'undefined' || room.title.trim() === '') {
            room.title = 'Default title';
          }
          return this.onRoomUpdated(room);
        })
        .catch(err => {
          this.debug(err.stack);
          return when(true);
        });

      // membership
      var membership = () => this.getMembership(bot.membership.id)
        .then(membership => this.onMembershipUpdated(membership))
        .catch(err => {
          this.debug(err.stack);
          return when(true);
        });

      // memberships
      var memberships = () => this.getMemberships(bot.room.id)
        .then(memberships => when.map(memberships, membership => this.onMembershipUpdated(membership)))

        .catch(err => {
          this.debug(err.stack);
          return when(true);
        });

      return sequence([room, membership, memberships]);
    }

    else {
      return when(true);
    }
  });
};

/**
 * Parse a message object.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {Object} message - Message Object
 * @returns {Promise.<Message>}
 */
Flint.prototype.parseMessage = function(message) {

  /**
   * Message Object
   *
   * @namespace Message
   * @property {string} id - Message ID
   * @property {string} personId - Person ID
   * @property {string} personEmail - Person Email
   * @property {string} personAvatar - PersonAvatar URL
   * @property {string} personDomain - Person Domain Name
   * @property {string} personDisplayName - Person Display Name
   * @property {string} roomId - Room ID
   * @property {string} text - Message text
   * @property {array} files - Array of File objects
   * @property {date} created - Date Message created
   */

  message.created = moment(message.created).utc().toDate();
  message.personEmail = _.toLower(message.personEmail);

  // parse message text
  if(message.text) {

    // capture raw message
    message.raw = message.text;

    // trim leading whitespace
    message.text = message.text.trim();

    // replace carriage returns / new lines with a space
    message.text = message.text.replace(/[\n\r]+/g, ' ');

    // remove all consecutive white space characters
    message.text = message.text.replace(/\s\s+/g, ' ');
  }

  return when(true)
    .then(() => {
      return this.getPerson(message.personEmail)
        .then(person => {
          message.personDisplayName = person.displayName;
          message.personDomain = person.domain;
          message.personAvatar = person.avatar || false;
          return when(message);
        })
        .catch(() => {
          message.personDisplayName = message.personEmail;
          message.personDomain = 'unknown';
          return when(message);
        });
    })
    .catch(() => {
      return when(message);
    });
};

/**
 * Parse a File from Message.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {Object} message - Previously parsed Message Object
 * @returns {Promise.<Message>}
 */
Flint.prototype.parseFile = function(message) {

  /**
   * File Object
   *
   * @namespace File
   * @property {string} id - Spark API Content ID
   * @property {string} name - File name
   * @property {string} ext - File extension
   * @property {string} type - Header [content-type] for file
   * @property {buffer} binary - File contents as binary
   * @property {string} base64 - File contents as base64 encoded string
   * @property {string} personId - Person ID of who added file
   * @property {string} personEmail - Person Email of who added file
   * @property {string} personAvatar - PersonAvatar URL
   * @property {string} personDomain - Person Domain Name
   * @property {string} personDisplayName - Person Display Name
   * @property {date} created - Date file was added to room
   */

  // parse message files
  if(message.files && message.files instanceof Array) {
    var parsedMessage = _.clone(message);

    return when.map(parsedMessage.files, url => this.spark.contentByUrl(url))
      .then(files => {
        _.forEach(files, file => {
          file.personId = parsedMessage.personId;
          file.personEmail = parsedMessage.personEmail;
          file.personDisplayName = parsedMessage.personDisplayName;
          file.personAvatar = parsedMessage.personAvatar;
          file.personDomain = parsedMessage.personDomain;
          file.created = parsedMessage.created;
        });
        parsedMessage.files = files;
        return when(parsedMessage);
      })
      .catch(() => {
        return when(message);
      });
  } else {
    return when(message);
  }
};

/**
 * Creates Trigger Object from messageId.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {Webhook} messageData - Webhook object from message created webhook
 * @returns {Promise.<Trigger>}
 */
Flint.prototype.getTrigger = function(messageId) {

  /**
   * Trigger Object
   *
   * @namespace Trigger
   * @property {string} id - Message ID
   * @property {(string|regex)} phrase - Matched lexicon phrase
   * @property {string} text - Message Text (or false if no text)
   * @property {string} raw - Unprocessed Message Text (or false if no text)
   * @property {string} html - Message HTML (or false if no html)
   * @property {string} markdown - Message Markdown (or false if no markdown)
   * @property {array} mentionedPeople - Mentioned People (or false if no mentioned)
   * @property {array} files - Message Files (or false if no files in trigger)
   * @property {array} args - Filtered array of words in message text.
   * @property {date} created - Message Created date
   * @property {string} roomId - Room ID
   * @property {string} roomTitle - Room Title
   * @property {string} roomType - Room Type (group or direct)
   * @property {boolean} roomIsLocked - Room Locked/Moderated status
   * @property {string} personId - Person ID
   * @property {string} personEmail - Person Email
   * @property {string} personDisplayName - Person Display Name
   * @property {string} personUsername - Person Username
   * @property {string} personDomain - Person Domain name
   * @property {string} personAvatar - Person Avatar URL
   * @property {object} personMembership - Person Membership object for person
   */
  var trigger = {};

  return this.getMessage(messageId)
    .then(message => {

      trigger.id = message.id;
      trigger.text = message.text || false;
      trigger.raw = message.raw || false;
      trigger.html = message.html || false;
      trigger.markdown = message.markdown || false;
      trigger.args = trigger.text ? trigger.text.split(' ') : [];
      trigger.mentionedPeople = message.mentionedPeople || false;
      trigger.created = message.created;

      var room = this.getRoom(message.roomId)
        .then(room => {

          trigger.roomId = room.id;
          trigger.roomTitle = room.title;
          trigger.roomType = room.type;
          trigger.roomIsLocked = room.isLocked;

          return when(true);
        });

      var person = this.getPerson(message.personEmail)
        .then(person => {

          trigger.personId = person.id;
          trigger.personEmail = person.email;
          trigger.personUsername = person.username;
          trigger.personDomain = person.domain;
          trigger.personDisplayName = person.displayName;
          trigger.personAvatar = person.avatar;

          return when(true);
        });

      var membership = this.getMemberships(message.roomId)
        .then(memberships => _.find(memberships, {'personId': message.personId}))
        .then(membership => {

          trigger.personMembership = membership;

          return when(true);
        });

      var files = this.parseFile(message)
        .then(message => {
           trigger.files = message.files || false;
           return when(true);
        });

      return when.all([room, person, membership, files])
        .then(() => when(trigger));
    });
};

/**
 * Get Rooms
 *
 * @function
 * @memberof Flint
 * @private
 * @returns {Promise.<Array>}
 */
Flint.prototype.getRooms = function() {
  return this.spark.roomsGet()
    .then(rooms => {
      return when.map(rooms, room => {
        room.lastActivity = moment(room.lastActivity).utc().toDate();
        room.created = moment(room.created).utc().toDate();
        room.added = moment().utc().toDate();
        return when(room);
      });
    });
};

/**
 * Get Room Object By ID
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} roomId - Room ID from Spark API.
 * @returns {Promise.<Room>}
 */
Flint.prototype.getRoom = function(roomId) {
  return this.spark.roomGet(roomId)
    .then(room => {
      room.lastActivity = moment(room.lastActivity).utc().toDate();
      room.created = moment(room.created).utc().toDate();
      room.added = moment().utc().toDate();

      return when(room);
    });
};

/**
 * Get Teams
 *
 * @function
 * @memberof Flint
 * @private
 * @returns {Promise.<Array>}
 */
Flint.prototype.getTeams = function() {
  return this.spark.teamsGet()
    .then(teams => {
      return when.map(teams, team => {
        team.created = moment(team.created).utc().toDate();
        return when(team);
      });
    });
};

/**
 * Get Team Object By ID
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} teamId - Team ID from Spark API.
 * @returns {Promise.<Team>}
 */
Flint.prototype.getTeam = function(teamId) {
  return this.spark.teamGet(teamId)
    .then(team => {
      team.created = moment(team.created).utc().toDate();
      return when(team);
    });
};

/**
 * Get Team Rooms
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} teamId - Room ID from Spark API
 * @returns {Promise.<Array>}
 */
Flint.prototype.getTeamRooms = function(teamId) {
  return this.spark.roomsByTeam(teamId)
    .then(rooms => {
      return when.map(rooms, room => {
        room.lastActivity = moment(room.lastActivity).utc().toDate();
        room.created = moment(room.created).utc().toDate();
        return when(room);
      });
    });
};

/**
 * Get Person Object By Email
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} personEmail - Person Email of Spark Account
 * @returns {Promise.<Person>}
 */
Flint.prototype.getPerson = function(personEmail) {
  return this.spark.personByEmail(personEmail)
    .then(person => {
      person.created = moment(person.created).utc().toDate();
      person.emails = _.forEach(person.emails, email => _.toLower(email));
      person.email = _.toLower(person.emails[0]);
      person.username = _.split(person.email, '@', 2)[0];
      person.domain = _.split(person.email, '@', 2)[1];
      person.avatar = person.avatar || '';

      return when(person);
    });
};

/**
 * Get Message Object by ID
 *
 * @function
 * @memberof Flint
 * @param {String} messageId - Message ID from Spark API.
 * @returns {Promise.<Message>}
 */
Flint.prototype.getMessage = function(messageId) {
  return this.spark.messageGet(messageId)
    .then(message => this.parseMessage(message));
};

/**
 * Get Files from Message Object by ID
 *
 * @function
 * @memberof Flint
 * @param {String} messageId - Message ID from Spark API.
 * @returns {Promise.<Array>}
 */
Flint.prototype.getFiles = function(messageId) {
  return this.spark.messageGet(messageId)
    .then(message => this.parseMessage(message))
    .then(message => this.parseFile(message))
    .then(message => {
      if(typeof message.files !== undefined && message.files instanceof Array) {
        return when(message.files);
      } else {
        return when.reject(new Error('no files found in message'));
      }
    });
};

/**
 * Get Membership Object by ID
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} membershipId - Membership ID from Spark API.
 * @returns {Promise.<Membership>}
 */
Flint.prototype.getMembership = function(membershipId) {
  return this.spark.membershipGet(membershipId)
    .then(membership => {
      membership.created = moment(membership.created).utc().toDate();
      membership.personEmail = _.toLower(membership.personEmail);
      membership.email = membership.personEmail;

      return when(membership);
    });
};

/**
 * Get Memberships by Room ID
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} [roomId] - Room ID from Spark API.
 * @returns {Promise.<Array>}
 * Promise fulfilled with Array of updated Membership objects.
 */
Flint.prototype.getMemberships = function(roomId) {
  if(!roomId) {
    return this.spark.membershipsGet()
      .then(memberships => {
        return when.map(memberships, membership => {
          membership.created = moment(membership.created).utc().toDate();
          membership.personEmail = _.toLower(membership.personEmail);
          membership.email = membership.personEmail;

          return when(membership);
        });
      });
  }

  else {
    return this.spark.membershipsByRoom(roomId)
      .then(memberships => {
        return when.map(memberships, membership => {
          membership.created = moment(membership.created).utc().toDate();
          membership.personEmail = _.toLower(membership.personEmail);
          membership.email = membership.personEmail;

          return when(membership);
        });
      });
  }
};

/**
 * Get Team Membership Object by ID
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} teamMembershipId - Team Membership ID from Spark API.
 * @returns {Promise.<TeamMembership>}
 */
Flint.prototype.getTeamMembership = function(teamMembershipId) {

  return this.spark.teamMembershipGet(teamMembershipId)
    .then(membership => {
      membership.created = moment(membership.created).utc().toDate();
      membership.personEmail = _.toLower(membership.personEmail);
      membership.email = membership.personEmail;

      return when(membership);
    });
};

/**
 * Get Memberships by Team ID
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} teamId - Team ID from Spark API.
 * @returns {Promise.<Array>}
 */
Flint.prototype.getTeamMemberships = function(teamId) {
  if(teamId) {
    return this.spark.teamMembershipsGet(teamId)
      .then(teamMemberships => {
        return when.map(teamMemberships, teamMembership => {
          teamMembership.created = moment(teamMembership.created).utc().toDate();
          teamMembership.personEmail = _.toLower(teamMembership.personEmail);
          teamMembership.email = teamMembership.personEmail;

          return when(teamMembership);
        });
      });
  }

  else {
    return when.reject(new Error('missing teamId parameter'));
  }
};

/**
 * Get Webhook Object by ID
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} webhookId - Webhook ID from Spark API.
 * @returns {Promise.<Webhook>}
 */
Flint.prototype.getWebhook = function(webhookId) {
  return this.spark.webhookGet(webhookId)
    .then(webhook => {
      webhook.created = moment(webhook.created).utc().toDate();
      if(typeof webhook.filter === 'string') {
        if(webhook.filter.split('=')[0] === 'roomId') {
          webhook.roomId = webhook.filter.split('=')[1];
        }
      }

      return when(webhook);
    });
};

/**
 * Get Webhooks
 *
 * @function
 * @memberof Flint
 * @private
 * @returns {Promise.<Array>}
 */
Flint.prototype.getWebhooks = function() {
  return this.spark.webhooksGet()
    .then(webhooks => {
      webhooks = _.forEach(webhooks, webhook => {
        webhook.created = moment(webhook.created).utc().toDate();
        if(typeof webhook.filter === 'string') {
          if(webhook.filter.split('=')[0] === 'roomId') {
            webhook.roomId = webhook.filter.split('=')[1];
          }
        }
      });
      return when(webhooks);
    });
};

/**
 * Process a Room create event.
 *
 * @function
 * @memberof Flint
 * @private
 * @returns {Promise}
 */
Flint.prototype.onRoomCreated = function(room) {
  var bot = _.find(this.bots, bot => bot.room.id === room.id);
  if(bot) {
    bot.lastActivity = moment().utc().toDate();
  }
  return when(true);
};

/**
 * Process a Room update event.
 *
 * @function
 * @memberof Flint
 * @private
 * @returns {Promise}
 */
Flint.prototype.onRoomUpdated = function(room) {
  var bot = _.find(this.bots, bot => bot.room.id === room.id);
  if(bot) bot.lastActivity = moment().utc().toDate();

  // if bot exists in monitored room...
  if(bot) {
    //update bot
    bot.room = room;
    bot.isGroup = (room.type === 'group');
    bot.isDirect = (room.type === 'direct');

    // if team
    if(typeof room.teamId !== 'undefined') {
      bot.isTeam = true;
      bot.teamId = room.teamId;
    } else {
      bot.isTeam = false;
      bot.teamId = null;
    }

    // emit event locked
    if(bot.isLocked != room.isLocked && room.isLocked) {
      bot.isLocked = room.isLocked;

      /**
       * Room Locked event.
       *
       * @event roomLocked
       * @property {object} bot - Bot Object
       * @property {string} id - Flint UUID
       */
      this.emit('roomLocked', bot, this.id);
      bot.emit('roomLocked', bot, bot.id);

      return when(true);
    }

    // emit event unLocked
    else if(bot.isLocked != room.isLocked && !room.isLocked) {
      bot.isLocked = room.isLocked;
      /**
       * Room Unocked event.
       *
       * @event roomUnocked
       * @property {object} bot - Bot Object
       * @property {string} id - Flint UUID
       */
      this.emit('roomUnlocked', bot, this.id);
      bot.emit('roomUnlocked', bot, bot.id);
      return when(true);
    }

    else {
      return when(true);
    }
  }

  // else bot does not exist in monitored room
  else {
    return when(true);
  }
};

/**
 * Process a new Membership event.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {Object} membership - Spark Team Membership Object
 * @returns {Promise}
 */
Flint.prototype.onMembershipCreated = function(membership) {
  var bot = _.find(this.bots, bot => bot.room.id === membership.roomId);
  if(bot) bot.lastActivity = moment().utc().toDate();

  // if bot membership added to un-monitored room...
  if(!bot && this.initialized && membership.personEmail === this.person.email) {
    // spawn bot
    return this.spawn(membership.roomId);
  }

  // else if other membership added to monitored room...
  else if(bot) {

    // add new membership to bot.memberships
    bot.memberships.push(membership);

    return this.getPerson(membership.personEmail)
      .then(person => {

        /**
         * Person Enter Room event.
         *
         * @event personEnters
         * @property {object} bot - Bot Object
         * @property {object} person - Person Object
         * @property {string} id - Flint UUID
         */
        this.emit('personEnters', bot, person, this.id);
        bot.emit('personEnters', bot, person, bot.id);
        return when(true);
      });
  }

  // else, bot not found and membership added for other user
  else {
    return when(true);
  }
};

/**
 * Process a updated Membership event.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {Object} membership - Spark Membership Object
 * @returns {Promise}
 */
Flint.prototype.onMembershipUpdated = function(membership) {
  var bot = _.find(this.bots, bot => bot.room.id === membership.roomId);
  if(bot) bot.lastActivity = moment().utc().toDate();

  // if membership updated in monitored room
  if(bot && membership.personEmail === this.person.email) {
    // update bot membership
    bot.membership = membership;

    // emit event Moderator
    if(bot.isModerator != membership.isModerator && membership.isModerator) {
      bot.isModerator = membership.isModerator;

      /**
       * Bot Added as Room Moderator.
       *
       * @event botAddedAsModerator
       * @property {object} bot - Bot Object
       * @property {string} id - Flint UUID
       */
      this.emit('botAddedAsModerator', bot, this.id);
      bot.emit('botAddedAsModerator', bot, bot.id);

      return when(true);
    }

    // emit event not Moderator
    else if(bot.isModerator != membership.isModerator && !membership.isModerator) {
      bot.isModerator = membership.isModerator;

      /**
       * Bot Removed as Room Moderator.
       *
       * @event botRemovedAsModerator
       * @property {object} bot - Bot Object
       * @property {string} id - Flint UUID
       */
      this.emit('botRemovedAsModerator', bot, this.id);
      bot.emit('botRemovedAsModerator', bot, bot.id);

      return when(true);
    }

    else {
      return when(true);
    }
  }

  // else if other membership updated in monitored room
  else if(bot && this.initialized) {
    // update bot room membership
    bot.memberships = _.map(bot.memberships, m => {
      // if membership ...
      if(m.id === membership.id) {

        // get person
        if(m.isModerator != membership.isModerator) {
          this.getPerson(membership.personEmail)
            .then(person => {
              // emit event added Moderator
              if(membership.isModerator) {

                /**
                 * Person Added as Moderator.
                 *
                 * @event personAddedAsModerator
                 * @property {object} bot - Bot Object
                 * @property {object} person - Person Object
                 * @property {string} id - Flint UUID
                 */
                this.emit('personAddedAsModerator', bot, person, this.id);
                bot.emit('personAddedAsModerator', bot, person, bot.id);
              }

              // emit event removed Moderator
              if(!membership.isModerator) {

                /**
                 * Person Removed as Moderator.
                 *
                 * @event personRemovedAsModerator
                 * @property {object} bot - Bot Object
                 * @property {object} person - Person Object
                 * @property {string} id - Flint UUID
                 */
                this.emit('personRemovedAsModerator', bot, person, this.id);
                bot.emit('personRemovedAsModerator', bot, person, bot.id);
              }

            });
        }

        //update membership;
        return membership;
      }

      // if not membership...
      else {
        // do not update membership
        return m;
      }
    });

    return when(true);
  }

  // else, bot not found and membership updated for other user
  else {
    return when(true);
  }
};

/**
 * Process a deleted Membership event.
 *
 * @function
 * @memberof Flint
 * @private
 *
 * @param {Object} membership - Spark Membership Object
 * @returns {Promise}
 */
Flint.prototype.onMembershipDeleted = function(membership) {
  var bot = _.find(this.bots, bot => bot.room.id === membership.roomId);

  // if bot membership deleted in monitored room
  if(bot && membership.personEmail === this.person.email) {
    // despawn bot
    return this.despawn(bot.room.id)
      .then(() => when(true))
      .catch(() => when(false));
  }

  // else if other membership deleted in monitored room...
  else if(bot) {
    // remove bot room membership
    bot.memberships = _.reject(bot.memberships, {'id': membership.id});

    return this.getPerson(membership.personEmail)
      .then(person => {

        /**
         * Person Exits Room.
         *
         * @event personExits
         * @property {object} bot - Bot Object
         * @property {object} person - Person Object
         * @property {string} id - Flint UUID
         */
        this.emit('personExits', bot, person, this.id);
        bot.emit('personExits', bot, person, bot.id);

        return when(true);
      });
  }

  // else, bot not found and membership deleted for other user
  else {
    return when(true);
  }
};

/**
 * Process a new Message event.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {Object} tembership - Spark Team Membership Object
 * @returns {Promise}
 */
Flint.prototype.onMessageCreated = function(message) {
  var bot = _.find(this.bots, bot => bot.room.id === message.roomId);
  if(bot) bot.lastActivity = moment().utc().toDate();

  // if bot found...
  if(bot) {
    return this.getTrigger(message.id)
      .then(trigger => {

        // function to run the action
        function runActions(matched, bot, trigger, id) {
          // process preference logic
          if(matched.length > 1) {
            matched = _.sortBy(matched, match => match.preference);
            var prefLow = matched[0].preference;
            var prefHigh = matched[matched.length - 1].preference;

            if(prefLow !== prefHigh) {
              matched = _.filter(matched, match => (match.preference === prefLow));
            }
          }

          _.forEach(matched, lex => {
            // for regex
            if(lex.phrase instanceof RegExp && typeof lex.action === 'function') {
              // define trigger.args, trigger.phrase
              trigger.args = trigger.text.split(' ');
              trigger.phrase = lex.phrase;

              // run action
              lex.action(bot, trigger, id);
              return true;
            }

            // for string
            else if (typeof lex.phrase === 'string' && typeof lex.action === 'function') {
              // find index of match
              var args = _.toLower(trigger.text).split(' ');
              var indexOfMatch = args.indexOf(lex.phrase) !== -1 ? args.indexOf(lex.phrase) : 0;

              // define trigger.args, trigger.phrase
              trigger.args = trigger.text.split(' ');
              trigger.args = trigger.args.slice(indexOfMatch, trigger.args.length);
              trigger.phrase = lex.phrase;

              // run action
              lex.action(bot, trigger, id);
              return true;
            }

            // for nothing...
            else {
              return false;
            }
          });
        }

        // if mentioned
        if(trigger.mentionedPeople && _.includes(trigger.mentionedPeople, this.person.id)) {

          trigger.args = trigger.text.split(' ');

          /**
           * Bot Mentioned.
           *
           * @event mentioned
           * @property {object} bot - Bot Object
           * @property {object} trigger - Trigger Object
           * @property {string} id - Flint UUID
           */
          this.emit('mentioned', bot, trigger, this.id);
          bot.emit('mentioned', bot, trigger, bot.id);
        }

        // emit message event
        if(trigger.text) {

          /**
           * Message Recieved.
           *
           * @event message
           * @property {object} bot - Bot Object
           * @property {object} trigger - Trigger Object
           * @property {string} id - Flint UUID
           */
          this.emit('message', bot, trigger, this.id);
          bot.emit('message', bot, trigger, bot.id);
        }

        // emit file event
        if(trigger.files) {

          /**
           * File Recieved.
           *
           * @event files
           * @property {object} bot - Bot Object
           * @property {trigger} trigger - Trigger Object
           * @property {string} id - Flint UUID
           */
          this.emit('files', bot, trigger, this.id);
          bot.emit('files', bot, trigger, bot.id);
        }

        // if message is from bot...
        if(trigger.personEmail === this.email) {
          // ignore messages from bot
          return when(false);
        }

        // if trigger text present...
        if(trigger.text) {

          // return matched lexicon entry
          var matched =  _.filter(this.lexicon, lex => {

            // if lex.phrase is regex
            if(lex.phrase && lex.phrase instanceof RegExp && lex.phrase.test(trigger.text)) {
              return true;
            }

            // if lex.phrase is string and this is NOT a bot account
            else if(!this.isBotAccount && lex.phrase && typeof lex.phrase === 'string' && lex.phrase === _.toLower(trigger.text).split(' ')[0]) {
              return true;
            }

            // if lex.phrase is string and this is a bot account
            else if(this.isBotAccount && lex.phrase && typeof lex.phrase === 'string') {
              var regexPhrase = new RegExp('(^| )' + lex.phrase.replace(/([\.\^\$\*\+\?\(\)\[\{\\\|])/g, '\\$1') + '($| )','i');
              return (regexPhrase.test(trigger.text));
            }

            // else, no valid match
            else return false;
          });
        }

        // else trigger.text not present...
        else {
          return when(false);
        }

        // if matched
        if(matched && typeof this.authorize === 'function') {
          // if authorization function exists...
          return when(this.authorize(bot, trigger, this.id))
            .then(authorized => {

              //if authorized
              if(authorized) {
                runActions(matched, bot, trigger, this.id);
                return when(trigger);
              } else {
                this.debug('"%s" was denied running command in room "%s" for account "%s"', trigger.personEmail, trigger.roomTitle, this.email);
                return when(false);
              }
            });
        }

        // else, if matched and no authorization configured, run command
        else if(matched) {
          runActions(matched, bot, trigger, this.id);
          return when(trigger);
        }

        // else, do nothing...
        else {
          return when(false);
        }
      });
    }

    // else, bot not found...
    else {
      return when(false);
    }
};

/**
 * Spawns a bot in a Spark Room.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} Room ID - The ID for a Spark Room.
 * @returns {Promise.<Boolean>}
 */
Flint.prototype.spawn = function(roomId) {

  // if active...
  if(!this.active) {
    return when(false);
  }

  // validate params
  if(typeof roomId !== 'string') {
    this.debug('A bot for acount "%s" could not spawn as room id not valid', this.email);
    return when(false);
  }

  // validate bot is not already assigned to room
  var foundBot = _.find(this.bots, bot => (bot.room.id === roomId));
  if(foundBot) {
    this.debug('A bot for acount "%s" could not spawn as bot already exists in room', this.email);
    return when(false);
  }

  // create new bot
  var newBot = new Bot(this);

  // get room that bot is spawning in
  return this.getRoom(roomId)
    .then(room => {
      if(room.title == '') {
        room.title = 'Default title';
      }

      newBot.room = room;
      newBot.isDirect = (room.type === 'direct');
      newBot.isGroup = (room.type === 'group');
      newBot.isLocked = room.isLocked;

      return when(room);
    })

    // get team
    .then(room => {
      // if team
      if(typeof room.teamId !== 'undefined') {
        return this.getTeam(room.teamId)
          .then(team => {
            newBot.team = team;
            newBot.isTeam = true;
            return when(room);
          })
          .catch(err => {
            newBot.team = {};
            newBot.isTeam = false;
            return when(room);
          });
      } else {
        newBot.isTeam = false;
        newBot.team = {};
        return when(room);
      }
    })

    // get memberships of room
    .then(room => this.getMemberships(room.id))
    .then(memberships => {

      // get bot membership from room memberships
      var botMembership = _.find(memberships, { 'personEmail': this.person.email });

      // remove bot membership from room memberships
      memberships = _.reject(memberships, { 'personId': this.person.id });

      // assign room memberships to bot
      newBot.memberships = memberships;

      // assign membership properties to bot object
      newBot.membership = botMembership;
      newBot.isModerator = botMembership.isModerator;
      newBot.isMonitor = botMembership.isMonitor;

      // if direct, set recipient
      if(newBot.isDirect) {
        newBot.isDirectTo = memberships[0].personEmail;
      }

      return when(memberships);
    })

    // register and start bot
    .then(() => {

      // start bot
      newBot.start();

      // add bot to array of bots
      this.bots.push(newBot);

      /**
       * Bot Spawned.
       *
       * @event spawn
       * @property {object} bot - Bot Object
       * @property {string} id - Flint UUID
       */
      this.emit('spawn', newBot, this.id);

      return when(true);
    })

    // insert delay
    .delay(this.spark.minTime)

    // catch errors with spawn
    .catch(err => {

      // remove reference
      newBot = {};

      return when(false);
    });
};

/**
 * Despawns a bot in a Spark Room.
 *
 * @function
 * @memberof Flint
 * @private
 * @param {String} Room ID - The ID for a Spark Room.
 * @returns {Promise.<Bot>}
 */
Flint.prototype.despawn = function(roomId) {
  var bot = _.find(this.bots, bot => (bot.room.id === roomId));

  if(bot) {
    // shutdown bot
    bot.stop();

    /**
     * Bot Despawned.
     *
     * @event despawn
     * @property {object} bot - Bot Object
     * @property {string} id - Flint UUID
     */
    this.emit('despawn', bot, this.id);

    // remove bot from flint
    this.bots = _.reject(this.bots, { 'id': bot.id });

    // remove objects assigned to memory store for this bot
    this.forgetByRoomId(bot.room.id);

    return when(true);

  } else {
    return when.reject(new Error('despawn failed to find bot in room'));
  }
};

/**
 * Add action to be performed when bot hears a phrase.
 *
 * @function
 * @memberof Flint
 * @param {Regex|String} phrase - The phrase as either a regex or string. If
 * regex, matches on entire message.If string, matches on first word.
 * @param {Function} action - The function to execute when phrase is matched.
 * Function is executed with 2 variables. Trigger and Bot. The Trigger Object
 * contains information about the person who entered a message that matched the
 * phrase. The Bot Object is an instance of the Bot Class as it relates to the
 * room the message was heard.
 * @param {String} [helpText] - The string of text that describes how this
 * command operates.
 * @param {Number} [preference=0] - Specifies preference of phrase action when
 * overlapping phrases are matched. On multiple matches with same preference,
 * all matched actions are excuted. On multiple matches with difference
 * preference values, only the lower preferenced matched action(s) are executed.
 * @returns {String}
 *
 * @example
 * // using a string to match first word and defines help text
 * flint.hears('/say', function(bot, trigger, id) {
 *   bot.say(trigger.args.slice(1, trigger.arges.length - 1));
 * }, '/say <greeting> - Responds with a greeting');
 *
 * @example
 * // using regex to match across entire message
 * flint.hears(/(^| )beer( |.|$)/i, function(bot, trigger, id) {
 *   bot.say('Enjoy a beer, %s! 🍻', trigger.personDisplayName);
 * });
 */
Flint.prototype.hears = function(phrase, action, helpText, preference) {
  var id = u.genUUID64();

  // parse function args
  var args = Array.prototype.slice.call(arguments);
  phrase = args.length > 0 && (typeof args[0] === 'string' || args[0] instanceof RegExp) ? args.shift() : null;
  action = args.length > 0 && typeof args[0] === 'function' ? args.shift() : null;
  helpText = args.length > 0 && typeof args[0] === 'string' ? args.shift() : null;
  preference = args.length > 0 && typeof args[0] === 'number' ? args.shift() : 0;

  if(typeof phrase === 'string' && action) {
    phrase = _.toLower(phrase);
    this.lexicon.push({ 'id': id, 'phrase': phrase, 'action': action, 'helpText': helpText, 'preference': preference });
    return id;
  }

  else if(phrase instanceof RegExp && action) {
    this.lexicon.push({ 'id': id, 'phrase': phrase, 'action': action, 'helpText': helpText, 'preference': preference });
    return id;
  }

  else {
    throw new Error('Invalid flint.hears() syntax');
  }
};

/**
 * Remove a "flint.hears()" entry.
 *
 * @function
 * @memberof Flint
 * @param {String} id - The "hears" ID.
 * @returns {null}
 *
 * @example
 * // using a string to match first word and defines help text
 * var hearsHello = flint.hears('/flint', function(bot, trigger, id) {
 *   bot.say('Hello %s!', trigger.personDisplayName);
 * });
 * flint.clearHears(hearsHello);
 */
Flint.prototype.clearHears = function(hearsId) {
  this.lexicon = _.reject(this.lexicon, lex => (lex.id === hearsId));
};

/**
 * Display help for registered Flint Commands.
 *
 * @function
 * @param {String} [header=Usage:] - String to use in header before displaying help message.
 * @param {String} [footer=Powered by Flint - https://github.com/nmarus/flint] - String to use in footer before displaying help message.
 * @returns {String}
 *
 * @example
 * flint.hears('/help', function(bot, trigger, id) {
 *   bot.say(flint.showHelp());
 * });
 */
Flint.prototype.showHelp = function(header, footer) {
  header = header ? header : 'Usage:';
  footer = footer ? footer : 'Powered by Flint - https://github.com/nmarus/flint';

  var helpText = '';

  _.forEach(this.lexicon, lex => {
    if(lex.helpText) {
      helpText = helpText + '* ' + lex.helpText + '\n';
    }
  });

  helpText = header + '\n\n' + helpText + '\n' + footer + '\n\n';

  return helpText;
};

/**
 * Attaches authorizer function.
 *
 * @function
 * @memberof Flint
 * @param {Function} Action - The function to execute when phrase is matched
 * to authenticate a user.  The function is passed the bot, trigger, and id and
 * expects a return value of true or false.
 * @returns {Boolean}
 *
 * @example
 * function myAuthorizer(bot, trigger, id) {
 *   if(trigger.personEmail === 'john@test.com') {
 *     return true;
 *   }
 *   else if(trigger.personDomain === 'test.com') {
 *     return true;
 *   }
 *   else {
 *     return false;
 *   }
 * }
 * flint.setAuthorizer(myAuthorizer);
 */
Flint.prototype.setAuthorizer = function(fn) {
  if(typeof fn === 'function') {
    this.authorize = when.lift(fn);
    return true;
  } else {
    this.authorize = null;
    return false;
  }
};
Flint.prototype.authorize = null;

/**
 * Removes authorizer function.
 *
 * @function
 * @memberof Flint
 * @returns {null}
 *
 * @example
 * flint.clearAuthorizer();
 */
Flint.prototype.clearAuthorizer = function() {
  this.authorize = null;
};

/**
 * Defines storage backend.
 *
 * @function
 * @memberof Flint
 * @param {Function} Driver - The storage driver.
 * @returns {null}
 *
 * @example
 * // define memory store (default if not specified)
 * flint.storageDriver(new MemStore());
 */
Flint.prototype.storageDriver = function(driver) {

  // validate storage module store() method
  if(typeof driver.store === 'function') {
    Bot.prototype.store = function(key, value) {
      var id = this.room.id;
      return driver.store.call(driver, id, key, value);
    };
  } else {
    throw new Error('storage module missing store() function');
  }

  // validate storage module recall() method
  if(typeof driver.recall === 'function') {
    Bot.prototype.recall = function(key) {
      var id = this.room.id;
      return driver.recall.call(driver, id, key);
    };
  } else {
    throw new Error('storage module missing recall() function');
  }

  // validate storage module forget() method
  if(typeof driver.forget === 'function') {
    Bot.prototype.forget = function(key) {
      var id = this.room.id;
      return driver.forget.call(driver, id, key);
    };

    Flint.prototype.forgetByRoomId = function(roomId) {
      return driver.forget.call(driver, roomId)
        .catch(err => {
          // ignore errors when called by forgetByRoomId
          return when(null);
        });
    };
  } else {
    throw new Error('storage module missing forget() function');
  }

  // storage defined
  this.storageActive = true;
};

/**
 * Remove objects from memory store associated to a roomId.
 *
 * @function
 * @private
 * @param {String} roomId
 * @returns {Boolean}
 */
Flint.prototype.forgetByRoomId = null;

/**
 * Load a Plugin from a external file.
 * @function
 * @memberof Flint
 * @param {String} path - Load a plugin at given path.
 * @returns {Boolean}
 *
 * @example
 * flint.use('events.js');
 *
 * @example
 * // events.js
 * module.exports = function(flint) {
 *   flint.on('spawn', function(bot) {
 *     console.log('new bot spawned in room: %s', bot.myroom.title);
 *   });
 *   flint.on('despawn', function(bot) {
 *     console.log('bot despawned in room: %s', bot.myroom.title);
 *   });
 *   flint.on('messageCreated', function(message, bot) {
 *     console.log('"%s" said "%s" in room "%s"', message.personEmail, message.text, bot.myroom.title);
 *   });
 * };
 */
Flint.prototype.use = function(pluginPath) {
  if(path.parse(pluginPath).ext === '.js') {
    try {
      require(pluginPath)(this);
      this.debug('Loading flint plugin at "%s"', pluginPath);
      return true;
    }

    catch(err) {
      this.debug('Could not load flint plugin at "%s"', pluginPath);
      return false;
    }
  }
};

module.exports = Flint;
