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
flint.hears('hello', (bot, trigger) => {
  bot.message.say().markdown(`**Hello** ${trigger.personDisplayName}!`);
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
  console.log('stopping...');
  server.close();
});
```

#### Other Examples

The following examples are included to show the flexibility and to help with a
quick setup to see how Flint Operates. After getting the basic setup working
and a bot responding in a Room, be sure to read the rest of the documentation
to learn about The more advanced features.

* [**Express with NGROK Example**](https://github.com/flint-bot/flint/blob/master/docs/example-ngrok.md)

* [**Restify Example**](https://github.com/flint-bot/flint/blob/master/docs/example2.md)

_More examples coming soon!_
