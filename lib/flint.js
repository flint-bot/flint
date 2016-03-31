var debug = require('debug')('flint');

var Sparky = require('node-sparky');
var async = require('async');
var _ = require('lodash');

var SparkBotToken = require('sparkbot-token');
var Subscriber = require('./subscriber');
var utility = require('./utility');
var monitor = require('./monitor');
var server = require('./server');
var Proxy = require('./proxy');
var Bot = require('./bot');

// constructor
function Flint(config) {
  this.config = config;
  this.server = server;
  this.monitor = monitor;
  
  var self = this;

  // refresh token every 24 hours
  self._refreshInterval = 24 * 60 * 60 * 1000;

  // monitor room status every 15 seconds
  self._monitorInterval = 15 * 1000;

  // init phrase store
  self._lexicon = [];
  
  // init bot store
  self._bots = [];

  // check if remotePort is defined. if not, set to localPort
  self.config.remotePort = (self.config.remotePort || self.config.localPort);

  // set base url
  self._url = self.config.baseUrl + ':' + self.config.remotePort;

  // set base url path
  self._resource = '/' + utility.genRand(8);

  // set unique webhook identifier
  self.id = utility.genRand(8);

  // init web server
  self.server.listen('0.0.0.0', self.config.localPort);

  // init route subscriber
  self.subscriber = new Subscriber(self);

  // init route proxy
  self.proxy = new Proxy(self);

  // node sparky init
  function initSparky(token) {
    self.sparky = new Sparky({
      token: token,
      webhook: self._url + self._resource,
      maxItems: self.config.maxItems || 500,
      maxConcurrent: self.config.maxConcurrent || 1,
      minTime: self.config.minTime || 500
    });
  }
  
  // function to process callback from webhook
  function processWebhook(req, res, next) {
    // validate webhook has data field and return proper response code
    if(!req.params.data) {
      debug('received an invalid request');
      res.send(500);
      return next();
    } else {
      res.send(200);
      next();
    }

    // validate webbhook is bound for this instance of flint
    if(_.split(req.params.name, ':', 2)[0] !== self.id) {
      return;
    }

    // init trigger
    var trigger = {};
  
    // compare string with pattern
    function compare(pattern, string) {
      // validate variables
      if(!pattern || !string) return false;

      // if regex match
      if(pattern instanceof RegExp && pattern.test(string)) return true;
      
      // if string match on first word
      if(typeof pattern === 'string' && pattern === string.split(' ')[0]) return true;
    
      // else
      return false;
    }
  
    async.series([
      function(cb) {
        self.sparky.room.get(req.params.data.roomId, cb);
      },
      function(cb) {
        self.sparky.person.get(req.params.data.personId, cb);
      },
      function(cb) {
        self.sparky.message.get(req.params.data.id, cb);
      }
    ], function(err, results) {
      if(err){
        debug('has encountered an error processing an incoming webhook');
      } else {
        trigger.room = results[0][0]; // room object
        trigger.person = results[1][0]; // person object
        trigger.message =  results[2][0]; // message object
        trigger.person.email = trigger.person.emails[0];
        trigger.person.username = _.split(trigger.person.email, '@', 2)[0];
        trigger.person.domain = _.split(trigger.person.email, '@', 2)[1];
        trigger.args = _.toLower(trigger.message.text).split(' ');
        trigger.command = trigger.args.shift();

        // ignore messages for bot
        if(req.params.data.personEmail === self.config.sparkEmail) {
          return;
        }

        // auth user
        if(self.authUser(trigger.person.email)) {
    
          // iterate through registered lexicon of commands
          self._lexicon.forEach(function(lex) {
            if(compare(lex.phrase, trigger.message.text)) {
    
              // find bot for the room that trigger the webhok
              var bot = _.find(self._bots, function(bot) {
                return bot._room.id === trigger.room.id;
              });
    
              // check if bot was found from room trigger originated
              if(bot) {
                // execute function with bot in room from trigger
                lex.action(bot, trigger);
              } else {
                debug('ignored webhook callback');
              }
            }
          });

        }
        
      }
  
    });
  }

  //
  // Init Auth and Start Flint
  //

  // check for auth token auth type
  if(self.config.sparkToken) {
    initSparky(self.config.sparkToken);
    // start monitor
    self.monitor(self);
    // listen for webhooks
    self.server.route('post', self._resource, processWebhook);
  }
  // check for refresh token auth type
  else if(self.config.clientID && self.config.clientSecret) {
    self.sparkBotToken = new SparkBotToken(self.config);
    self.sparkBotToken.get(function(err, tokens) {
      if(err) {
        throw new Error('error with token');
      } else {
        initSparky(tokens.access_token);
        setInterval(function() {
          self.sparkBotToken.get(function(err, tokens) {
            if(err) {
              throw new Error('error with token');
            } else {
              initSparky(tokens.access_token);
            }
          });
        }, self._refreshInterval);
        // start monitor
        self.monitor(self);
        // listen for webhooks
        self.server.route('post', self._resource, processWebhook);
      }
    });
  } 
  // fail as token config is missing
  else {
    throw new Error('error with flint config');
  }
}

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

// bot factory
Flint.prototype.spawn = function(roomId, callback) {
  var self = this;

  // create new bot
  var newBot = new Bot(self);

  // load bot
  async.series([
    // get room object where bot lives
    function(cb) {
      self.sparky.room.get(roomId, function(err, room) {
        if(!err && room[0]) {
          newBot._room = room[0];
          return cb(null);
        } else {
          return cb(err || new Error('room not found'));
        }
      });
    },
    // get person object for self
    function(cb) {
      self.sparky.person.me(function(err, person) {
        if(!err && person[0]) {
          newBot._person = person[0];
          return cb(err);
        } else {
          return cb(err || new Error('person not found'));
        }
        
      });
    },
    // get memebership of self for room
    function(cb) {
      self.sparky.memberships.get(function(err, memberships) {
        if(err) {
          return cb(err);
        } else {
          newBot._membership = _.find(memberships, { 'roomId': newBot._room.id });
          if(!newBot._membership) {
            return cb(new Error('membership not found'));
          } else {
            return cb(null);
          }
        }
      });
    }
  ], function(err) {
    if(err) {
      newBot.destroy();
      // return last error
      return callback(err[err.length - 1]);
    } else {
      //add bot to flint
      self._bots.push(newBot);
      return callback(null);
    }
  });
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

module.exports = Flint;
