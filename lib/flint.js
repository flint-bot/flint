var debug = require('debug')('flint');

var nodesparky = require('node-sparky');
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
  
  var $this = this;

  // refresh token every 24 hours
  $this._refreshInterval = 24 * 60 * 60 * 1000;

  // monitor room status every 15 seconds
  $this._monitorInterval = 15 * 1000;

  // init phrase store
  $this._lexicon = [];
  
  // init bot store
  $this._bots = [];

  // check if remotePort is defined. if not, set to localPort
  $this.config.remotePort = ($this.config.remotePort || $this.config.localPort);

  // set base url
  $this._url = $this.config.baseUrl + ':' + $this.config.remotePort;

  // set base url path
  $this._resource = '/' + utility.genRand(8);

  // init web server
  $this.server.listen('0.0.0.0', $this.config.localPort);

  // init route subscriber
  $this.subscriber = new Subscriber($this);

  // init route proxy
  $this.proxy = new Proxy($this);

  // node sparky init
  function initSparky(token) {
    $this.sparky = nodesparky({
      token: token,
      webhook: $this._url + $this._resource
    });
  }
  
  // function to process callback from webhook
  function processWebhook(req, res, next) {
    // validate webhook has data field
    if(!req.params.data) {
      debug('received an invalid request');
      res.send(500);
      return next();
    } else {
      res.send(200);
      next();
    }

    // init trigger
    var trigger = {};
  
    // compare string with pattern
    function compare(pattern, string) {
      // if regex match
      if(pattern instanceof RegExp && pattern.test(string)) return true;
      
      // if string match on first word
      if(typeof pattern === 'string' && pattern === string.split(' ')[0]) return true;
    
      // else
      return false;
    }
  
    async.series([
      function(cb) {
        $this.sparky.room.get(req.params.data.roomId, cb);
      },
      function(cb) {
        $this.sparky.person.get(req.params.data.personId, cb);
      },
      function(cb) {
        $this.sparky.message.get(req.params.data.id, cb);
      }
    ], function(err, results) {
      if(err){
        debug('has encountered an error processing an incoming webhook');
      } else {
        trigger.room = results[0][0]; // room object
        trigger.person = results[1][0]; // person object
        trigger.message =  results[2][0]; // message object
        trigger.args = _.toLower(trigger.message.text).split(' ');
        trigger.command = trigger.args.shift();
        // ignore messages from bot
        if(trigger.person.emails[0] === $this.config.sparkEmail) {
          return;
        }
        // iterate through registered lexicon of commands
        $this._lexicon.forEach(function(lex) {
          if(compare(lex.phrase, trigger.message.text)) {
  
            // find bot for the room that trigger the webhok
            var bot = _.find($this._bots, function(bot) {
              return bot._room.id === trigger.room.id;
            });
  
            // check if bot was found for toom trigger originated
            if(bot) {
              // execute function with bot in room from trigger
              lex.action(bot, trigger);
            } else {
              debug('ignored webhook callback');
            }
          }
        });
      }
  
    });
  }

  //
  // Init Auth and Start Flint
  //

  // check for auth token auth type
  if($this.config.sparkToken) {
    initSparky($this.config.sparkToken);
    // start monitor
    $this.monitor($this);
    // listen for webhooks
    $this.server.route('post', $this._resource, processWebhook);
  }
  // check for refresh token auth type
  else if($this.config.clientID && $this.config.clientSecret) {
    $this.sparkBotToken = new SparkBotToken($this.config);
    $this.sparkBotToken.get(function(err, tokens) {
      if(err) {
        throw new Error('error with token');
      } else {
        initSparky(tokens.access_token);
        setInterval(function() {
          $this.sparkBotToken.get(function(err, tokens) {
            if(err) {
              throw new Error('error with token');
            } else {
              initSparky(tokens.access_token);
            }
          });
        }, $this._refreshInterval);
        // start monitor
        $this.monitor($this);
        // listen for webhooks
        $this.server.route('post', $this._resource, processWebhook);
      }
    });
  } 
  // fail as token config is missing
  else {
    throw new Error('error with flint config');
  }
}

// bot factory
Flint.prototype.spawn = function(roomId, callback) {
  var $this = this;

  // create new bot
  var newBot = new Bot($this);

  // load bot
  async.series([
    // get room object where bot lives
    function(cb) {
      $this.sparky.room.get(roomId, function(err, room) {
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
      $this.sparky.person.self(function(err, person) {
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
      $this.sparky.memberships.get(function(err, memberships) {
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
      $this._bots.push(newBot);
      return callback(null);
    }
  });
};

// add action to be performed when bot hears a phrase
Flint.prototype.hears = function(phrase, options, action) {
  var $this = this;

  // parse args
  var args = Array.prototype.slice.call(arguments);
  phrase = args.shift();
  action = args.pop();
  // optional args
  options = (args.length > 0 && typeof args[0] === 'object') ? args.shift() : null;

  $this._lexicon.push({'phrase': phrase, 'options': options, 'action': action });

};

// publishes a new incoming route
Flint.prototype.publish = function(name, cb) {
  var $this = this;

  return $this.subscriber.create(name, cb);
};

// exposes a remote url file as a local url file
Flint.prototype.expose = function(url, filename) {
  var $this = this;

  return $this.proxy.create(url, filename);
};

module.exports = Flint;
