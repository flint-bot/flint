var debug = require('debug')('flint');

var nodesparky = require('node-sparky');
var async = require('async');
var _ = require('lodash');

var monitor = require('./monitor');
var server = require('./server');
var Bot = require('./bot');

// constructor
function Flint(config) {
  this.config = config;

  var $this = this;

  $this.monitorInterval = 15000;

  $this._lexicon = [];
  $this._bots = [];

  $this.sparky = nodesparky({
    token: $this.config.sparkToken,
    webhook: $this.config.hookUrl + '/spark'
  });

  server.listen('0.0.0.0', $this.config.localPort);
  server.route('/spark', $this);

  // start monitor
  monitor($this);

}

// process callback from webhook
Flint.prototype._processWebhook = function(resource, req) {
  var $this = this;

  var trigger = {};

  // compare string with pattern
  function compare(pattern, string) {
    // if regex match
    if(pattern instanceof RegExp && pattern.test(string)) {
      return true;
    }
    // if string match on first word
    if(typeof pattern === 'string' && pattern === string.split(' ')[0]) {
      return true;
    }
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

  ], 
  function(err, results) {

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
};

// bot factory
Flint.prototype.botSpawner = function(roomId, callback) {
  var $this = this;

  // create new bot
  var newBot = new Bot($this.sparky);

  // load bot
  async.series([

    // get room object where bot lives
    function(cb) {
      $this.sparky.room.get(roomId, function(err, room) {
        if(!err) newBot._room = room[0];
        return cb(err);
      });
    },

    // get person object for self
    function(cb) {
      $this.sparky.person.self(function(err, person) {
        if(!err) newBot._person = person[0];
        return cb(err);
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
    },

    // set webhook for room and associate with newBot
    function(cb) {

      // get webhook for room
      $this.sparky.webhooks.get(function(err, webhooks) {
        if(err) {
          debug('encountered an error getting webhooks');
          return cb(err);
        } else {
          // find room in existing webhooks
          var webhook = _.find(webhooks, function(webhook) {
            return _.split(webhook.filter, '=', 2)[1] === newBot._room.id;
          });

          // if webhook exists for room
          if(webhook) {
             newBot._webhook = webhook;
             return cb(null);
          } else {
            // create webhook for room
            $this.sparky.webhook.add.messages.created.room(newBot._room.id, function(err, _webhook) {
              if(err){
                debug('encountered an error creating a webhook for a bot');
              } else {
                newBot._webhook = webhook;
              }
              return cb(err);
            });
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

Flint.prototype.hears = function(phrase, options, action) {
  var $this = this;

  // parse args
  var args = [];
  for (var i = 0; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  phrase = args.shift();
  action = args.pop();
  // optional args
  options = (args.length > 0 && typeof args[0] === 'object') ? args.shift() : null;

  $this._lexicon.push({'phrase': phrase, 'options': options, 'action': action });

};

module.exports = Flint;
