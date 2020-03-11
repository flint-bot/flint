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
