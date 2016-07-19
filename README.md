# node-flint

Cisco Spark Bot SDK for Node JS (Version 4)

***If you are coming from using node-flint version 3.x or earlier, note that the 
architecture, commands, and some variable names have changed. While this release 
is similar to previous versions, there are some major differences. Please read 
the API docs below before migrating your code to this release. If you are 
looking for the old release version, node-flint@3.0.7 is still available to be 
installed through NPM.***
## Example #1 Using Express
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
## Example #2 Using Restify
```js
var Flint = require('node-flint');
var webhook = require('node-flint/webhook');
var Restify = require('restify');
var server = Restify.createServer();
server.use(Restify.bodyParser());

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

// define restify path for incoming webhooks
server.post('/flint', webhook(flint));

// start restify server
server.listen(config.port, function () {
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
## Features

* Utilizes [node-sparky](https://gitbub.com/nmarus/node-sparky). As such, 
  includes the following node-sparky features:
  * Built in rate limiter and outbound queue that allows control over the number 
    of parallel API calls and the minimum time between each call.
  * Transparently handles some (429, 500, 502) errors and re-queues the request.
  * File processor for retrieving attachments from room
  * Event emitters tied to request, response, error, retry, and queue drops.
  * Returns promises that comply with A+ standards..
  * Handles pagination transparently. (Receive unlimited records)
  * **(new)** Support for Spark API Advanced Webhooks
  * **(new)** Support Teams API
  * **(new)** Support for markdown formatted messages
  * **(new)** Support for [authenticated HMAC-SHA1 webhooks](https://developer.ciscospark.com/webhooks-explained.html#sensitive-data)
* Flint can now be easily embedded into existing Express, Restify, or other 
  Connect based apps.
* Flint can be used for building standalone bot "scripts", but also web applications 
  that interact with Spark API.

## Overview

Most of FLint's functionality is based around the flint.hears function. This 
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
If a string, the string is matched against the forst word in the room message. 
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

### Node JS Promises
Flint version 4 makes use Node JS promises verses using callbacks as was the 
case in previous versions. It is not necessary to process the promise returned 
from the Flint command in most cases, but this can also be used for creating
chains of logic that proceed based on the success of the previous command. It 
also allows a single error handler for the entire chain.

All promises returned by Flint functions comply with
[A+ standards](https://promisesaplus.com/).

A simple example of using promises vs using callbacks. More complicated logic 
can lead to waht is termed [callback hell](callback hell) and heavy use of the 
async library without careful planning. Promises make this less  of a challenge.

```js
// callback version Flint 3.x
flint.hears('/add', function(bot, trigger) {
  var email = trigger.args[0];
  
  bot.add(email, function(err, membership) {
    if(err) {
      console.log(err);
    } else {
      bot.say('Flint was not able to add %s to this room', email, function(err) {
        if(err) {
         console.log(err);
        }
      });
    }
  })
});


// Promise Example with arrow functions in version Flint 4.x
flint.hears('/add', (bot, trigger) => {
  var email = trigger.args[1];
  
  bot.add(email)
    .then(membership => membership.personEmail)
    .then(email => {
      return bot.say('Flint has added %s to this room %s', email, trigger.displayName);
    })
    .catch(function(err) {
      console.log(err);
    });
});
```

#### Authentication
The token used to authenticate Flint to the Spark API is passed as part of the
options used when instantiating the Flint class. To change or update the
token, use the Flint#setSparkToken() method.

###### Example:

```js
var newToken = 'Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u';

flint.setSparkToken(newToken)
  .then(function(token) {
    console.log('token updated to: ' + token);
  };
```
## Installation

##### Via Git
```bash
mkdir myproj
cd myproj
git clone https://github.com/nmarus/flint
npm install ./flint
```

##### Via NPM:
```bash
mkdir myproj
cd myproj
npm install node-flint
```
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
<dt><a href="#event_hears">"hears"</a></dt>
<dd><p>Flint Hears.</p>
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
| machine | <code>boolean</code> | Is Flint attached to Spark using a machine account? |
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
    * [.hears(phrase, action, [helpText])](#Flint+hears) ⇒ <code>String</code>
    * [.clearHears(id)](#Flint+clearHears) ⇒ <code>null</code>
    * [.showHelp([header], [footer])](#Flint+showHelp) ⇒ <code>String</code>
    * [.setAuthorizer(Action)](#Flint+setAuthorizer) ⇒ <code>Boolean</code>
    * [.clearAuthorizer()](#Flint+clearAuthorizer) ⇒ <code>null</code>
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

### flint.hears(phrase, action, [helpText]) ⇒ <code>String</code>
Add action to be performed when bot hears a phrase.

**Kind**: instance method of <code>[Flint](#Flint)</code>  

| Param | Type | Description |
| --- | --- | --- |
| phrase | <code>Regex</code> &#124; <code>String</code> | The phrase as either a regex or string. If  regex, matches on entire message.If string, matches on first word. |
| action | <code>function</code> | The function to execute when phrase is matched.  Function is executed with 2 variables. Trigger and Bot. The Trigger Object  contains information about the person who entered a message that matched the  phrase. The Bot Object is an instance of the Bot Class as it relates to the  room the message was heard. |
| [helpText] | <code>String</code> | The string of text that describes how this command operates. |

**Example**  
```js
// using a string to match first word and defines help text
flint.hears('/flint', function(bot, trigger, id) {
  bot.say('Hello %s!', trigger.personDisplayName);
}, 'Responds with a greeting.');
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
| [header] | <code>String</code> | <code>Usage:\n\n</code> | String to use in header before displaying help message. |
| [footer] | <code>String</code> | <code>\nPowered by Flint - https://github.com/nmarus/flint\n\n</code> | String to use in footer before displaying help message. |

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
| Action | <code>function</code> | The function to execute when phrase is matched  to authenticate a user.  The function is passed the bot, trigger, and id and  expects a return value of true or false. |

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
| isGroup | <code>boolean</code> | If bot is Group |
| isDirect | <code>boolean</code> | If bot is 1:1/Direct |
| isTeam | <code>boolean</code> | if bot is in Team |
| lastActivity | <code>date</code> | Last bot activity |


* [Bot](#Bot)
    * [new Bot(flint)](#new_Bot_new)
    * [.exit()](#Bot+exit) ⇒ <code>Promise.&lt;Boolean&gt;</code>
    * [.add(email(s), [moderator])](#Bot+add) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.remove(email(s))](#Bot+remove) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.getModerators()](#Bot+getModerators) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.newRoom(name, emails)](#Bot+newRoom) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.newTeamRoom(name, emails)](#Bot+newTeamRoom) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.moderateRoom()](#Bot+moderateRoom) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.unmoderateRoom()](#Bot+unmoderateRoom) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.moderatorSet(email(s))](#Bot+moderatorSet) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.moderatorClear(email(s))](#Bot+moderatorClear) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
    * [.implode()](#Bot+implode) ⇒ <code>Promise.&lt;Boolean&gt;</code>
    * [.say(message)](#Bot+say) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
    * [.uploadStream(filename, stream)](#Bot+uploadStream) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
    * [.upload(filepath)](#Bot+upload) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
    * [.dm(email, message)](#Bot+dm) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
    * [.roomRename(title)](#Bot+roomRename) ⇒ <code>Promise.&lt;Room&gt;</code>
    * [.getMessages(count)](#Bot+getMessages) ⇒ <code>Promise.&lt;Array&gt;</code>

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

### bot.add(email(s), [moderator]) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
Instructs Bot to add person(s) to room.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

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

### bot.remove(email(s)) ⇒ <code>[Promise.&lt;Bot&gt;](#Bot)</code>
Instructs Bot to remove person from room.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

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

### bot.say(message) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
Send text with optional file to room.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Description |
| --- | --- | --- |
| message | <code>String</code> &#124; <code>Object</code> | Message to send to room as either string or object. |

**Example**  
```js
flint.hears('/hello', function(bot, trigger) {
  bot.say('hello');
});
```
**Example**  
```js
flint.hears('/hello', function(bot, trigger) {
  bot.say({markdown: '*Hello <@personEmail:' + trigger.personEmail + '|' + trigger.personDisplayName + '>*'});
});
```
**Example**  
```js
flint.hears('/file', function(bot, trigger) {
  bot.say({text: 'Here is your file!', file: 'http://myurl/file.doc'});
});
```
<a name="Bot+uploadStream"></a>

### bot.uploadStream(filename, stream) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
Stream a file to room.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Description |
| --- | --- | --- |
| filename | <code>String</code> | File name used when uploading to room |
| stream | <code>Stream</code> | Stream Readable |

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
<a name="Bot+dm"></a>

### bot.dm(email, message) ⇒ <code>[Promise.&lt;Message&gt;](#Message)</code>
Send text with optional file in a direct message.

**Kind**: instance method of <code>[Bot](#Bot)</code>  

| Param | Type | Description |
| --- | --- | --- |
| email | <code>String</code> | Email of person to send Direct Message. |
| message | <code>String</code> &#124; <code>Object</code> | Message to send to room as either string or object. |

**Example**  
```js
flint.hears('/dm', function(bot, trigger) {
  var email = trigger.args[1];
  bot.dm(email, 'hello');
});
```
**Example**  
```js
flint.hears('/dm', function(bot, trigger) {
  var email = trigger.args[1];
  bot.dm(email, {text: 'hello', file: 'http://myurl/file.doc'});
});
```
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
| text | <code>string</code> | Message Text |
| html | <code>string</code> | Message HTML |
| markdown | <code>string</code> | Message Markdown |
| mentionedPeople | <code>array</code> | Mentioned People |
| phrase | <code>string</code> &#124; <code>regex</code> | Matched lexicon phrase |
| files | <code>array</code> | Message Files |
| args | <code>array</code> | Message Text as array |
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

<a name="event_hears"></a>

## "hears"
Flint Hears.

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

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.