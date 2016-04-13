'use strict';

var EventEmitter = require('events').EventEmitter;
var SparkBotToken = require('sparkbot-token');
var Sparky = require('node-sparky');
var moment = require('moment');
var debug = require('debug')('flint-engine');
var async = require('async');
var util = require('util');
var _ = require('lodash');

var Monitor = require('./monitor');
var Restify = require('./server-restify');
var Socket2Me = require('./server-socket2me');
var Bot = require('./bot');
var u = require('./flint-utils');

// constructor
function Flint(config) {
  this.config = config;
  
  var self = this;
  
  // enable additional debug() events
  self.DEBUG = false;
  
  // validate config objects
  if(!config 
    || !config.sparkEmail 
    || !(config.sparkToken || (config.clientSecret && config.clientID)))
  {
    throw self.errorReturn('missing required options');
  }
  
  // enable event emitter
  EventEmitter.call(self);
  
  // instance id
  self.id = u.genRand(24);
  
  // config defaults
  self.config.baseUrl = self.config.baseUrl || 'http://localhost'
  self.config.bindAddress = self.config.bindAddress || '0.0.0.0';
  self.config.localPort = self.config.localPort || 80;
  self.config.externalPort = self.config.externalPort || self.config.localPort;
  self.config.maxItems = self.config.maxItems || 500;
  self.config.maxConcurrent = self.config.maxConcurrent || 2;
  self.config.minTime = self.config.minTime || 500;
  self.config.tokenRefreshInterval = self.config.tokenRefreshInterval || 24 * 60 * 60 * 1000;
  
  // init phrase store
  self._lexicon = [];
  
  // init bot store
  self.bots = [];
  
  // handle internal events
  self.on('error', function(err) {
    if(err && err.message !== 'undefined') {
      debug('%s', err);
    }
  }); 

  // setup auth
  function setupAuth() {
    // if using developer auth
    if(self.config.sparkToken) {
      // set token
      self.sparkyconfig.token = self.config.sparkToken;
      self.sparky = new Sparky(self.sparkyconfig);
      
      // start monitor
      self.monitor = new Monitor(self);
    } 
    
    // if using oauth
    else if(self.config.clientID && self.config.clientSecret) {
      var sparkBotToken = new SparkBotToken(self.sbtconfig);
      sparkBotToken.get(function(err, tokens) {
        if(err) {
          throw self.errorReturn('invalid config');
        } else {
          // set token
          self.sparkyconfig.token = tokens.access_token;
          self.sparky = new Sparky(self.sparkyconfig);
          
          // refresh interval
          setInterval(function() {
            sparkBotToken.get(function(err, tokens) {
              if(!err) self.sparky.token = tokens.access_token;
            });
          }, self.config.tokenRefreshInterval);
                
          // start monitor
          self.monitor = new Monitor(self);
        }
      });
    }
    
    // else something is not right, error
    else {
      throw self.errorReturn('invalid config');
    }
  }
  
  // process webhook
  function processWebhook(req) {
    // init trigger
    var trigger = {};

    // init bot
    var bot;

    async.series([

      // validate webbhook is bound for this instance of flint
      function(cb) {
        if(_.split(req.params.name, ':', 2)[0] !== self.id) {
          cb(new Error('webhook not addressed for this instance of flint'));
        } else {
          cb(null);
        }
      },

      // find bot for the room that triggered the webhok
      function(cb) {
        bot = _.find(self.bots, function(bot) {
          return bot.myroom.id === req.params.data.roomId;
        });
        if(!bot) {
          cb(new Error('could not find bot in room'));
        } else {
          // update bot lastactive timestamp
          bot.lastActivity = moment();

          // add room to trigger
          trigger.room = bot.myroom;

          cb(null);
        }
      },

      // get message object by id
      function(cb) {
        self.sparky.message.get(req.params.data.id, function(err, message) {
          if(err) {
            cb(new Error('failed to retrieve message'));
          } else {
            trigger.message = message[0];
            cb(null);
          }
        });
      },

      // parse message
      function(cb) {
        self.parseMessage(trigger.message, function(parsedMessage) {
          trigger.message = parsedMessage;

          // breakout command and args from message
          trigger.args = _.toLower(trigger.message.text).split(' ');
          trigger.command = trigger.args.shift();

          // emit file event(s)
          if(trigger.message.files) {
            _.forEach(trigger.message.files, function(file) {
              // emit file event
              self.emit('file', file, bot);
            });
          }

          // emit message event
          self.emit('message', trigger.message, bot);

          cb(null);
        });
      },

      // stop if message is from bot
      function(cb) {
        if(req.params.data.personEmail === self.config.sparkEmail) {
          cb(new Error('message recieved was sourced from flint'));
        } else {
          cb(null);
        }
      },

      // stop if bot is not active
      function(cb) {
        if(!bot.active) {
          cb(new Error('bot is not active'));
        } else {
          cb(null);
        }
      },

      // iterate through registered lexicon of commands
      function(cb) {
        self._lexicon.forEach(function(lex) {
          // if regex match on entire message
          var isRegexMatch = (lex.phrase 
            && lex.phrase instanceof RegExp 
            && lex.phrase.test(trigger.message.text)
            );

          // if string match on first word
          var isStringMatch = (lex.phrase 
            && typeof lex.phrase === 'string' 
            && lex.phrase === trigger.message.text.split(' ')[0]
            );

          // if either regex or string match and action is function...
          if((isRegexMatch || isStringMatch) && typeof lex.action === 'function') {
            // get info about person
            self.sparky.person.get(req.params.data.personId, function(err, person) {
              if(!err) {
                // parse person into trigger object
                trigger.person = person[0];
                trigger.person.email = trigger.person.emails[0];
                trigger.person.username = _.split(trigger.person.email, '@', 2)[0];
                trigger.person.domain = _.split(trigger.person.email, '@', 2)[1];
                
                // execute if authenticated
                if(self.authUser(trigger.person.email)) {
                  lex.action(bot, trigger);
                }
              }
            });
          }
        });
        cb(null);
      }
    ], function(err) {});
  }

  // start Flint
  function startFlint() {
    // config node-sparky
    self.sparkyconfig = {
      webhook: self.config.baseUrl,
      maxItems: self.config.maxItems,
      maxConcurrent: self.config.maxConcurrent,
      minTime: self.config.minTime
    };
    
    // config sparkbot-token
    self.sbtconfig = {
      clientID: config.clientID || null,
      clientSecret: config.clientSecret || null,
      redirectURL: config.redirectURL || null,
      username: config.sparkEmail || null,
      password: config.password || null
    };

    //process auth
    setupAuth();

    // create local routes for webhook
    self.server.route('post', self.resource, function(req, res, next) {
      // validate webhook has data field and return proper response code
      if(!req.params.data) {
        self.errorReturn('received an invalid request');
        res.send(500);
        return next();
      } else {
        // process request
        processWebhook(req);

        res.send(200);
        next();
      }
    });

    self.emit('started');
  }

  // socket2me server
  if(self.config.s2mHost) {
    self.server = new Socket2Me();
    self.server.listen(self.config.localPort, self.config.s2mHost, function() {
      self.resource = '/' + u.genRand(8);
      self.config.baseUrl = self.server.url + self.resource;
      debug('is listening for webhooks on %s', self.config.baseUrl);
      startFlint();
    });

  // restify server
  } else {
    self.server = new Restify();
    self.server.listen(self.config.localPort, self.config.bindAddress, function() {
      self.resource = '/' + u.genRand(8);
      self.config.baseUrl = self.config.baseUrl + ':' + self.config.externalPort + self.resource;
      debug('is listening for webhooks on %s', self.config.baseUrl);
      startFlint();
    });
  }


}
util.inherits(Flint, EventEmitter);

// parse message
Flint.prototype.parseMessage = function(message, cb) {
  var self = this;

  // standardize timestamp...
  message.created = moment(message.created).toISOString();

  // text parse
  if(message.text) {
    // trim whitespace
    message.text = message.text.trim();
    // remove line breaks
    message.text = message.text.replace(/[\n\r]+/g, ' ');
  } else {
    message.text = '<file only>';
  }

  // file parse
  if(message.files && message.files instanceof Array) {
    // clone original message object
    var parsedMessage = _.clone(message);

    // init files property of cloned object
    parsedMessage.files = [];

    // process files
    async.eachSeries(message.files, function(url, acb) {
      // retrieve file contents
      self.sparky.contents.byUrl(url, function(err, file) {
        if(!err) {
          parsedMessage.files.push(file);
        }
        acb(err);
      });
    }, function(err) {
      if(err) {
        message.files = null;
        cb(message);
      } else {
        cb(parsedMessage);
      }
      
    });
  } else {
    cb(message);
  }
};

// error handler
Flint.prototype.errorReturn = function(message) {
  var self = this;
  
  var error;
  
  if(message) {
    // pargs arguments
    var args = Array.prototype.slice.call(arguments);
  
    // apply formatters to message and generate error
    error = new Error(util.format.apply(this, args));
  } else {
    error = new Error('undefined');
  }

  // emit error
  self.emit('error', error);
  
  // return error object
  return error;
};

// authorize user by email
Flint.prototype.authUser = function(email) {
  var self = this;
  
  // define domain
  var domain = _.split(email, '@', 2)[1];

  // authorize by user email
  function authEmail(uEmail) {
    return self.config.userWhiteList && _.includes(self.config.userWhiteList, uEmail);
  }

  // authorize by user domain
  function authDomain(uDomain) {
    return self.config.domainWhiteList && _.includes(self.config.domainWhiteList, uDomain);
  }

  // authorize against optional user email and user domain
  if(authEmail(email) || authDomain(domain)) {
    return true;
  } 
  else if(!(self.config.userWhiteList && self.config.domainWhiteList)) {
    return true;
  }
  else {
    return false;
  }
};

// bot spawn
Flint.prototype.spawn = function(roomId, callback) {
  var self = this;
  
  // validate params
  if(!roomId) {
    debug('can not create bot, room id not valid');
    callback ? callback(self.errorReturn('room id not valid')) : null;
    return self;
  }
  
  // validate bot is not already assigned to room
  var found = _.find(self.bots, function(bot) {
    return (bot.myroom.id === roomId);
  });
  if(found) {
    debug('can not create bot, already exists in room');
    callback ? callback(self.errorReturn('bot already exists in room')) : null;
    return self;
  }

  // create new bot
  var newBot = new Bot(self);

  // load bot
  async.series([
    // get room object where bot lives
    function(cb) {
      self.sparky.room.get(roomId, function(err, room) {
        if(!err && room[0]) {
          newBot.myroom = room[0];
          cb(null);
        } else {
          cb(err || self.errorReturn('room not found'));
        }
      });
    },
    
    // get person object for self
    function(cb) {
      self.sparky.person.me(function(err, person) {
        if(!err && person[0]) {
          newBot.myperson = person[0];
          newBot.myemail = newBot.myperson.emails[0];
          cb(err);
        } else {
          cb(err || self.errorReturn('person not found'));
        }
        
      });
    },
    
    // get memebership of self for room
    function(cb) {
      self.sparky.memberships.get(function(err, memberships) {
        if(err) {
          cb(err);
        } else {
          newBot.mymembership = _.find(memberships, { 'roomId': newBot.myroom.id });
          if(!newBot.mymembership) {
            cb(self.errorReturn('membership not found'));
          } else {
            cb(null);
          }
        }
      });
    },
    
    // remove existing webhooks for flint.id and roomId
    function(cb) {
      // get all webhooks for bot account
      self.sparky.webhooks.get(function(err, webhooks) {
        if(err) {
          cb(err);
        } else {
          // check for exisiting wbhooks
          var found = _.filter(webhooks, function(webhook) {
            var flintId = (webhook.name.split(':')[0] === self.id);
            var roomId = (webhook.name.split(':')[1] === newBot.myroom.id);
            
            return (flintId && roomId);
          });
          
          // if found...
          if(found && found.length > 0) {
            // remove...
            async.eachSeries(found, function(webhook, acb) {
              if(webhook.id) {
                self.sparky.webhook.remove(webhook.id, function() {
                  acb();
                });
              }
            }, function() {
              cb(null);
            });
            
          } else {
            cb(null);
          }
          
        }
        
      });
    },
    
    // add new webhook for room
    function(cb) {
      var webhookName = self.id + ':' + newBot.myroom.id;
      
      //add webhook
      self.sparky.webhook.add.messages.created.room(newBot.myroom.id, webhookName, function(err, webhook) {
        if(err){
          newBot.mywebhook = null;
        } else {
          newBot.mywebhook = webhook;
        }
        cb(err);
      });
      
    }
    
  ], function(err) {
    if(err) {
      self.despawn(newBot);
      err = self.errorReturn('failed to spawn bot');
      callback ? callback(err) : null;
      
      return self;
    } else {
      // set bot active
      newBot.start();
      
      // emit event
      self.emit('spawn', newBot);
      
      //add bot to flint
      self.bots.push(newBot);
      
      callback ? callback(null) : null;
      return self;
    }
  });
};

// bot despawn
Flint.prototype.despawn = function(bot, callback) {
  var self = this;
  
  // stop bot processes
  bot.stop();
  
  // remove bot
  async.series([
    
    function(cb) {
      if(bot.mywebhook && bot.mywebhook.id) {
        self.sparky.webhook.remove(bot.mywebhook.id, function() {
          cb(null);
        });
      } else {
        cb(null);
      }
    }
  
  ], function(err) {
    if(err) {
      err = self.errorReturn('failed to despawn bot');
      callback ? callback(err) : null;
    }  else {
      
      // emit event
      self.emit('despawn', bot);
      
      // remove bot from registry
      self.bots = _.reject(self.bots, { 'id': bot.id });
      
      callback ? callback(null) : null;
    } 
  });
  
  
  return self;
};

// add action to be performed when bot hears a phrase
Flint.prototype.hears = function(phrase, options, action) {
  var self = this;

  // parse args
  var args = Array.prototype.slice.call(arguments);
  phrase = args.shift();
  action = args.pop();
  // optional args
  options = (args.length > 0 && typeof args[0] === 'object') ? args.shift() : null;

  self._lexicon.push({'phrase': phrase, 'options': options, 'action': action });

};

//
// Broadcasts (equivalent to bot function, but to all rooms)
//

Flint.prototype.exit = function(cb) {
  var self = this;
  
  async.eachSeries(self.bots, function(bot, acb) {
    bot.exit(acb);
  }, function(err) {
    cb ? cb(err) : null;
  });
};

Flint.prototype.say = function(message, cb) {
  var self = this;
  
  async.eachSeries(self.bots, function(bot, acb) {
    bot.say(message, acb);
  }, function(err) {
    cb ? cb(err) : null;
  });
};

Flint.prototype.file = function(url, cb) {
  var self = this;
  
  async.eachSeries(self.bots, function(bot, acb) {
    bot.file(url, acb);
  }, function(err) {
    cb ? cb(err) : null;
  });
};

Flint.prototype.add = function(email, cb) {
  var self = this;
  
  async.eachSeries(self.bots, function(bot, acb) {
    bot.add(email, acb);
  }, function(err) {
    cb ? cb(err) : null;
  });
};

Flint.prototype.remove = function(email, cb) {
  var self = this;
  
  async.eachSeries(self.bots, function(bot, acb) {
    bot.remove(email, acb);
  }, function(err) {
    cb ? cb(err) : null;
  });
};

//
// Extend the Flint and Bot objects (plugin framework)
//

// extend the Flint object
Flint.prototype.extend = function(fnName, fn) {

  if(!Flint.prototype[fnName]) {
    Flint.prototype[fnName] = fn;
    return true;
  } else {
    return false;
  }
};

// extend the Bot object
Flint.prototype.extendBot = function(fnName, fn) {

  if(!Bot.prototype[fnName]) {
    Bot.prototype[fnName] = fn;
    return true;
  } else {
    return false;
  }

};

module.exports = Flint;
