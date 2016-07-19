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
