const Flint = require('node-flint');
const MemStore = require('node-flint/plugins/mem-store');
const express = require('express');
const bodyParser = require('body-parser');

const flint = new Flint({
  token: '<my token>',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
});

// string match example
flint.hears('/hello', (bot, trigger) => {
  bot.say().markdown(`**Hello** ${trigger.personDisplayName}!`);
});

// array match example
flint.hears(['hey', 'world'], (bot, trigger) => {
  bot.say('Hello!');
});

// regexp example
flint.hears(/^goodbye.*/, (bot, trigger) => {
  bot.say().text('Hello!');
});

// add events
flint.on('messages-created', msg => console.log(`${msg.personEmail} said: ${msg.text}`));

// load a plugin (example that loads default storage plugin, this is done
// automatically and does not need to be specified)
flint.use('storage', MemStore);

// start flint
flint.start();

const app = express();
app.use(bodyParser.json());

// add route for path that is listening for web hooks
app.post('/webhook', flint.spark.webhookListen());

// start express server
app.listen(3000, () => {
  console.log('Listening on port 3000');
});
