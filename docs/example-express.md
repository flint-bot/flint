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
flint.hears.phrase('hello', (bot, trigger) => {
  bot.say(`**Hello** ${trigger.person.displayName}!`).markdown();
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
  console.log('\nStopping...');
  server.close();
  flint.stop();
});
```
