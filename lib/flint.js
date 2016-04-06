'use strict';

var EventEmitter = require('events').EventEmitter;
var Socket2meClient = require('socket2me-client');
var SparkBotToken = require('sparkbot-token');
var Sparky = require('node-sparky');
var moment = require('moment');
var debug = require('debug')('flint-engine');
var async = require('async');
var util = require('util');
var _ = require('lodash');

var Subscriber = require('./subscriber');
var Monitor = require('./monitor');
var server = require('./server');
var Proxy = require('./proxy');
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
  self.config.maxLogSize = self.config.maxLogSize || 1000;
  self.config.tokenRefreshInterval = self.config.tokenRefreshInterval || 24 * 60 * 60 * 1000;
  
  // set url for web services
  self.url = self.config.baseUrl + ':' + config.externalPort;
  self._resource = '/' + u.genRand(8);

  // config node-sparky
  self.sparkyconfig = {
    webhook: self.url + self._resource,
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

  // init phrase store
  self._lexicon = [];
  
  // init bot store
  self.bots = [];

  // init web server
  self.server = server;
  self.server.listen(self.config.bindAddress, self.config.localPort);
  
  self.subscriber = new Subscriber(self);
  self.proxy = new Proxy(self);
  
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
    // validate webbhook is bound for this instance of flint
    if(_.split(req.params.name, ':', 2)[0] !== self.id) {
      return;
    }
    // find bot for the room that triggered the webhok
    var bot = _.find(self.bots, function(bot) {
      return bot.myroom.id === req.params.data.roomId;
    });
    if(!bot) return;
    
    // update bot lastactive timestamp
    bot.lastActivity = moment();

    // init trigger
    var trigger = {};
    
    // add room to trigger
    trigger.room = bot.myroom;
    
    // process message
    self.sparky.message.get(req.params.data.id, function(err, message) {
      if(err) return;
 
      // parse message into trigger object
      trigger.message = message[0];
      trigger.files = trigger.message.files || null;
      trigger.args = _.toLower(trigger.message.text).split(' ');
      trigger.command = trigger.args.shift();
      
      // trim whitespace from message text
      if(trigger.message.text) trigger.message.text = trigger.message.text.trim();
      
      // emit events
      self.emit('message', bot, trigger.message);
      if(trigger.files) self.emit('files', bot, trigger.files);
      
      // log message
      bot.logMessage(trigger.message);
 
      // stop if message is from bot
      if(req.params.data.personEmail === self.config.sparkEmail) {
        return;
      }
      
      // stop if bot is not active
      if(!bot.active) return;

      // iterate through registered lexicon of commands
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
      
    });
    
  }

  // if using socket2me...
  if(self.config.s2mHost) {
    // generate socket
    self.socket2me = new Socket2meClient(self.config.s2mHost);

    // on (each) connection...
    self.socket2me.on('connected', function() {
      // override webhook callback url
      self.sparkyconfig.webhook = self.socket2me.callbackUrl;

      // process auth
      setupAuth();

      // listen for webhooks
      self.socket2me.listen(processWebhook);
    });
  } 

  // else... create local hosted route process for webhook callback
  else {
    //process auth
    setupAuth();

    // create local routes for webhook
    self.server.route('post', self._resource, function(req, res, next) {
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
  }

}
util.inherits(Flint, EventEmitter);

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

// publishes a new incoming route
Flint.prototype.publish = function(name, cb) {
  var self = this;

  return self.subscriber.create(name, cb);
};

// exposes a remote url file as a local url file
Flint.prototype.expose = function(url, filename) {
  var self = this;

  return self.proxy.create(url, filename);
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

module.exports = Flint;
