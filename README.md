# node-flint (v5)

### Spark Bot SDK for Node JS

## News

**x/x/x IMPORTANT:**

* Flint v5 is a huge refactor from v4. Before upgrading your existing apps to
use v5, please make sure to review all docs and examples to understand the new
class methods and library structure.

**See [CHANGELOG.md](/CHANGELOG.md) for details on changes to versions of Flint.**

## Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Installation](#installation)
    - [Via Git](#via-git)
    - [Via NPM](#via-npm)
    - [Example Template Using Express](#example-template-using-express)
    - [Other Examples](#other-examples)
- [Overview](#overview)
- [Authentication](#authentication)
- [Storage](#storage)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
## Installation

#### Via Git
```bash
mkdir myproj
cd myproj
git clone https://github.com/flint-bot/flint
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
const Flint = require('node-flint');
const express = require('express');
const bodyParser = require('body-parser');

// config
const config = {
  token: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
  port: 8080,
};

// init flint
const flint = new Flint(config);

// string match on 'hello'
flint.hears('hello', (bot, trigger) => {
  bot.message.say().markdown(`**Hello** ${trigger.personDisplayName}!`);
});

// setup express
const app = express();
app.use(bodyParser.json());

// add route for path that is listening for web hooks
app.post('/webhook', flint.spark.webhookListen());

// start express server
const server = app.listen(config.port, () => {
  // start flint
  flint.start();
  console.log(`Flint listening on port ${config.port}`);
});

// gracefully shutdown (ctrl-c)
process.on('SIGINT', () => {
  console.log('stopping...');
  server.close();
});
```

#### Other Examples

The following examples are included to show the flexibility and to help with a
quick setup to see how Flint Operates. After getting the basic setup working
and a bot responding in a Room, be sure to read the rest of the documentation
to learn about The more advanced features.

* [**Express with NGROK Example**](https://github.com/flint-bot/flint/blob/master/docs/example-ngrok.md)

* [**Restify Example**](https://github.com/flint-bot/flint/blob/master/docs/example2.md)

_More examples coming soon!_
## Overview

Most of Flint's functionality is based around the flint.hears function. This
defines the phrase or pattern the bot is listening for and what actions to take
when that phrase or pattern is matched. The flint.hears function gets a callback
than includes two objects. The bot object, and the trigger object.

A simple example of a flint.hears() function setup:

```js
flint.hears(phrase, (bot, trigger) => {
  bot.<command>
    .then((returnedValue) => {
      // do something with returnedValue
    })
    .catch(err => console.error(err));
});
```

## Authentication
The token used to authenticate Flint to the Spark API is passed as part of the
options used when instantiating the Flint class. To change or update the
token, use the Flint#sparkToken() method.

**Example:**

```js
var newToken = 'Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u';

flint.setSparkToken(newToken)
  .then((updatedToken) => {
    console.log(`Spark token updated to: ${updatedToken}`);
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
storage modules and passing it to the `flint.use()` method. *See
docs for store, recall, forget for more details.*

**Example:**

```js
// require RedisStore plugin
const RedisStore = require('node-flint/plugins/redis-store');

// after initializing flint but before flint.start()
flint.use('storage', new RedisStore({ url: 'redis://localhost' }));
```

# Flint Reference


## License

The MIT License (MIT)

Copyright (c) 2018 Nicholas Marus

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
