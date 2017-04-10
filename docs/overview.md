## Overview

Most of Flint's functionality is based around the flint.hears function. This
defines the phrase or pattern the bot is listening for and what actions to take
when that phrase or pattern is matched. The flint.hears function gets a callback
than includes two objects. The bot object, and the trigger object.

Flint generates a bot object instance of the Bot class for each room the Spark
account Flint is running under. The bot object instance tracks the specifics
about the room it is running in and is passed to the  "hears" command callback
when a phrase is heard.

Flint also generates a trigger object based on the person and room that the
flint.hears function was triggered.

A simple example of a flint.hears() function setup:

```js
flint.hears(phrase, function(bot, trigger) {
  bot.<command>
    .then(function(returnedValue) {
      // do something with returned value
    })
    .catch(function(err) {
      // handle errors
    });
});
```

* `phrase` : This can be either a string or a regex pattern.
If a string, the string is matched against the first word in the room message.
message.
If a regex pattern is used, it is matched against the entire message text.
* `bot` : The bot object that is used to execute commands when the `phrase` is
triggered.
* `bot.<command>` : The Bot method to execute.
* `then` : Node JS Promise keyword that invokes additional logic once the
previous command is executed.
* `catch` : handle errors that happen at either the original command or in any
of the chained 'then' functions.
* `trigger` : The object that describes the details around what triggered the
`phrase`.
* `commands` : The commands that are ran when the `phrase` is heard.

## Authentication
The token used to authenticate Flint to the Spark API is passed as part of the
options used when instantiating the Flint class. To change or update the
token, use the Flint#setSparkToken() method.

**Example:**

```js
var newToken = 'Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u';

flint.setSparkToken(newToken)
.then(function(token) {
  console.log('token updated to: ' + token);
});
```

## Storage
The storage system used in flint is a simple key/value store and resolves around
these 3 methods:

* `bot.store(key, value)` - Store a value to a bot instance where 'key' is a
  string and 'value' is a boolean, number, string, array, or object. *This does
  not not support functions or any non serializable data.* Returns the value.
* `bot.recall(key)` - Recall a value by 'key' from a bot instance. Returns the
  value or undefined if not found.
* `bot.forget([key])` - Forget (remove) value(s) from a bot instance where 'key'
  is an optional property that when defined, removes the specific key, and when
  undefined, removes all keys.

When a bot despawns (removed from room), the key/value store for that bot
instance will automatically be removed from the store. Flint currently has an
in-memory store and a Redis based store. By default, the in-memory store is
used. Other backend stores are possible by replicating any one of the built-in
storage modules and passing it to the `flint.storeageDriver()` method.

The following app is titled "Hotel California" and demonstrates how to use
`bot.store()` and `bot.recall()`.

**Hotel California:**

```js
var Flint = require('node-flint');
var webhook = require('node-flint/webhook');
var RedisStore = require('node-flint/storage/redis'); // load driver
var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');

var app = express();
app.use(bodyParser.json());

// flint options
var config = {
  webhookUrl: 'http://myserver.com/flint',
  token: 'Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u',
  port: 80
};

// init flint
var flint = new Flint(config);

//start flint
flint.start();

// The Flint event is expecting a function that has a bot, person, and id parameter.
function checkin(eventBot, person, id) {
  // retrieve value of key 'htc'. When this is ran initially, this will return 'undefined'.
  var htc = eventBot.recall('htc');

  // if room bot has htc.enabled...
  if(eventBot && eventBot.active && htc.enabled) {
    // wait 5 seconds, add person back, and let them know they can never leave!
    setTimeout(() => {
      var email = person.emails[0];
      var name = person.displayName.split(' ')[0]; // reference first name

      // add person back to room...
      eventBot.add(email);

      // let person know  where they ended up...
      eventBot.say('<@personEmail:%s|%s>, you can **check out any time you like**, but you can **never** leave!', email, name);
    }, 5000); // 5000 ms = 5 seconds
  }
}

// set default messages to use markdown globally for this flint instance...
flint.messageFormat = 'markdown';

// check if htc is already active in room...
flint.on('spawn', bot => {
  // retrieve value of key 'htc'. When this is ran initially, this will return 'undefined'.
  var htc = bot.recall('htc');

  // if enabled...
  if(htc && htc.enabled) {
    // resume event
    bot.on('personExits', checkin);
  }
});

// open the hotel
flint.hears('open', function(bot, trigger) {
  // retrieve value of key 'htc'. When this is ran initially, this will return 'undefined'.
  var htc = bot.recall('htc');

  // if htc has not been initialized to bot memory...
  if(!htc) {
    // init key
    htc = bot.store('htc', {});

    // store default value
    htc.enabled = false;
  }

  // if not enabled...
  if(!htc.enabled) {
    htc.enabled = true;

    // create event
    bot.on('personExits', checkin);

    // announce Hotel California is open
    bot.say('**Hotel California** mode activated!');
  } else {
    // announce Hotel California is already open
    bot.say('**Hotel California** mode is already activated!');
  }
});

// close the hotel
flint.hears('close', function(bot, trigger) {
  // retrieve value of key 'htc'. When this is ran initially, this will return 'undefined'.
  var htc = bot.recall('htc');

  if(htc && htc.enabled) {
    htc.enabled = false;

    // remove event (removeListener is an inherited function from EventEmitter)
    bot.removeListener('personExits', checkin);

    // announce Hotel California is closed
    bot.say('**Hotel California** mode deactivated!');
  } else {
    // announce Hotel California is already closed
    bot.say('**Hotel California** mode is already deactivated!');
  }

});

// default message for unrecognized commands
flint.hears(/.*/, function(bot, trigger) {
  bot.say('You see a shimmering light, but it is growing dim...');
}, 20);

// define express path for incoming webhooks
app.post('/flint', webhook(flint));

// start express server
var server = app.listen(config.port, function () {
  flint.debug('Flint listening on port %s', config.port);
});

// gracefully shutdown (ctrl-c)
process.on('SIGINT', function() {
  flint.debug('stoppping...');
  server.close();
  flint.stop().then(function() {
    process.exit();
  });
});
```

## Bot Accounts

**When using "Bot Accounts" the major differences are:**

* Webhooks for message:created only trigger when the Bot is mentioned by name
* Unable to read messages in rooms using the Spark API

**Differences with trigger.args using Flint with a "Bot Account":**

The trigger.args array is a shortcut in processing the trigger.text string. It
consists of an array of the words that are in the trigger.message string split
by one or more spaces. Punctation is included if there is no space between the
symbol and the word. With bot accounts, this behaves a bit differently.

* If defining a `flint.hears()` using a string (not regex), `trigger.args` is a
  filtered array of words from the message that begin with the first match of
  the string.

    * For example if the message.text is `'Yo yo yo Bot, find me tacos!'` (where
      Bot is the mentioned name of the Bot Account) and the hears string is
      defined as `'find'`, then:
        * args[0] : `'find'`
        * args[1] : `'me'`
        * etc..

    * If the message text is "Hey, Find me tacos, Bot!", then:
        * args[0] : `'Find'`
        * args[1] : `'me'`
        * args[2] : `'tacos,'`
        * args[3] : `'Bot!'`

* If defining a flint.hears() using regex, the trigger.args array is the entire
  message.
