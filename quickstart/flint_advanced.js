const Flint = require('node-flint');
const express = require('express');
const bodyParser = require('body-parser');

const RedisStore = require('node-flint/plugins/storage/redis');
const WinstonLogger = require('node-flint/plugins/logger/winston');
const DomainAuth = require('node-flint/plugins/auth/domain');

// config
const config = {
  token: 'abcdefg12345abcdefg12345abcdefg12345abcdefg12345abcdefg12345',
  webhookSecret: 'somesecr3t',
  webhookUrl: 'http://example.com/webhook',
  port: 8080,
  storage: {
    url: 'redis://localhost',
  },
  logger: {
    transports: [
      new (WinstonLogger.winston.transports.Console)({
        colorize: true,
        timestamp: false,
      }),
    ],
  },
  authorization: {
    domains: ['example.com', 'cisco.com'],
  },
};

// init flint
const flint = new Flint(config);

// specify alternate plugins
flint.use('storage', RedisStore);
flint.use('logger', WinstonLogger);
flint.use('authorization', DomainAuth);

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
  console.log('\nStopping...');
  server.close();
  flint.stop();
});
