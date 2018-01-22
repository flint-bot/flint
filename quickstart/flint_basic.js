const Flint = require('../index');
const MemStore = require('../plugins/mem-store');
const express = require('express');
const bodyParser = require('body-parser');

const flint = new Flint({
  token: '<my token>',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
});

// string match example
flint.hears('/hello', (bot, trigger) => {
  // specify markdown formatted message
  bot.message.say().markdown(`**Hello** ${trigger.personDisplayName}!`);
});

// array match example
// triggers on anything said to bot that has all words in array as part of message
flint.hears(['hey', 'world'], (bot, trigger) => {
  // simple use of bot.say that default to text.
  bot.message.say('Hello!');
});

// regexp example
flint.hears(/^goodbye.*/, (bot, trigger) => {
  // specify text formatted message
  bot.message.say().text('Goodbye!');
});

// get a botObject for a room by id
flint.getBot({ roomId: 'aabbcceeddff1234567890' })
  .then(bot => bot.message.say().markdown('**Hello** Room!'));

flint.hears('add', (bot, trigger) => {
  // adds all users by email address that are found after add
  // example: @Bot add test@example.com test2@example.com
  // slice is used to drop the first word in the message array which is bot name
  // and is then rejoined to a string.
  bot.membership.add(trigger.asArray.slice(1).join(' '));
});

flint.hears('remove', (bot, trigger) => {
  bot.membership.remove(trigger.asArray.slice(1).join(' '));
});

// add events
flint.on('messages-created', msg => console.log(`${msg.personEmail} said: ${msg.text}`));

// load a plugin (example ONLY that loads default storage plugin, this is done
// automatically and does not need to be specified in normal setup)
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
