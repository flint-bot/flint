#### Example Template Using Restify
```js
const Flint = require('node-flint');
const Restify = require('restify');

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
  bot.message.say().markdown(`**Hello** ${trigger.person.displayName}!`);
});

// setup restify
const server = Restify.createServer();
server.use(Restify.bodyParser());

// add route for path that is listening for web hooks
server.post('/webhook', flint.spark.webhookListen());

// start restify server
server.listen(config.port, () => {
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
