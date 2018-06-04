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
