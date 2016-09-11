var Flint = require('node-flint');
var webhook = require('node-flint/webhook');
var Socket2meClient = require('socket2me-client');
var path = require('path');

var server = new Socket2meClient('https://socket.bothub.io');

// flint options
var config = require(path.join(__dirname, 'config.js'));

// get a remote webhook from socket2me server
server.on('connected', function(webhookUrl) {
  config.webhookUrl = webhookUrl;

  var flint = new Flint(config);
  //start flint, load plugin(s)
  flint.start()
    .then(() => {
      flint.use(path.join(__dirname, 'flint.js'));
    })
    .then(() => {
      flint.debug('Flint has started');
    });

  server.requestHandler(function(request, respond) {
    webhook(flint)(request);
    respond(200, 'OK');
  });
});
