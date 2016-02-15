# Flint


A simple Cisco Spark bot builder that is easily extended.

```js
var Flint = require('node-flint');

// define flint setup
var config = {
  hookUrl: 'http://mycallbackhost.io',
  localPort: 80,
  sparkEmail: 'mybot@domain.com',
  sparkToken: '<my api token>'
};

// init flint framework
var flint = new Flint(config);

// echos back everything after the '/echo' command
flint.hears('/echo', function(bot, trigger) {
  bot.say(trigger.args.join(' '));
});

// anytime someone says beer
flint.hears(/(^| )beer( |.|$)/i, function(bot, trigger) {
  bot.say('Enjoy a beer, %s!', trigger.person.displayName);
});
```


## Installation

This module can be installed via NPM:
```bash
npm install node-flint --save
```


# Reference

Flint generates a bot object for each Spark room the account has been added to.  The bot object tracks the specifics about the room and is passed to the command trigger's callback when a phrase is heard. A background monitor constantly watches which rooms the bot account is currently part of. The monitor automatically generates and tears down the assoicated webhooks and bot objects as needed.

## API Initialization and Configuration

```js
var Flint = require('node-flint');

var config = {
  hookUrl: 'http://mycallbackhost.io',
  localPort: 80,
  sparkEmail: 'mybot@domain.com',
  sparkToken: '<my api token>'
};
```
* `hookUrl` : The callback URL sent when setting up a webhook
* `localPort` : The localport that flint listens on for callback hooks
* `sparkEmail` : The email address of the bot account
* `sparkToken` : The Cisco Spark auth token


## Command Structure

```js
flint.hears(phrase, function(bot, trigger) {
  //commands
});
```
* `phrase` : This can be either a string or a regex pattern. If a string, the string is matched from the first character to the first space in the room message. If a regex pattern is used, it is matched against the entire message text.
* `bot` : The bot object that is used to execute commands when the `phrase` is triggered.
* `trigger` : The object that describes the details around what triggered the `phrase`.
* `commands` : The commands that are ran when the `phrase` is heard.


## Trigger Properties

### trigger.room
This is the room object that the phrase was triggered from.

###### Example Room Object:
```json
{
  "id" : "Y2lzY29zcGFyazovL3VzL1JPT00vYmJjZWIxYWQtNDNmMS0zYjU4LTkxNDctZjE0YmIwYzRkMTU0",
  "title" : "Project Unicorn - Sprint 0",
  "sipAddress" : "8675309@ciscospark.com",
  "created" : "2015-10-18T14:26:16+00:00"
}
```

### trigger.person
This is the person object that the phrase was triggered by.

###### Example Person Object:
```json
{
  "id" : "OTZhYmMyYWEtM2RjYy0xMWU1LWExNTItZmUzNDgxOWNkYzlh",
  "emails" : [ "johnny.chang@foomail.com", "jchang@barmail.com" ],
  "displayName" : "John Andersen",
  "created" : "2015-10-18T14:26:16+00:00"
}
```

### trigger.message
This is the message object that the phrase was triggered in.

###### Example Message Object:
```json
{
  "id" : "46ef3f0a-e810-460c-ad37-c161adb48195",
  "personId" : "49465565-f6db-432f-ab41-34b15f544a36",
  "personEmail" : "matt@example.com",
  "roomId" : "24aaa2aa-3dcc-11e5-a152-fe34819cdc9a",
  "text" : "PROJECT UPDATE - A new project project plan has been published on Box",
  "files" : [ "http://www.example.com/images/media.png" ],
  "created" : "2015-10-18T14:26:16+00:00"
}
```

### trigger.command
This is the first word of `trigger.message.text` that is normalized to lower case.

###### Example:
```js
console.log(trigger.message.text); // '/say Hello Bob!'
console.log(trigger.command); // '/say'
```

### trigger.args
This is an array of the words following `trigger.command` that is normalized to lower case.

###### Example:
```js
console.log(trigger.message.text); // '/say Hello Bob!'
console.log(trigger.args); // [ 'hello', 'bob!' ]
```


## Bot Methods

### bot.say(message *, callback(error, messageObj)* );
Send text or file attachments to room.
* `message` : either a string, a string plus variables, or an object
* `callback` : *optional callback*

#####Example: Send a simple message to room
```js
bot.say('hello');
```

#####Example: Send a message with variables to room
```js
var name = 'John Doe';

bot.say('Hello, %s!', name);
```

#####Example: Send a message and file to room
```js
bot.say({text: 'hello', file:'http://myurl/file.doc'});
```


### bot.file(url *, callback(error, messageObj)* );
Send just a file attachment to room.
* `url` : url string
* `callback` : *optional callback*

#####Example: Send a file to room
```js
var url = 'http://myurl/file.doc';

bot.file(url);
```


### bot.add(email *, callback(error, email)* );
Add a person or group of people to a room.
* `email` : this is either a string or an array
* `callback` : *optional callback*

#####Example: Add a single person to room.
```js
bot.add('person@domain.com', function(error, email) {
  if(error) {
    console.log(error);
  } else {
    console.log('Added %s to room', email);
  }
});
```

#####Example: Add a group of people by email to room:
```js
var emails = [ 'person1.domain.com', 'person2.domain.com', 'person3.domain.com' ];
bot.add(emails, function(error, emails) {
  if(error) {
    console.log('error');
  } else {
    console.log('Added %s to room', emails.join(', '));
  }
});
```


### bot.remove(email *, callback(error, email)*);
Remove a person or a group of people from room.
* `email` : this is either a string or an array
* `callback` : *optional callback*

#####Example: Remove a single person by email from room
```js
bot.remove('person@domain.com');
```

*(For other examples, see bot.add)*


### bot.getPeople(callback(error, emails));
Get array of emails for all people in room.
* `emails` : this is an array of email addresses for room
* `callback` : required callback that contains results of query

#####Example:
```js
bot.getPeople(function(error, emails) {
  if(error) {
    console.log('error');
  } else {
    console.log(emails.join(', ')); // prints a comma separated list to console
  }
});
```

### bot.room(name, people *, callback(error, roomObj)*);
Creates a new room with specified people defined by email addresses in an array.
* `name` : The name of the room to create
* `people` : An array of emails to add to room
* `callback` : *optional callback*
* `roomObj` : Room Object that was created

#####Example:
```js
// command '/room' to create a new room with people by email
flint.hears('/room', function(bot, trigger) {
  if(trigger.args.length > 0) {
    // add person who sent the command
    trigger.args.push(trigger.person.emails[0]);
    // add to room
    bot.room(trigger.person.displayName + '\'s Room', trigger.args);
  }
});
```


### bot.implode();
Removes everyone from a room and then removes self.

#####Example:
```js
bot.implode();
```


### bot.repeat(action(bot), interval);
Repeat an action at a specific interval.
* `action` : function that gets called at each interval
* `interval` : integer seconds between action

#####Example: Tell the room 'hello' every 120 seconds

```js
bot.repeat(function(bot) {
  bot.say('hello');
}, 120);
```

##### Support functions
* `bot.repeaterReset();` : Removes all repeat jobs and restarts repeater queue
* `bot.repeaterStart();` : Starts the repeater queue
* `bot.repeaterStop();` : Stops the repeater queue

### bot.schedule(action(bot), datetime);
Schedule an action at a specific time.
* `action` : function that gets called at each interval
* `datetime` : date object when action should happen

#####Example: Tell the room 'Happy New Year' on Jan 1, 2017 at 8AM EST
```js
// using moment.js
var moment = require('moment');

var nyd2017 = moment('2017-01-01 08:00:00-05');

bot.schedule(function(bot) {
  bot.say('Happy New Year');
}, nyd2017);
```

##### Support functions
* `bot.scheduleerReset();` : Removes all scheduled jobs and restarts scheduler queue
* `bot.schedulerStart();` : Starts the scheduler queue
* `bot.schedulerStop();` : Stops the scheduler queue


### bot.remember(key, value);
Store key/value data to the bot  which is specific for the room the bot is in.
* `key` : key as a string in local bot's memory
* `value` : value to store at key (String, Object, Collection, Array, etc)

#####Example:
```js

// command '/callme' to get person nickname in room
flint.hears('/callme', function(bot, trigger) {
  // check if anything was sent after /callme
  if(trigger.args.length > 0) {
    // set nn to word following /callme
    var nn = trigger.args.shift();
    // save to local bots memory
    bot.remember('nicknames', { email: trigger.message.personEmail, nickname: nn });
    bot.say('I will call you ' + nn + ' from now on in this room');
  } else {
    bot.say('Maybe later.');
  }
});
```


### bot.recall(key);
Recall key/value data that was stored.
* `key` : key as a string in local bot's memory

#####Example: (See bot.remember example for the first part of this.)
```js
// use lodash
var _ = require('lodash');

// command '/hello' responds with greeting
flint.hears('/hello', function(bot, trigger) {
  // recall nickname
  var person = _.find(bot.recall('nicknames'), { email: trigger.message.personEmail });

  // check if we know a nickname
  if(person) {
    // nickname was found, greet by nickname
    bot.say('Hello ' + person.nickname);
  } else {
    // nickname was not found, greet by display name
    bot.say('Hello ' + trigger.person.displayName);
  }
});


```
