## Example #3 Using Socket2me (experimental and under development)
An inbound, internet reachable port, is required for the Spark API to notify
Flint of webhook events. This is not always easy or possible.

Flint utilize a remote socket client through a
[socket2me](https://github.com/nmarus/socket2me) server in the event you want to
stand up a bot where forwarding a port is not possible.

The remote socket2me server allows you to run Flint behind a NAT without adding
a port forward configuration to your firewall. To make use of a socket2me
server, you can either stand up your own socket2me server or make use of a
public/shared socket2me server. A single socket2me server can support many
clients/bots simultaneously.

```js
var Flint = require('node-flint');
var webhook = require('node-flint/webhook');
var Socket2meClient = require('socket2me-client');
var server = new Socket2meClient('https://socket.bothub.io');

// flint options
var config = {
  token: 'Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u'
};

// get a remote webhook from socket2me server
server.on('connected', function(webhookUrl) {
  config.webhookUrl = webhookUrl;

  var flint = new Flint(config);
  flint.start();

  // say hello
  flint.hears('/hello', function(bot, trigger) {
    bot.say('Hello %s!', trigger.personDisplayName);
  });

  server.requestHandler(function(request, respond) {
    webhook(flint)(request);
    respond(200, 'OK');
  });
});
```
