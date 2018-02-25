#### Example Template Using Express and Ngrok

After opening the file quickstart/flint_basic_ngrok.js in a text editor...

1. Install/verify ngrok
2. Start ngrok with 'ngrok http 8080'
3. Paste the displayed ngrok url suffixed with /webhook in your config object,
   DO NOT include port number. Ngrok takes care of that for us. Your
   'webhookUrl' should look almost identical to the example below with only the
   'abcdefg' portion of he URL being unique to your ngrok setup!
4. From https://developer.ciscospark.com generate a new bot integration.
5. Paste the bot token in the token property of your config object...
6. Save the updates to this file.
7. From within the `quickstart` directory, run `npm install`
8. Start you bot! Run `node flint_basic_ngrok.js`
9. Start a Group Room with yourself and the bot you created in step 4 using the
   email@sparkbot.io email address.
10. Tell your bot 'hello' by mentioning your bot by name with `@botName hello`.
    The '@' should not be visible and the bot name should have changed to
    indicate you are mentioning another user.

```js
const Flint = require('../');
const express = require('express');
const bodyParser = require('body-parser');

const config = {
  token: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://abcdefg.ngrok.io/webhook',
};

// init flint
const flint = new Flint(config);

// string match on 'hello'
flint.hears.phrase('hello', (bot, trigger) => {
  bot.message.say(`**Hello** ${trigger.person.displayName}!`).markdown();
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
