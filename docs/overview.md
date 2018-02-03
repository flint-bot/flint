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
  not not support functions or any non serializable data.* Returns the a promise
  with the value.
* `bot.recall(key)` - Recall a value by 'key' from a bot instance. Returns a
  resolved promise with the value or a rejected promise if not found.
* `bot.forget([key])` - Forget (remove) value(s) from a bot instance where 'key'
  is an optional property that when defined, removes the specific key, and when
  undefined, removes all keys. Returns a resolved promise if deleted or not found.

When a bot despawns (removed from room), the key/value store for that bot
instance will automatically be removed from the store. Flint currently has an
in-memory store and a Redis based store. By default, the in-memory store is
used. Other backend stores are possible by replicating any one of the built-in
storage modules and passing it to the `flint.storeageDriver()` method. *See
docs for store, recall, forget for more details.*

**Example:**

```js
var redisDriver = require('node-flint/storage/redis');
flint.storageDriver(redisDriver('redis://localhost'));
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
  filtered array of words from the message that begins *after* the first match of
  bot mention.

* If defining a flint.hears() using regex, the trigger.args array is the entire
  message.
