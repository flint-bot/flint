# node-flint (v5)

### Webex Teams (formerly Spark) Bot SDK for Node JS

## News

**x/x/x IMPORTANT:**

* Flint v5 is a huge refactor from v4. Before upgrading your existing bots to
use v5, please make sure to review all docs and examples to understand the new
class methods and library structure.

* Flint no longer supports tokens from non Bot Accounts. This has become
necessary due to the various difference between a bot and person token.
Additionally Cisco does not support nor endorse using a person token for bots.
Applications that require this functionality should be defined as a "App"
integration. You can read more about the differences between bots and apps
[here](https://developer.webex.com/bots.html#bots-vs-integrations). If you
are looking for a framework that uses a "person" token and integrates easier
into "App" integrations, check out either
[node-sparky](https://github.com/flint-bot/sparky) or the Cisco
[spark-js-sdk](https://github.com/ciscospark/spark-js-sdk).

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
    - [Bot Object](#bot-object)
    - [Trigger Object](#trigger-object)
- [Authorization](#authorization)
  - [Domain Name Authorization](#domain-name-authorization)
  - [OrgId Authorization](#orgid-authorization)
- [Logging](#logging)
  - [Winston Logger](#winston-logger)
- [Storage](#storage)
  - [File Store](#file-store)
  - [Redis Store](#redis-store)
  - [Mongo Store](#mongo-store)
- [Authoring Plugins](#authoring-plugins)
- [Flint Advanced Operations](#flint-advanced-operations)
  - [Working Directly with Webex Teams Spaces](#working-directly-with-webex-teams-spaces)
  - [Webex Teams API Interaction](#webex-teams-api-interaction)
  - [Sending Messages Directly to Webex Teams User in a 1:1 Direct Room](#sending-messages-directly-to-webex-teams-user-in-a-11-direct-room)
  - [Memberships](#memberships)
  - [Creating a New Room](#creating-a-new-room)
  - [Conversations and Dialogs](#conversations-and-dialogs)
  - [NLP Utilities](#nlp-utilities)

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
flint.hears.phrase('hello', (bot, trigger) => {
  bot.say(`**Hello** ${trigger.person.displayName}!`).markdown();
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
  console.log('\nStopping...');
  server.close();
  flint.stop();
});
```
#### Other Examples

The following examples are included to help with a quick setup to see how
Flint operates. After getting the basic setup working and a bot responding in a
Spark Space, be sure to read the rest of the documentation to learn around the
more advanced features, options, and method properties.

* [**Basic Express with NGROK Example**](/docs/example-ngrok.md)

* [**Advanced Express Example**](/docs/example-advanced.md)

* [**Restify Example**](/docs/example-restify.md)

_More examples coming soon!_
## Overview

Most of Flint's functionality is based around the flint.hears function. This
defines the phrase or pattern the bot is listening for and what actions to take
when that phrase or pattern is matched. The flint.hears function gets a callback
than includes two objects. The bot object, and the trigger object.

A simple example of a flint.hears function setup:

```js
// case insensitive matches on first word in message (that is not bot mention)
flint.hears.phrase('hello', (bot, trigger) => {
  bot.say(`**Hello** ${trigger.person.displayName}!`).markdown();
});
```

Regular Expression Example:

```js
// responds to any mention that includes the word 'beer'
flint.hears.pattern(/(^| )beer( |.|$)/i, (bot, trigger) => {
  bot.say(`Enjoy a beer, ${trigger.person.displayName}! 🍻`).text();
});
```

Array Expression Example:

```js
// matches on any conversations with bot that includes all the words in the array
flint.hears.words(['must', 'include', 'these', 'words'], (bot, trigger) => {
  bot.say('Some text here...').markdown();
});
```

Priority example:

```js
flint.hears.phrase('hello', (bot, trigger) => {
  bot.say(`**Hello** ${trigger.person.displayName}!`).markdown();
});

// catch all that only triggers if a lower priority hears statement does not match...
flint.hears.pattern(/.*/, (bot, trigger) => {
  bot.say(`I am not sure what you meant ${trigger.person.displayName}. Can you please try asking your question another way?`).markdown();
}, 10);
```

#### Bot Object

The "bot" object returned in the callback is where all bot actions are executed
as it relates to the space that triggered the callback based on the matching
phrase.

In the above example, we are replying to the user using the
`bot.say().markdown()` action to reply with a "Hello" and addressing
the user that triggered the phrase by their display name.

The schema of the bot object is structured like this:

```js
{
  room: {
    info: {
      id: String,
      title: String,
      type: String,
      isLocked: Boolean,
      sipAddress: String,
      lastActivity: Date,
      creatorId: String,
      created: Date,
    },
    exit: Function,
    moderate: Function,
    unmoderate: Function,
    memberships: Function,
  },
  membership: {
    info: {
      id: String,
      roomId: String,
      personId: String,
      personEmail: String,
      personDisplayName: String,
      personOrgId: String,
      isModerator: Boolean,
      isMonitor: Boolean,
      created: Date,
    },
    add: Function,
    remove: Function,
  },
  say: Function,
  message: Function,
  store: Function,
  recall: Function,
  forget: Function,
  destroy: Function,
}
```

_**See the Bot documentation for details on actions that are possible.**_

#### Trigger Object

The 'trigger' object returned in the callback will have content similar to the
following:

```js
{
  person: {
    id: String,
    email: String,
    username: String,
    domain: String,
    emails: Array,
    displayName: String,
    nickName: String,
    firstName: String,
    lastName: String,
    avatar: String,
    orgId: String,
    created: Date,
    status: String,
    type: String,
  },
  room: {
    id: String,
    type: String,
  },
  message: {
    id: String,
    text: String,
    html: String,
    files: Array [
      {
        name: String,
        ext: String,
        type: String,
        binary: Buffer,
        base64: String,
      },
    ],
    mentionedPeople: Array
    created: Date,
    normalized: String,
    array: Array,
    words: Array,
  },
  created: Date,
}
```

_**See the Trigger documentation for additional details on this object.**_

## Authorization
By default, the authorization system used in flint allows ALL users to interact
with the bot. Other plugins can be loaded that inspect the trigger object in
order to allow or deny users from interacting with the bot based on any property
found in the trigger object. Other backend authorizations are possible by
referencing any one of the built-in storage modules and passing it to the
`flint.use()` method. Custom authorization modules can be created by referencing
the template at `plugins/auth/template.js`

### Domain Name Authorization

**Example:**

```js
// require Domain authorization plugin
const DomainAuth = require('node-flint/plugins/auth/domain');

// add authorization object to flint config
const config = {
  token: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
  port: 8080,
  authorization: {
    domains: ['example.com', 'cisco.com'],
  },
};

// init flint
const flint = new Flint(config);

// load authorization module
flint.use('authorization', DomainAuth);

// start flint
flint.start();
```

### OrgId Authorization

**Example:**

```js
// require Organization authorization plugin
const OrganizationAuth = require('node-flint/plugins/auth/organization');

// add authorization object to flint config
const config = {
  token: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
  port: 8080,
  authorization: {
    orgIds: ['abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345', 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345'],
  },
};

// init flint
const flint = new Flint(config);

// load authorization module
flint.use('authorization', OrganizationAuth);

// start flint
flint.start();
```

## Logging
By default, the logging subsystem uses a console based logger. Other backend
logging systems are possible by loading any one of the built-in plugins and
passing it to the `flint.use()` method. Custom logging plugins can be created
by referencing the template at `plugins/logging/template.js`

### Winston Logger

**Example:**

```js
// require Winston logger plugin
const WinstonLogger = require('node-flint/plugins/logger/winston');

// add logger object to flint config
const config = {
  token: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
  port: 8080,
  logger: {
    transports: [
      new (WinstonLogger.winston.transports.Console)({
        colorize: true,
        timestamp: false,
      }),
    ],
  },
};

// init flint
const flint = new Flint(config);

// load logger module
flint.use('logger', WinstonLogger);

// start flint
flint.start();
```

**See docs for winston transports for more details.**


## Storage
The storage system used in flint is a simple key/value store and revolves around
these 3 methods:

* `bot.store(key, value)` - Store a value to a bot instance where 'key' is a
  string and 'value' is a boolean, number, string, array, or object. *This does
  not not support functions or any non serializable data.* Returns a promise
  with the value.
* `bot.recall(key)` - Recall a value by 'key' from a bot instance. Returns a
  resolved promise with the value or a rejected promise if not found.
* `bot.forget([key])` - Forget (remove) value(s) from a bot instance where 'key'
  is an optional property that when defined, removes the specific key, and when
  undefined, removes all keys. Returns a resolved promise if deleted
  **or not found.**

When a bot despawns (removed from room), the key/value store for that bot
instance will automatically be removed from the store. By default, the in-memory
store is used. Other backend stores are possible by referencing any one of the
built-in storage modules and passing it to the `flint.use()` method. Custom
storage modules can be created by referencing the template at
`plugins/storage/template.js`

Other subsystems of Flint will use this same storage module for persisting data
across restarts.

_**See docs for store, recall, forget for more details.**_

### File Store

_Note: Note yet implemented_

**Example:**

```js
// require File storage plugin
const FileStore = require('node-flint/plugins/storage/file');

// add storage object to flint config
const config = {
  token: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
  port: 8080,
  storage: {
    path: 'flint-store.json',
  },
};

// init flint
const flint = new Flint(config);

// load storage module
flint.use('storage', FileStore);

// start flint
flint.start();

```

### Redis Store

**Example:**

```js
// require Redis storage plugin
const RedisStore = require('node-flint/plugins/storage/redis');

// add storage object to flint config
const config = {
  token: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
  port: 8080,
  storage: {
    url: 'redis://localhost',
  },
};

// init flint
const flint = new Flint(config);

// load storage module
flint.use('storage', RedisStore);

// start flint
flint.start();

```

### Mongo Store

**Example:**

```js
// require Mongo storage plugin
const MongoStore = require('node-flint/plugins/storage/file');

// add storage object to flint config
const config = {
  token: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
  port: 8080,
  storage: {
    url: 'mongodb://localhost:27017/flintBot',
    options: {
      useMongoClient: true,
    },
  },
};

// init flint
const flint = new Flint(config);

// load storage module
flint.use('storage', MongoStore);

// start flint
flint.start();

```

## Authoring Plugins

The Flint plugin architecture currently supports the following types with others
being added in future updates.

* Authorization
* Logging
* Storage

When needing to create a custom plugin, the best place to start is with either
one of the existing plugins, or the template plugin found in the respective
plugin sub-directory.

For the plugin to validate, it must return a class constructor with the
required methods.

For passing configuration options to a custom plugin, these should be defined
under the Flint config object with the object key being one of the supported
plugin types. _(i.e. Storage plugins would have their config stored under
flint.config.storage)._

When the plugin is added via the `flint.use()` method, your class constructor
will be passed a instantiated flint object as the only argument. To access the
config object for your plugin, you can parse `flint.config.<plugin type>`.

For example when creating a custom Storage plugin:

**myplugin.js**

```js
class MyCustomStorage {

  constructor(flint) {
    this.config = flint.config.storage;
  }

  start() {}

  stop() {}

  create(name, key, value) {}

  read(name, key) {}

  delete(name, [key]) {}

}

module.exports = MyCustomStorage;
```

To use this plugin, your flint based app should have something similar to the
following:

**myapp.js**

```js
const MyPlugin = require('path/to/myplugin.js');

const config = {
  token: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
  port: 8080,
  storage: {
    somePluginConfig: true,
  },
};

const flint = new Flint(config);

flint.use('storage', MyPlugin);
```

After the plugin is added and validated, it is accessible from:

* `flint.storage.create(name, key, value)`
* `flint.storage.read(name, key)`
* `flint.storage.delete(name, [key])`

It is also mapped to the bot object(s) with the 'name' argument forced to the
Webex Teams Space ID (roomId):

* `bot.store(key, value)`
* `bot.recall(key)`
* `bot.forget([key])`

_For a more detailed example of this, you can reference the
[example-advanced.js](/docs/example-advanced.md) app to see how various plugin
types are inserted._

## Flint Advanced Operations

### Working Directly with Webex Teams Spaces

```js
flint.query({ roomId: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345' })
  .then(bot => {
    bot.say('**Hello Room**').markdown();
  })
```

### Webex Teams API Interaction

Flint uses [node-sparky](https://github.com/flint-bot/sparky) as its
underlying interface to the Webex Teams API. There may be occasions when there is a
need to perform an API operation not directly exposed from Flint. This can be
accomplished by accessing `flint.spark` and referencing the documentation for
node-sparky. For example:

```js
flint.spark.teamsGet()
  .then(teams => console.log(JSON.stringify(teams, null, 2)));
```

### Sending Messages Directly to Webex Teams User in a 1:1 Direct Room

_Note: This will likely be changing once conversation engine is added.._

While replying to user initiated messages is the primary function of the
`flint.hears` method, you can also send messages directly to a user by email
address. This can be done from the `bot` or `flint` classes. This returns a
'bot' object for the 1:1 space.

For example:

```js
bot.message('test@example.com', '**Hello** there!').markdown();
```

or...

```js
flint.message('test@example.com', '**Hello** there!').markdown();
```

### Memberships

Flint's membership objects for each room it has been added to:

```js
flint.memberships()
  .then(memberships => { ... });
```

Memberships of others in a Webex Teams Space:

```js
bot.room.memberships()
  .then(memberships => { ... });
```


### Creating a New Room

_Info to be added soon..._

### Conversations and Dialogs

_Info to be added soon..._

### NLP Utilities

_Info to be added soon..._

# Flint Reference



 _Coming soon..._


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
