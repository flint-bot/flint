## Example #4 Using PubNub
An inbound, internet reachable port, is required for the Webex Teams API to notify
Flint of webhook events. This is not always easy or possible.

The standard way to handle firewall tunneling is via a tool like ngrok or a web server in the DMZ.
Here we use a different approach. We are using a PubNub server as a way to transmit the webhook event to
the flint application, which uses a PubNub client to receive the event. PubNub uses whatever mechanism is best suited to reach the PubHub nodes.

There is a PubNub function you need to deploy at PubNub. It's in the file pubnub-function.js.
Check their tutorial here:
https://www.pubnub.com/tutorials/pubnub-functions/
Configure the function to run 'On Request'

Once you configured your PubNub function (block) you should copy the URL and configure it as WebhookRecipientURL 
in your environment. You also need to configure the PubnubSubscribeKey in your environment so the client
can subscribe to the channel. As channel name we used webex since flint registers for webhooks with
resource:all event: all ( we also publish to webex.${resource} and webex.${resource}.${event} so you can use 
PubNubs channel wildcards if you want. See here https://www.pubnub.com/developers/tech/key-concepts/stream-controller/wildcard-subscribe/)

When PubNub receives the event it will invoke the function that then sends the event along the channel.
Flint spawns a bot for every space/room and will cross check based on the roomId to which bot the message
belongs.

If you want a different additional bot configured, you must use a different WebhookRecipientURL and 
PubnubSubscribeKey Key.

You should check the temaplates folder for a working example.
```js
"use strict";

var Flint = require('node-flint');
var webhook = require('node-flint/webhook');
var path = require('path');
var PubNub = require('pubnub');
var config = require(path.join(__dirname, 'config.js'));
var when = require('when');


// instantiate thje pubnub object
var pubnub = new PubNub ({
  subscribeKey : config.pubnubSubscribeKey
})

// pubnub status listener
// we use it here for the initialization and then remove ourselves
let statusListener = {
  status: (s) => {
    if (s.category === "PNConnectedCategory") {
      // res is from the closure
      this.res("fullfilled my init promise for pubnub");
    }
  }
}




let messageListener = {
  message: (m) => {
    webhook(flint)(m.message);
  }
}



function checkInit() {
  return new Promise( (res,rej) => {
    statusListener.__proto__.res = res;
    const initTimeSecs = 5;
    // give 3 second init time
    setTimeout(() => {
      rej("resolved")
    }, initTimeSecs * 1000)

    pubnub.addListener(statusListener);
  })
}

// init flint
var flint = new Flint(config);

checkInit()
  .then( (a) => { pubnub.removeListener(statusListener) })
  .then( () => { flint.start() } )
  .then( () => { flint.use(path.join(__dirname, 'flint.js')) })
  .then( () => { flint.debug('Flint has started')  })
  .then( () => { pubnub.addListener(messageListener) })
  .catch( (e) => { console.log("could not init pubnub or flint") })


// flint registers webhooks for resurce: all event: all
// so here we listen to the all all pubnub channel
pubnub.subscribe({
  channels: ["webex"]
})


// gracefully shutdown (ctrl-c)
process.on('SIGINT', function() {
  flint.debug('stoppping...');
  flint.stop().then(function() {
    process.exit();
  });
});
```
