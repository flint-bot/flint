var Flint = require('node-flint');
var webhook = require('node-flint/webhook');
var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');

var config = require(path.join(__dirname, 'config.js'));

var app = express();
app.use(bodyParser.json());

// init flint
var flint = new Flint(config);

//start flint, load plugin(s)
flint.start()
  .then(() => {
    flint.use(path.join(__dirname, 'flint.js'));
  })
  .then(() => {
    flint.debug('Flint has started');
  });

// define express path for incoming webhooks
app.post('/flint', webhook(flint));

// start express server
var server = app.listen(process.env.PORT, function () {
  flint.debug('Flint listening on port %s', process.env.PORT);
});

// gracefully shutdown (ctrl-c)
process.on('SIGINT', function() {
  flint.debug('stoppping...');
  server.close();
  flint.stop().then(function() {
    process.exit();
  });
});
