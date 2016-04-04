# Flint


A simple Cisco Spark bot builder that is easily extended.

```js
var Flint = require('node-flint');

// define flint setup
var config = {
  baseUrl: 'http://mycallbackhost.io',
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





#### Changelog
*v.3.0.x*
* Cleaned up code
* bug fixes
* Added Events
* Added Logger
* Room monitor is now faster and uses less API calls
* Added additional validation
* Added Flint.* functions that run commands across all rooms
* Added optional Room entry greeting when bot comes online
* Removed duplicate parameter for OAUTH setup (username)
* Changed inbound webhook handling to validate relavance of message before querying related API objects. 


#### Related Projects
* [node-sparky](https://github.com/nmarus/sparky) - The Node-JS Spark API framework that Flint uses
* [sparkbot-token](https://github.com/nmarus/sparkbot-token) - The OAUTH framework for Flint's authentication




## Installation
Flint can be installed via NPM:
```bash
npm install node-flint --save
```




# Reference
Flint generates a bot object for each Spark room the account has been added to.  The bot object tracks the specifics about the room and is passed to the command trigger's callback when a phrase is heard. A background monitor constantly watches which rooms the bot account is currently part of. The monitor automatically generates and tears down the associated webhooks and bot objects as needed.



## API Initialization and Configuration
Flint must authenticate to the Cisco Spark API through the use of tokens. There are two ways to get an auth token and Flint can use both. The first way is through access tokens. Access tokens are acquired from the profile page of the Bot's account after logging in at https://developer.ciscospark.com. This is the easiest way to get started. However, the access token will expire after a period of time or if you log out of the profile (closing the browser does not expire the token).

#### Access Tokens
To use an access token, setup your Flint project using the following template:

```js
var Flint = require('node-flint');

var config = {
  baseUrl: 'http://mycallbackhost.io',
  localPort: 80,
  sparkEmail: 'mybot@domain.com',
  sparkToken: '0d3673535c5b9d84a575735bb01fbb93f499bb19454bafa372bbb38355bdf4fc'
};

var flint = new Flint(config);
```
* `baseUrl` : The callback URL sent when setting up a webhook
* `localPort` : The localport that Flint listens on for callback hooks
* `sparkEmail` : The email address of the bot account
* `sparkToken` : The Cisco Spark auth token

The other method for authenticating with the Cisco Spark API is through the use of OAUTH. OAUTH allows the use of refresh tokens. Flint will perform the refresh automatically every 24 hours in order to get a new token. This is a little bit more complicated to setup as it requires an application be created on the Bot's profile after logging in to https://developer.ciscospark.com.

#### Refresh (OAUTH) Tokens
To use refresh tokens, setup your Flint project using the following template:

```js
var Flint = require('node-flint');

var config = {
  baseUrl: 'http://mycallbackhost.io',
  localPort: 80,
  sparkEmail: 'mybot@domain.com',
  clientID: 'Cab7fa9b26c1571f797086d427ce347f3ec99616f31390e4a07ff3d84af414026',
  clientSecret: '0d3673535c5b9d84a575735bb01fbb93f499bb19454bafa372bbb38355bdf4fc',
  redirectURL: 'http://mycallbackhost.io/bogus',
  password: 'supers3cret'
};

var flint = new Flint(config);
```
* `baseUrl` : The callback URL sent when setting up a webhook
* `localPort` : The localport that Flint listens on for callback hooks
* `sparkEmail` : The email address and login of the bot account
* `clientID` : The Client ID generated when creating your application
* `clientSecret` : The Client Secret generated when creating your application
* `redirectURL` : The Redirect URL used when creating your application
* `password` : The Bot password used to log into developer.ciscospark.com

*Note: The `redirectURL` does not need to be a valid URL path as it is never used. This is because we are not using OAUTH to grant access to other user accounts. However you must use the same URL here that you used when setting up your application under the Bot's CiscoSpark.com profile.*

#### Optional Config Parameters
The following are optional parameters. If unset, they will use the defaults as specified. It is recommended to leave the defaults unless you fully understand the impact as some of these directly affect the outgoing API rate limiter. 

````js
var config = {
  [...]
  externalPort: 80,
  maxItems: 500,
  maxConcurrent: 1,
  minTime: 500,
  domainWhiteList: [],
  userWhiteList: [],
  announceMessage: 'Flint is on F-I-R-E!'
};
````
* `externalPort` : The tcp port specified when creating webhooks (defaults to localPort)
* `maxItems` : The maximum items to return in a query (defaults to 500)
* `maxConcurrent` : The maximum concurrent API requests to send to the Spark API (defaults to 1)
* `minTime` : The minimum time between successive API requests (defaults to 500ms)
* `domainWhiteList` : Array of email domains that bot will accept commands from (if unset, allow all)
* `userWhiteList` : Array of user emails that bot will accept commands from (if unset, allow all)
* `announceMessage` : If set, this message will be sent to the room when Flint has been added. *Note: This message will also be sent to the room when Flint is restarted as it discovers which rooms it is in.*




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

###### Example:
```js
flint.hears('/hello', function(bot, trigger) {
  bot.say('Hello %s!', trigger.person.displayName);
});
```




## Trigger Properties
#### trigger.room
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

#### trigger.person
This is the person object that the phrase was triggered by.

###### Example Person Object:
```json
{
  "id" : "OTZhYmMyYWEtM2RjYy0xMWU1LWExNTItZmUzNDgxOWNkYzlh",
  "emails" : [ "johnny.chang@foomail.com", "jchang@barmail.com" ],
  "displayName" : "John Andersen",
  "created" : "2015-10-18T14:26:16+00:00",
  "email" : "johnny.chang@foomail.com",
  "username" : "johnny.chang",
  "domain" : "foomail.com"
}
```

#### trigger.message
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

#### trigger.command
This is the first word of `trigger.message.text` that is normalized to lower case.

###### Example:
```js
console.log(trigger.message.text); // '/say Hello Bob!'
console.log(trigger.command); // '/say'
```

#### trigger.args
This is an array of the words following `trigger.command` that is normalized to lower case.

###### Example:
```js
console.log(trigger.message.text); // '/say Hello Bob!'
console.log(trigger.args); // [ 'hello', 'bob!' ]
```




## Bot Properties
#### Bot.myroom
The Spark room object associated to this bot instance. 

#### Bot.myperson
The Spark person object associated to this bot instance.

#### Bot.mymembership
The Spark membership object associated to this bot instance.

#### Bot.mywebhook
The Spark webhook object associated to this bot instance.

#### Bot.myemail
The Spark email used to authenticate Flint.

#### Bot.lastActivity
A moment.js object representing the last time Flint recieved a webhook call for this room. 

#### Bot.companions
An array of email addresses of the users in the room. This updates when the bot is added to the room and every 10 minutes after, however, every time that the function `bot.rollcall()` is ran, the property will also get updated.

#### Bot.log
An array that contains the last 1000 (or maxLogSize) messages in room. 

Note: When Flint is added to a room it will automatically grab the last 1000 (or maxLogSize) messages to populate this field. Additionally if any of those 1000 messages are files, it will add them the Bot.files array. *(See Bot.files)* Once in the bot is in the room, all messages are added and parsed as they arrive on the webhook callback.  

#### Bot.files (in dev/test)
This WILL change. Currently containes the direct contents API link URLs of the last 1000 (or maxLogSize) files posted to the room. The URL in this array requires authentication and parsing in order to recieve the file contents. 

This is manual at the moment, but you can grab the file (and save to disk, etc) by making a call to the low level framework of node-sparky.

###### Example:
```js
flint.on('files', function(bot, files) {
  flint.sparky.contents.get.byUrl(files[0], function(err, file) {
    console.log('Filename: %s', file.name);
    console.log('Type: %s', file.type);

    // write to disk
    fs.writeFile('/spark-files/' + file.name, file.binary, function(err) {
      if(err) {
        console.log(err);
      } else {
        console.log('done');
      }
    });
  });
});
```




## Bot Admin and Info Functions
#### bot.add(email *, callback(error, email)* );
Add a person or group of people to a room.
* `email` : this is either a string or an array
* `callback` : *optional callback*

###### Example: Add a single person to room.
```js
bot.add('person@domain.com', function(error, email) {
  if(error) {
    console.log(error);
  } else {
    console.log('Added %s to room', email);
  }
});
```

###### Example: Add a group of people by email to room:
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


#### bot.remove(email *, callback(error, email)*);
Remove a person or a group of people from room.
* `email` : this is either a string or an array
* `callback` : *optional callback*

###### Example: Remove a single person by email from room
```js
bot.remove('person@domain.com');
```

*(For other examples, see bot.add)*


#### bot.rollcall(callback(error, emails));
Get array of emails for all people in room.
* `emails` : this is an array of email addresses for room
* `callback` : required callback that contains results of query

###### Example:
```js
bot.rollcall(function(error, emails) {
  if(error) {
    console.log('error');
  } else {
    console.log(emails.join(', ')); // prints a comma separated list to console
  }
});
```


#### bot.inspect(person, callback(error, person));
Get person object from email or personId.
* `person` : this is the email address or personId of a Spark account
* `callback` : required callback that contains results of query

###### Example:
```js
bot.inspect('person@domain.com', function(error, person) {
  if(error) {
    console.log('error');
  } else {
    console.log(person.displayName);
  }
});
```

#### bot.room(name, people *, callback(error, roomObj)*);
Creates a new room with specified people defined by email addresses in an array.
* `name` : The name of the room to create
* `people` : An array of emails to add to room
* `callback` : *optional callback*
* `roomObj` : Room Object that was created

###### Example:
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


#### bot.implode(*callback(err)*);
Removes everyone from a room and then removes self.

###### Example:
```js
bot.implode();
```


#### bot.isModerated(callback(locked));
Callback returns boolean representing room moderation status.

###### Example:
```js
//TODO
```


#### bot.exit(*callback(err)*);
Instructs bot to exit room.

###### Example:
```js
//TODO
```


## Message Functions
#### bot.say(message *, callback(error, messageObj)* );
Send text and/or file attachments to room.
* `message` : either a string, a string plus variables, or an object
* `callback` : *optional callback*

###### Example: Send a simple message to room
```js
bot.say('hello');
```

###### Example: Send a message with variables to room
```js
var name = 'John Doe';

bot.say('Hello, %s!', name);
```

###### Example: Send a message and file to room
```js
bot.say({text: 'hello', file:'http://myurl/file.doc'});
```


#### bot.file(url *, callback(error, messageObj)* );
Send just a file attachment to room.
* `url` : url string
* `callback` : *optional callback*

###### Example: Send a file to room
```js
var url = 'http://myurl/file.doc';

bot.file(url);
```


#### bot.dm(email, message *, callback(error, messageObj)* );
Send text and/or file attachments to a person
* `email` : email address of person for bot to direct message
* `message` : either a string, a string plus variables, or an object
* `callback` : *optional callback*

###### Example: Send a simple message to person
```js
bot.dm('person@domain.com', 'hello');
```

###### Example: Send a message with variables to person
```js
var name = 'John Doe';

bot.dm('person@domain.com', 'Hello, %s!', name);
```

###### Example: Send a message and file to person
```js
bot.dm({text: 'hello', file:'http://myurl/file.doc'});
```


#### bot.getMessages(*count,* callback(error, messages)); (in dev/test)
Gets all messages in room (up to count or maxLogSize) as an array of parsed message objects.

###### Example:
```js
// get last 5 messages for room
bot.getMessages(5, function(err, messages) {
  if(!err) messages.forEach(function(message) {
    // display message object
    console.log(JSON.stringify(message));
    
    // display just message text
    console.log(message.text));
  });
});
```




## Time Based Functions
#### bot.repeat(action(bot), interval);
Repeat an action at a specific interval.
* `action` : function that gets called at each interval
* `interval` : integer seconds between action

###### Example: Tell the room 'hello' every 120 seconds

```js
bot.repeat(function(bot) {
  bot.say('hello');
}, 120);
```

##### Support functions
* `bot.repeaterReset();` : Removes all repeat jobs and restarts repeater queue
* `bot.repeaterStart();` : Starts the repeater queue
* `bot.repeaterStop();` : Stops the repeater queue

#### bot.schedule(action(bot), datetime);
Schedule an action at a specific time.
* `action` : function that gets called at each interval
* `datetime` : ISO-8601 date string (or parsable moment.js string/object) that defines when action should happen

###### Example: Tell the room 'Happy New Year' on Jan 1, 2017 at 8AM EST
```js
var nyd2017 = '2017-01-01 08:00:00-05';

bot.schedule(function(bot) {
  bot.say('Happy New Year');
}, nyd2017);
```

##### Support functions
* `bot.scheduleerReset();` : Removes all scheduled jobs and restarts scheduler queue
* `bot.schedulerStart();` : Starts the scheduler queue
* `bot.schedulerStop();` : Stops the scheduler queue




## Bot Memory Functions
#### bot.store(namespace, key, value);
Store namespace/key/value data specific to a room the bot is in.
* `namespace` : namespace as a string in local bot's memory
* `key` : key as a string in local bot's memory
* `value` : value to store at key (String, Object, Collection, Array, etc)

###### Example:
```js
// command '/callme' to get person nickname in room
flint.hears('/callme', function(bot, trigger) {
  // check if anything was sent after /callme
  if(trigger.args.length > 0) {
    // set nickname to words following /callme
    var nickname = trigger.args.join(' ');

    // save to local bots memory
    bot.store('nicknames', trigger.message.personEmail, nickname);
    bot.say('I will call you ' + nickname + ' from now on in this room.');
  } else {
    bot.say('Maybe later.');
  }
});
```


#### bot.recall(namespace, key);
Recall namespace/key/value data that was stored.
* `namespace` : namespace as a string in local bot's memory
* `key` : key as a string in local bot's memory

###### Example: (See bot.store example for the first part of this.)
```js
// command '/hello' responds with greeting
flint.hears('/hello', function(bot, trigger) {
  // recall nickname
  var nickname = bot.recall('nicknames', trigger.message.personEmail);

  // check if we know a nickname
  if(nickname) {
    // nickname was found, greet by nickname
    bot.say('Hello ' + nickname);
  } else {
    // nickname was not found, greet by display name
    bot.say('Hello ' + trigger.person.displayName);
  }
});
```


#### bot.forget(namespace *, key*);
Forget all data stored under a namespace and/or key.
* `namespace` : namespace as a string in local bot's memory
* `key` : *key as a string in local bot's memory (optional)*

###### Example:
```js
bot.forget('nicknames');
```




## Subscriptions
Publisher/Subscriber functions allow Flint to provision inbound routes that individual rooms (via their bot instance) can subscribe to. The publish function happens globally (flint) and the subscribe function happens at the bot. This hierarchy allows Flint to be triggered by external systems. Flint will answer on get, post, put, and del http requests. The request object is passed to the the subscriber. All published routes are created under http://myserver/s so that a route named "myapp" would be accessible at http://myserver/s/myapp. URL, body JSON, and body form url-encoded parameters are parsed into "request.params".


#### flint.publish(name *, callback(error, url)*);
Publish a inbound route to http://myserver/s/name. Returns url. 
* `name` : name of published route
* `url` : the generated url in a format of http://myserver/s/name

###### Example:
```js
flint.publish('myroute', function(err, url) {
  if(!err) {
    console.log('new route published at %s', url);
  }
}); 
```


#### bot.subscribe(name, action(req) *, callback(error)*);
Subscribe bot to a published inbound route.
* `name` : name of published route
* `action` : function that is called with the request to subscribed route

###### Example:
```js
bot.subscribe('myroute', function(req) {
  bot.say('This just in: %s', req.body);
}, function(err) {
  if(err) {
    console.log('route not found');
  }
});
```


#### bot.unsubscribe(name);
Unsubscribe bot from a published inbound route.
* `name` : name of published route

###### Example:
```js
bot.unsubscribe('myroute');
```




## Expose URL
A simple reverse file proxy is provided with Flint in order to serve files from other URLs. The main purpose of this is to expose internal files that may be only URL accssible from the host Flint is running on. This is in order to serve the file to the Spark API by passing the internet accessible URL in the API call. The proxy mapping expires after 60 seconds. 

#### flint.expose(url, filename);
Serve an external URL file locally. Returns proxied url.
* `url` : url of file to proxy
* `filename` : filename to expose as http://myserver/p/myfilename

###### Example:
```js
bot.say({
  text: 'Here is your file.',
  file: flint.expose('http://192.168.10.10/files/mychart.jpg', 'mychart.jpg')
});
```




## Flint Global Bot Control Functions
#### Flint.exit(*callback(err)*);
Performs exactly like `Bot.exit()`, except on all rooms.

#### Flint.say(message *, callback(err)*);
Performs exactly like `Bot.say()`, except on all rooms.

#### Flint.file(url *, callback(err)*);
Performs exactly like `Bot.file()`, except on all rooms.

#### Flint.add(email *, callback(err)*);
Performs exactly like `Bot.add()`, except on all rooms.

#### Flint.remove(email *, callback(err)*);
Performs exactly like `Bot.remove()`, except on all rooms.




## Events
#### Flint.on('spawn', callback(bot)**);
Emitted when a new bot is spawned to handle a room Flint is added to.

###### Example:
```js
flint.on('spawn', function(bot) {
  console.log('new bot spawned in room: %s', bot.myroom.title);
});
```

#### Flint.on('despawn', callback(bot));
Emitted when a Flint is removed from a room and the bot object is flagged for deletion. 

###### Example:
```js
flint.on('despawn', function(bot) {
  console.log('bot despawned in room: %s', bot.myroom.title);
});
```

#### Flint.on('message', callback(bot, message);
Emitted when a message is recieved from a room that Flint has a Bot instance in. 

###### Example:
```js
flint.on('message', function(bot, message) {
  console.log('recieved message "%s" in room "%s"', message.text, bot.myroom.title);
});
```

#### Flint.on('files', callback(bot, files);
Emitted when new file(s) are added to a room that Flint has a Bot instance in.

###### Example:
```js
flint.on('files', function(bot, files) {
  console.log('recieved file %s', JSON.stringify(files));
  bot.say('Nice file..');
});
```

#### Flint.on('error', callback(error);
Emmitted when there is a error... 

###### Example:
```js
flint.on('error', function(err) {
  console.log(err);
});
```