# node-flint (v4)

### Bot SDK for Node JS

## News

**2/22/17 IMPORTANT:**

* Note that Flint v4 is still using the node-sparky library version 3.1.19.
  However the repo for node-sparky is now on version 4 which has some major
  differences. This misalignment between Flint and Sparky version
  will be fixed in the next several weeks with the release of Flint v5. In the short
  term if you are accessing the spark object directly from Flint via
  `flint.spark` be sure to use the documentation for [node-sparky 3.1.19](https://github.com/flint-bot/sparky/tree/bcfe307a6b90f8ad3d26837c2bc06e48eb6328f4).  

**4.4.x Update**

* `bot.isDirectTo` property added. This is set to the email of the other
  conversant in rooms of type 'direct'.
* `trigger.raw` property added to `flint.hears` trigger callback object. This is
  the raw message without any processing to remove multiple spaces, CR/LF, or
  leading/trailing spaces.

**4.3.x Update**

* `bot.add()` and `bot.remove()` now return an array of successfully
  added / removed room membership emails rather than the bot object itself.
* Debug error messages for archived team rooms suppressed.

**4.2.x Update**

* Persistent Storage for `bot.store()`, `bot.recall()`, and `bot.forget()`
  through new modular storage functionality.
* Added in-memory storage module (default unless storage module is specified)
* Added Redis storage module
* Added boolean property flint.isUserAccount
* Added method `flint.storageDriver()` to define storage backend
* The `flint.hears()` method now can have a weight specified. This allows for
  overlapping and default actions.
* Auto detection of Bot accounts
* If Bot account is detected, the behavior of the `trigger.args` property inside
  the `flint.hears()` method performs additional parsing.

**Potential Breaking Changes in 4.2.x**

* `flint.machine` boolean property renamed to `flint.isBotAccount`

## Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
    - [Via Git](#via-git)
    - [Via NPM](#via-npm)
    - [Example Template Using Express](#example-template-using-express)
- [Overview](#overview)
- [Authentication](#authentication)
- [Storage](#storage)
- [Bot Accounts](#bot-accounts)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
## Installation

#### Via Git
```bash
mkdir myproj
cd myproj
git clone https://github.com/nmarus/flint
npm install ./flint
```

#### Via NPM
```bash
mkdir myproj
cd myproj
npm install node-flint
```
#### Example Template Using Express
```js
var Flint = require('node-flint');
var webhook = require('node-flint/webhook');
var express = require('express');
var bodyParser = require('body-parser');
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
flint.start();

// say hello
flint.hears('/hello', function(bot, trigger) {
  bot.say('Hello %s!', trigger.personDisplayName);
});

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

[**Restify Example**](https://github.com/nmarus/flint/blob/master/docs/example2.md)
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

# Flint Reference


## Classes

<dl>
<dt><a href="#Flint">Flint</a></dt>
<dd></dd>
<dt><a href="#Bot">Bot</a></dt>
<dd></dd>
</dl>

## Objects

<dl>
<dt><a href="#Message">Message</a> : <code>object</code></dt>
<dd><p>Message Object</p>
</dd>
<dt><a href="#File">File</a> : <code>object</code></dt>
<dd><p>File Object</p>
</dd>
<dt><a href="#Trigger">Trigger</a> : <code>object</code></dt>
<dd><p>Trigger Object</p>
</dd>
</dl>

## Events

<dl>
<dt><a href="#event_log">"log"</a></dt>
<dd><p>Flint log event.</p>
</dd>
<dt><a href="#event_stop">"stop"</a></dt>
<dd><p>Flint stop event.</p>
</dd>
<dt><a href="#event_start">"start"</a></dt>
<dd><p>Flint start event.</p>
</dd>
<dt><a href="#event_initialized">"initialized"</a></dt>
<dd><p>Flint initialized event.</p>
</dd>
<dt><a href="#event_roomLocked">"roomLocked"</a></dt>
<dd><p>Room Locked event.</p>
</dd>
<dt><a href="#event_roomUnocked">"roomUnocked"</a></dt>
<dd><p>Room Unocked event.</p>
</dd>
<dt><a href="#event_personEnters">"personEnters"</a></dt>
<dd><p>Person Enter Room event.</p>
</dd>
<dt><a href="#event_botAddedAsModerator">"botAddedAsModerator"</a></dt>
<dd><p>Bot Added as Room Moderator.</p>
</dd>
<dt><a href="#event_botRemovedAsModerator">"botRemovedAsModerator"</a></dt>
<dd><p>Bot Removed as Room Moderator.</p>
</dd>
<dt><a href="#event_personAddedAsModerator">"personAddedAsModerator"</a></dt>
<dd><p>Person Added as Moderator.</p>
</dd>
<dt><a href="#event_personRemovedAsModerator">"personRemovedAsModerator"</a></dt>
<dd><p>Person Removed as Moderator.</p>
</dd>
<dt><a href="#event_personExits">"personExits"</a></dt>
<dd><p>Person Exits Room.</p>
</dd>
<dt><a href="#event_mentioned">"mentioned"</a></dt>
<dd><p>Bot Mentioned.</p>
</dd>
<dt><a href="#event_message">"message"</a></dt>
<dd><p>Message Recieved.</p>
</dd>
<dt><a href="#event_files">"files"</a></dt>
<dd><p>File Recieved.</p>
</dd>
<dt><a href="#event_spawn">"spawn"</a></dt>
<dd><p>Bot Spawned.</p>
</dd>
<dt><a href="#event_despawn">"despawn"</a></dt>
<dd><p>Bot Despawned.</p>
</dd>
</dl>

<a name="Flint"></a>

## Flint
**Kind**: global class  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Flint UUID |
| active | <code>boolean</code> | Flint active state |
| intialized | <code>boolean</code> | Flint fully initialized |
| isBotAccount | <code>boolean</code> | Is Flint attached to Spark using a bot account? |
| isUserAccount | <code>boolean</code> | Is Flint attached to Spark using a user account? |
| person | <code>object</code> | Flint person object |
| email | <code>string</code> | Flint email |
| spark | <code>object</code> | The Spark instance used by flint |


* [Flint](#Flint)
    * [new Flint(options)](#new_Flint_new)
    * [.options](#Flint+options) : <code>object</code>
    * [.setSparkToken(token)](#Flint+setSparkToken) ⇒ <code>Promise.&lt;String&gt;</code>
    * [.stop()](#Flint+stop) ⇒ <code>Promise.&lt;Boolean&gt;</code>
    * [.start()](#Flint+start) ⇒ <code>Promise.&lt;Boolean&gt;</code>
    * [.restart()](#Flint+restart) ⇒ <code>Promise.&lt;Boolean&gt;</code>
    * [.getMessage(messageId)](#Flint+getMessage) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
    * [.getFiles(messageId)](#Flint+getFiles) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.hears(phrase, action, [helpText], [preference])](#Flint+hears) ⇒ <code>String</code>
    * [.clearHears(id)](#Flint+clearHears) ⇒ <code>null</code>
    * [.showHelp([header], [footer])](#Flint+showHelp) ⇒ <code>String</code>
    * [.setAuthorizer(Action)](#Flint+setAuthorizer) ⇒ <code>Boolean</code>
    * [.clearAuthorizer()](#Flint+clearAuthorizer) ⇒ <code>null</code>
    * [.storageDriver(Driver)](#Flint+storageDriver) ⇒ <code>null</code>
    * [.use(path)](#Flint+use) ⇒ <code>Boolean</code>

<a name="new_Flint_new"></a>

### new Flint(options)
Creates an instance of Flint.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | Configuration object containing Flint settings. |

**Example**  
```js
var options = {
  webhookUrl: 'http://myserver.com/flint',
  token: 'Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u'
};
var flint = new Flint(options);
```
<a name="Flint+options"></a>

### flint.options : <code>object</code>
Options Object

**Kind**: instance namespace of <code>[Flint](#Flint)</code>  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| token | <code>string</code> |  | Spark Token. |
| webhookUrl | <code>string</code> |  | URL that is used for SPark API to send callbacks. |
| webhookSecret | <code>string</code> |  | If specified, inbound webhooks are authorized before being processed. |
| messageFormat | <code>string</code> | <code>&quot;text&quot;</code> | Default Spark message format to use with bot.say(). |
| maxPageItems | <code>number</code> | <code>50</code> | Max results that the paginator uses. |
| maxConcurrent | <code>number</code> | <code>3</code> | Max concurrent sessions to the Spark API |
| minTime | <code>number</code> | <code>600</code> | Min time between consecutive request starts. |
| requeueMinTime | <code>number</code> | <code>minTime*10</code> | Min time between consecutive request starts of requests that have been re-queued. |
| requeueMaxRetry | <code>number</code> | <code>3</code> | Msx number of atteempts to make for failed request. |
| requeueCodes | <code>array</code> | <code>[429,500,503]</code> | Array of http result codes that should be retried. |
| requestTimeout | <code>number</code> | <code>20000</code> | Timeout for an individual request recieving a response. |
| queueSize | <code>number</code> | <code>10000</code> | Size of the buffer that holds outbound requests. |
| requeueSize | <code>number</code> | <code>10000</code> | Size of the buffer that holds outbound re-queue requests. |
| id | <code>string</code> | <code>&quot;random&quot;</code> | The id this instance of flint uses. |
| webhookRequestJSONLocation | <code>string</code> | <code>&quot;body&quot;</code> | The property under the Request to find the JSON contents. |
| removeWebhooksOnStart | <code>Boolean</code> | <code>true</code> | If you wish to have the bot remove all account webhooks when starting. |

<a name="Flint+setSparkToken"></a>

### flint.setSparkToken(token) ⇒ <code>Promise.&lt;String&gt;</code>
Tests, and then sets a new Spark Token.

**Kind**: instance method of <code>[Flint](#Flint)</code>  

| Param | Type | Description |
| --- | --- | --- |
| token | <code>String</code> | New Spark Token for Flint to use. |

**Example**  
```js
flint.setSparkToken('Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u')
  .then(function(token) {
     console.log('token updated to: ' + token);
  });
```
<a name="Flint+stop"></a>

### flint.stop() ⇒ <code>Promise.&lt;Boolean&gt;</code>
Stop Flint.

**Kind**: instance method of <code>[Flint](#Flint)</code>  
**Example**  
```js
flint.stop();
```
<a name="Flint+start"></a>

### flint.start() ⇒ <code>Promise.&lt;Boolean&gt;</code>
Start Flint.

**Kind**: instance method of <code>[Flint](#Flint)</code>  
**Example**  
```js
flint.start();
```
<a name="Flint+restart"></a>

### flint.restart() ⇒ <code>Promise.&lt;Boolean&gt;</code>
Restart Flint.

**Kind**: instance method of <code>[Flint](#Flint)</code>  
**Example**  
```js
flint.restart();
```
<a name="Flint+getMessage"></a>

### flint.getMessage(messageId) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
Get Message Object by ID

**Kind**: instance method of <code>[Flint](#Flint)</code>  

| Param | Type | Description |
| --- | --- | --- |
| messageId | <code>String</code> | Message ID from Spark API. |

<a name="Flint+getFiles"></a>

### flint.getFiles(messageId) ⇒ <code>Promise.&lt;Array&gt;</code>
Get Files from Message Object by ID

**Kind**: instance method of <code>[Flint](#Flint)</code>  

| Param | Type | Description |
| --- | --- | --- |
| messageId | <code>String</code> | Message ID from Spark API. |

<a name="Flint+hears"></a>

### flint.hears(phrase, action, [helpText], [preference]) ⇒ <code>String</code>
Add action to be performed when bot hears a phrase.

**Kind**: instance method of <code>[Flint](#Flint)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| phrase | <code>Regex</code> &#124; <code>String</code> |  | The phrase as either a regex or string. If regex, matches on entire message.If string, matches on first word. |
| action | <code>function</code> |  | The function to execute when phrase is matched. Function is executed with 2 variables. Trigger and Bot. The Trigger Object contains information about the person who entered a message that matched the phrase. The Bot Object is an instance of the Bot Class as it relates to the room the message was heard. |
| [helpText] | <code>String</code> |  | The string of text that describes how this command operates. |
| [preference] | <code>Number</code> | <code>0</code> | Specifies preference of phrase action when overlapping phrases are matched. On multiple matches with same preference, all matched actions are excuted. On multiple matches with difference preference values, only the lower preferenced matched action(s) are executed. |

**Example**  
```js
// using a string to match first word and defines help text
flint.hears('/say', function(bot, trigger, id) {
  bot.say(trigger.args.slice(1, trigger.arges.length - 1));
}, '/say <greeting> - Responds with a greeting');
```
**Example**  
```js
// using regex to match across entire message
flint.hears(/(^| )beer( |.|$)/i, function(bot, trigger, id) {
  bot.say('Enjoy a beer, %s! 🍻', trigger.personDisplayName);
});
```
<a name="Flint+clearHears"></a>

### flint.clearHears(id) ⇒ <code>null</code>
Remove a "flint.hears()" entry.

**Kind**: instance method of <code>[Flint](#Flint)</code>  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> | The "hears" ID. |

**Example**  
```js
// using a string to match first word and defines help text
var hearsHello = flint.hears('/flint', function(bot, trigger, id) {
  bot.say('Hello %s!', trigger.personDisplayName);
});
flint.clearHears(hearsHello);
```
<a name="Flint+showHelp"></a>

### flint.showHelp([header], [footer]) ⇒ <code>String</code>
Display help for registered Flint Commands.

**Kind**: instance method of <code>[Flint](#Flint)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [header] | <code>String</code> | <code>Usage:</code> | String to use in header before displaying help message. |
| [footer] | <code>String</code> | <code>Powered by Flint - https://github.com/nmarus/flint</code> | String to use in footer before displaying help message. |

**Example**  
```js
flint.hears('/help', function(bot, trigger, id) {
  bot.say(flint.showHelp());
});
```
<a name="Flint+setAuthorizer"></a>

### flint.setAuthorizer(Action) ⇒ <code>Boolean</code>
Attaches authorizer function.

**Kind**: instance method of <code>[Flint](#Flint)</code>  

| Param | Type | Description |
| --- | --- | --- |
| Action | <code>function</code> | The function to execute when phrase is matched to authenticate a user.  The function is passed the bot, trigger, and id and expects a return value of true or false. |

**Example**  
```js
function myAuthorizer(bot, trigger, id) {
  if(trigger.personEmail === 'john@test.com') {
    return true;
  }
  else if(trigger.personDomain === 'test.com') {
    return true;
  }
  else {
    return false;
  }
}
flint.setAuthorizer(myAuthorizer);
```
<a name="Flint+clearAuthorizer"></a>

### flint.clearAuthorizer() ⇒ <code>null</code>
Removes authorizer function.

**Kind**: instance method of <code>[Flint](#Flint)</code>  
**Example**  
```js
flint.clearAuthorizer();
```
<a name="Flint+storageDriver"></a>

### flint.storageDriver(Driver) ⇒ <code>null</code>
Defines storage backend.

**Kind**: instance method of <code>[Flint](#Flint)</code>  

| Param | Type | Description |
| --- | --- | --- |
| Driver | <code>function</code> | The storage driver. |

**Example**  
```js
// define memory store (default if not specified)
flint.storageDriver(new MemStore());
```
<a name="Flint+use"></a>

### flint.use(path) ⇒ <code>Boolean</code>
Load a Plugin from a external file.

**Kind**: instance method of <code>[Flint](#Flint)</code>  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>String</code> | Load a plugin at given path. |

**Example**  
```js
flint.use('events.js');
```
**Example**  
```js
// events.js
module.exports = function(flint) {
  flint.on('spawn', function(bot) {
    console.log('new bot spawned in room: %s', bot.myroom.title);
  });
  flint.on('despawn', function(bot) {
    console.log('bot despawned in room: %s', bot.myroom.title);
  });
  flint.on('messageCreated', function(message, bot) {
    console.log('"%s" said "%s" in room "%s"', message.personEmail, message.text, bot.myroom.title);
  });
};
```
<a name="Bot"></a>

## Bot
**Kind**: global class  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Bot UUID |
| active | <code>boolean</code> | Bot active state |
| person | <code>object</code> | Bot Person Object |
| email | <code>string</code> | Bot email |
| team | <code>object</code> | Bot team object |
| room | <code>object</code> | Bot room object |
| membership | <code>object</code> | Bot membership object |
| isLocked | <code>boolean</code> | If bot is locked |
| isModerator | <code>boolean</code> | If bot is a moderator |
| isGroup | <code>boolean</code> | If bot is in Group Room |
| isDirect | <code>boolean</code> | If bot is in 1:1/Direct Room |
| isDirectTo | <code>string</code> | Recipient Email if bot is in 1:1/Direct Room |
| isTeam | <code>boolean</code> | If bot is in Team Room |
| lastActivity | <code>date</code> | Last bot activity |


* [Bot](#Bot)
    * [new Bot(flint)](#new_Bot_new)
    * [.exit()](#Bot+exit) ⇒ <code>Promise.&lt;Boolean&gt;</code>
    * [.add(email(s), [moderator])](#Bot+add) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.remove(email(s))](#Bot+remove) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.getModerators()](#Bot+getModerators) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.newRoom(name, emails)](#Bot+newRoom) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.newTeamRoom(name, emails)](#Bot+newTeamRoom) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.moderateRoom()](#Bot+moderateRoom) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.unmoderateRoom()](#Bot+unmoderateRoom) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.moderatorSet(email(s))](#Bot+moderatorSet) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.moderatorClear(email(s))](#Bot+moderatorClear) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.implode()](#Bot+implode) ⇒ <code>Promise.&lt;Boolean&gt;</code>
    * [.say([format], message)](#Bot+say) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
    * [.dm(email, [format], message)](#Bot+dm) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
    * [.uploadStream(filename, stream)](#Bot+uploadStream) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
    * [.upload(filepath)](#Bot+upload) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
    * [.censor(messageId)](#Bot+censor) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
    * [.roomRename(title)](#Bot+roomRename) ⇒ <code>Promise.&lt;Room&gt;</code>
    * [.getMessages(count)](#Bot+getMessages) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.store(id, key, value)](#Bot+store) ⇒ <code>String</code> &#124; <code>Number</code> &#124; <code>Boolean</code> &#124; <code>Array</code> &#124; <code>Object</code>
    * [.recall(id, key)](#Bot+recall) ⇒ <code>String</code> &#124; <code>Number</code> &#124; <code>Boolean</code> &#124; <code>Array</code> &#124; <code>Object</code> &#124; <code>undefined</code>
    * [.forget(id, [key])](#Bot+forget) ⇒ <code>Boolean</code>

<a name="new_Bot_new"></a>

### new Bot(flint)
Creates a Bot instance that is then attached to a Spark Room.


| Param | Type | Description |
| --- | --- | --- |
| flint | <code>Object</code> | The flint object this Bot spawns under. |

<a name="Bot+exit"></a>

### bot.exit() ⇒ <code>Promise.&lt;Boolean&gt;</code>
Instructs Bot to exit from room.

**Kind**: instance method of <code>[Bot](#Bot)</code>  
**Example**  
```js
bot.exit();
```
<a name="Bot+add"></a>

### bot.add(email(s), [moderator]) ⇒ <code>Promise.&lt;Array&gt;</code>
Instructs Bot to add person(s) to room.

**Kind**: instance method of <code>[Bot](#Bot)</code>  
**Returns**: <code>Promise.&lt;Array&gt;</code> - Array of emails added  

| Param | Type | Description |
| --- | --- | --- |
| email(s) | <code>String</code> &#124; <code>Array</code> | Email Address (or Array of Email Addresses) of Person(s) to add to room. |
| [moderator] | <code>Boolean</code> | Add as moderator. |

**Example**  
```js
// add one person to room by email
bot.add('john@test.com');
```
**Example**  
```js
// add one person as moderator to room by email
bot.add('john@test.com', true)
  .catch(function(err) {
    // log error if unsuccessful
    console.log(err.message);
  });
```
**Example**  
```js
// add 3 people to room by email
bot.add(['john@test.com', 'jane@test.com', 'bill@test.com']);
```
<a name="Bot+remove"></a>

### bot.remove(email(s)) ⇒ <code>Promise.&lt;Array&gt;</code>
Instructs Bot to remove person from room.

**Kind**: instance method of <code>[Bot](#Bot)</code>  
**Returns**: <code>Promise.&lt;Array&gt;</code> - Array of emails removed  

| Param | Type | Description |
| --- | --- | --- |
| email(s) | <code>String</code> &#124; <code>Array</code> | Email Address (or Array of Email Addresses) of Person(s) to remove from room. |

**Example**  
```js
// remove one person to room by email
bot.remove('john@test.com');
```
**Example**  
```js
// remove 3 people from room by email
bot.remove(['john@test.com', 'jane@test.com', 'bill@test.com']);
```
<a name="Bot+getModerators"></a>

### bot.getModerators() ⇒ <code>Promise.&lt;Array&gt;</code>
Get room moderators.

**Kind**: instance method of <code>[Bot](#Bot)</code>  
**Example**  
```js
bot.getModerators()
  .then(function(moderators) {
    console.log(moderators);
  });
```
<a name="Bot+newRoom"></a>

### bot.newRoom(name, emails) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
Create new room with people by email

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | Name of room. |
| emails | <code>Array</code> | Emails of people to add to room. |

<a name="Bot+newTeamRoom"></a>

### bot.newTeamRoom(name, emails) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
Create new Team Room

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>String</code> | Name of room. |
| emails | <code>Array</code> | Emails of people to add to room. |

<a name="Bot+moderateRoom"></a>

### bot.moderateRoom() ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
Enable Room Moderation.Enable.

**Kind**: instance method of <code>[Bot](#Bot)</code>  
**Example**  
```js
bot.moderateRoom()
  .then(function(err) {
    console.log(err.message)
  });
```
<a name="Bot+unmoderateRoom"></a>

### bot.unmoderateRoom() ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
Disable Room Moderation.

**Kind**: instance method of <code>[Bot](#Bot)</code>  
**Example**  
```js
bot.unmoderateRoom()
  .then(function(err) {
    console.log(err.message)
  });
```
<a name="Bot+moderatorSet"></a>

### bot.moderatorSet(email(s)) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
Assign Moderator in Room

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Description |
| --- | --- | --- |
| email(s) | <code>String</code> &#124; <code>Array</code> | Email Address (or Array of Email Addresses) of Person(s) to assign as moderator. |

**Example**  
```js
bot.moderatorSet('john@test.com')
  .then(function(err) {
    console.log(err.message)
  });
```
<a name="Bot+moderatorClear"></a>

### bot.moderatorClear(email(s)) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
Unassign Moderator in Room

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Description |
| --- | --- | --- |
| email(s) | <code>String</code> &#124; <code>Array</code> | Email Address (or Array of Email Addresses) of Person(s) to unassign as moderator. |

**Example**  
```js
bot.moderatorClear('john@test.com')
  .then(function(err) {
    console.log(err.message)
  });
```
<a name="Bot+implode"></a>

### bot.implode() ⇒ <code>Promise.&lt;Boolean&gt;</code>
Remove a room and all memberships.

**Kind**: instance method of <code>[Bot](#Bot)</code>  
**Example**  
```js
flint.hears('/implode', function(bot, trigger) {
  bot.implode();
});
```
<a name="Bot+say"></a>

### bot.say([format], message) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
Send text with optional file to room.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [format] | <code>String</code> | <code>text</code> | Set message format. Valid options are 'text' or 'markdown'. |
| message | <code>String</code> &#124; <code>Object</code> |  | Message to send to room. This can be a simple string, or a object for advanced use. |

**Example**  
```js
// Simple example
flint.hears('/hello', function(bot, trigger) {
  bot.say('hello');
});
```
**Example**  
```js
// Simple example to send message and file
flint.hears('/file', function(bot, trigger) {
  bot.say({text: 'Here is your file!', file: 'http://myurl/file.doc'});
});
```
**Example**  
```js
// Markdown Method 1 - Define markdown as default
flint.messageFormat = 'markdown';
flint.hears('/hello', function(bot, trigger) {
  bot.say('**hello**, How are you today?');
});
```
**Example**  
```js
// Markdown Method 2 - Define message format as part of argument string
flint.hears('/hello', function(bot, trigger) {
  bot.say('markdown', '**hello**, How are you today?');
});
```
**Example**  
```js
// Mardown Method 3 - Use an object (use this method of bot.say() when needing to send a file in the same message as markdown text.
flint.hears('/hello', function(bot, trigger) {
  bot.say({markdown: '*Hello <@personEmail:' + trigger.personEmail + '|' + trigger.personDisplayName + '>*'});
});
```
<a name="Bot+dm"></a>

### bot.dm(email, [format], message) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
Send text with optional file in a direct message. This sends a message to a 1:1 room with the user (creates 1:1, if one does not already exist)

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| email | <code>String</code> |  | Email of person to send Direct Message. |
| [format] | <code>String</code> | <code>text</code> | Set message format. Valid options are 'text' or 'markdown'. |
| message | <code>String</code> &#124; <code>Object</code> |  | Message to send to room. This can be a simple string, or a object for advanced use. |

**Example**  
```js
// Simple example
flint.hears('/dm', function(bot, trigger) {
  bot.dm('someone@domain.com', 'hello');
});
```
**Example**  
```js
// Simple example to send message and file
flint.hears('/dm', function(bot, trigger) {
  bot.dm('someone@domain.com', {text: 'Here is your file!', file: 'http://myurl/file.doc'});
});
```
**Example**  
```js
// Markdown Method 1 - Define markdown as default
flint.messageFormat = 'markdown';
flint.hears('/dm', function(bot, trigger) {
  bot.dm('someone@domain.com', '**hello**, How are you today?');
});
```
**Example**  
```js
// Markdown Method 2 - Define message format as part of argument string
flint.hears('/dm', function(bot, trigger) {
  bot.dm('someone@domain.com', 'markdown', '**hello**, How are you today?');
});
```
**Example**  
```js
// Mardown Method 3 - Use an object (use this method of bot.dm() when needing to send a file in the same message as markdown text.
flint.hears('/dm', function(bot, trigger) {
  bot.dm('someone@domain.com', {markdown: '*Hello <@personEmail:' + trigger.personEmail + '|' + trigger.personDisplayName + '>*'});
});
```
<a name="Bot+uploadStream"></a>

### bot.uploadStream(filename, stream) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
Upload a file to a room using a Readable Stream

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Description |
| --- | --- | --- |
| filename | <code>String</code> | File name used when uploading to room |
| stream | <code>Stream.Readable</code> | Stream Readable |

**Example**  
```js
flint.hears('/file', function(bot, trigger) {

  // define filename used when uploading to room
  var filename = 'test.png';

  // create readable stream
  var stream = fs.createReadStream('/my/file/test.png');

  bot.uploadStream(filename, stream);
});
```
<a name="Bot+upload"></a>

### bot.upload(filepath) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
Upload a file to room.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Description |
| --- | --- | --- |
| filepath | <code>String</code> | File Path to upload |

**Example**  
```js
flint.hears('/file', function(bot, trigger) {
  bot.upload('test.png');
});
```
<a name="Bot+censor"></a>

### bot.censor(messageId) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
Remove Message By Id.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type |
| --- | --- |
| messageId | <code>String</code> | 

<a name="Bot+roomRename"></a>

### bot.roomRename(title) ⇒ <code>Promise.&lt;Room&gt;</code>
Set Title of Room.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type |
| --- | --- |
| title | <code>String</code> | 

**Example**  
```js
bot.roomRename('My Renamed Room')
  .then(function(err) {
    console.log(err.message)
  });
```
<a name="Bot+getMessages"></a>

### bot.getMessages(count) ⇒ <code>Promise.&lt;Array&gt;</code>
Get messages from room. Returned data has newest message at bottom.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type |
| --- | --- |
| count | <code>Integer</code> | 

**Example**  
```js
bot.getMessages(5).then(function(messages) {
  messages.forEach(function(message) {
    // display message text
    if(message.text) {
      console.log(message.text);
    }
  });
});
```
<a name="Bot+store"></a>

### bot.store(id, key, value) ⇒ <code>String</code> &#124; <code>Number</code> &#124; <code>Boolean</code> &#124; <code>Array</code> &#124; <code>Object</code>
Store key/value data.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type |
| --- | --- |
| id | <code>String</code> | 
| key | <code>String</code> | 
| value | <code>String</code> &#124; <code>Number</code> &#124; <code>Boolean</code> &#124; <code>Array</code> &#124; <code>Object</code> | 

<a name="Bot+recall"></a>

### bot.recall(id, key) ⇒ <code>String</code> &#124; <code>Number</code> &#124; <code>Boolean</code> &#124; <code>Array</code> &#124; <code>Object</code> &#124; <code>undefined</code>
Recall value of data stored by 'key'.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type |
| --- | --- |
| id | <code>String</code> | 
| key | <code>String</code> | 

<a name="Bot+forget"></a>

### bot.forget(id, [key]) ⇒ <code>Boolean</code>
Forget a key or entire store.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>String</code> |  |
| [key] | <code>String</code> | Optional key value to forget. If key is not passed, id is removed. |

<a name="Message"></a>

## Message : <code>object</code>
Message Object

**Kind**: global namespace  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Message ID |
| personId | <code>string</code> | Person ID |
| personEmail | <code>string</code> | Person Email |
| personAvatar | <code>string</code> | PersonAvatar URL |
| personDomain | <code>string</code> | Person Domain Name |
| personDisplayName | <code>string</code> | Person Display Name |
| roomId | <code>string</code> | Room ID |
| text | <code>string</code> | Message text |
| files | <code>array</code> | Array of File objects |
| created | <code>date</code> | Date Message created |

<a name="File"></a>

## File : <code>object</code>
File Object

**Kind**: global namespace  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Spark API Content ID |
| name | <code>string</code> | File name |
| ext | <code>string</code> | File extension |
| type | <code>string</code> | Header [content-type] for file |
| binary | <code>buffer</code> | File contents as binary |
| base64 | <code>string</code> | File contents as base64 encoded string |
| personId | <code>string</code> | Person ID of who added file |
| personEmail | <code>string</code> | Person Email of who added file |
| personAvatar | <code>string</code> | PersonAvatar URL |
| personDomain | <code>string</code> | Person Domain Name |
| personDisplayName | <code>string</code> | Person Display Name |
| created | <code>date</code> | Date file was added to room |

<a name="Trigger"></a>

## Trigger : <code>object</code>
Trigger Object

**Kind**: global namespace  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Message ID |
| phrase | <code>string</code> &#124; <code>regex</code> | Matched lexicon phrase |
| text | <code>string</code> | Message Text (or false if no text) |
| raw | <code>string</code> | Unprocessed Message Text (or false if no text) |
| html | <code>string</code> | Message HTML (or false if no html) |
| markdown | <code>string</code> | Message Markdown (or false if no markdown) |
| mentionedPeople | <code>array</code> | Mentioned People (or false if no mentioned) |
| files | <code>array</code> | Message Files (or false if no files in trigger) |
| args | <code>array</code> | Filtered array of words in message text. |
| created | <code>date</code> | Message Created date |
| roomId | <code>string</code> | Room ID |
| roomTitle | <code>string</code> | Room Title |
| roomType | <code>string</code> | Room Type (group or direct) |
| roomIsLocked | <code>boolean</code> | Room Locked/Moderated status |
| personId | <code>string</code> | Person ID |
| personEmail | <code>string</code> | Person Email |
| personDisplayName | <code>string</code> | Person Display Name |
| personUsername | <code>string</code> | Person Username |
| personDomain | <code>string</code> | Person Domain name |
| personAvatar | <code>string</code> | Person Avatar URL |
| personMembership | <code>object</code> | Person Membership object for person |

<a name="event_log"></a>

## "log"
Flint log event.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | Log Message |

<a name="event_stop"></a>

## "stop"
Flint stop event.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Flint UUID |

<a name="event_start"></a>

## "start"
Flint start event.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Flint UUID |

<a name="event_initialized"></a>

## "initialized"
Flint initialized event.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| id | <code>string</code> | Flint UUID |

<a name="event_roomLocked"></a>

## "roomLocked"
Room Locked event.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| id | <code>string</code> | Flint UUID |

<a name="event_roomUnocked"></a>

## "roomUnocked"
Room Unocked event.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| id | <code>string</code> | Flint UUID |

<a name="event_personEnters"></a>

## "personEnters"
Person Enter Room event.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| person | <code>object</code> | Person Object |
| id | <code>string</code> | Flint UUID |

<a name="event_botAddedAsModerator"></a>

## "botAddedAsModerator"
Bot Added as Room Moderator.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| id | <code>string</code> | Flint UUID |

<a name="event_botRemovedAsModerator"></a>

## "botRemovedAsModerator"
Bot Removed as Room Moderator.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| id | <code>string</code> | Flint UUID |

<a name="event_personAddedAsModerator"></a>

## "personAddedAsModerator"
Person Added as Moderator.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| person | <code>object</code> | Person Object |
| id | <code>string</code> | Flint UUID |

<a name="event_personRemovedAsModerator"></a>

## "personRemovedAsModerator"
Person Removed as Moderator.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| person | <code>object</code> | Person Object |
| id | <code>string</code> | Flint UUID |

<a name="event_personExits"></a>

## "personExits"
Person Exits Room.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| person | <code>object</code> | Person Object |
| id | <code>string</code> | Flint UUID |

<a name="event_mentioned"></a>

## "mentioned"
Bot Mentioned.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| trigger | <code>object</code> | Trigger Object |
| id | <code>string</code> | Flint UUID |

<a name="event_message"></a>

## "message"
Message Recieved.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| trigger | <code>object</code> | Trigger Object |
| id | <code>string</code> | Flint UUID |

<a name="event_files"></a>

## "files"
File Recieved.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| trigger | <code>trigger</code> | Trigger Object |
| id | <code>string</code> | Flint UUID |

<a name="event_spawn"></a>

## "spawn"
Bot Spawned.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| id | <code>string</code> | Flint UUID |

<a name="event_despawn"></a>

## "despawn"
Bot Despawned.

**Kind**: event emitted  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| bot | <code>object</code> | Bot Object |
| id | <code>string</code> | Flint UUID |

## License

The MIT License (MIT)

Copyright (c) 2016-2017

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
