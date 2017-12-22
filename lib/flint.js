const { EventEmitter } = require('events');
const Spark = require('node-sparky');
const validator = require('node-sparky/validator');
const uuid = require('uuid/v4');
const when = require('when');
const _ = require('lodash');

// load env from .env file if it exists...
require('dotenv').config();

// define factories
const Trigger = require('./trigger');
const Bot = require('./bot');

// define command processor
const Commander = require('./commander');

// default plugins
const MemStore = require('../plugins/mem-store');
const WinstonLogger = require('../plugins/winston-logger');
const OpenAuthorization = require('../plugins/open-authorization');

class Flint extends EventEmitter {

  constructor(options) {
    super();
    this.options = {
      token: process.env.TOKEN || options.token || null,
      webhookSecret: process.env.WEBHOOK_SECRET || options.webhookSecret || 's3cret',
      webhookUrl: process.env.WEBHOOK_URL || options.webhookUrl || null,
      webhookReqNamespace: options.webhookReqNamespace || 'body',
    };

    // define lexicon
    this.lexicon = [];

    // validate required options
    if (!this.options.token || !this.options.webhookUrl) {
      throw new Error('invalid or missing options');
    }

    // initialize spark
    this.spark = new Spark(this.options);

    // attach validator functions from node-sparky
    this.validator = validator;

    // initialize factories
    this.bot = new Bot(this);
    this.trigger = new Trigger(this);

    // initialize command processor
    this.commander = new Commander(this);

    // default status on constructor instantiation
    this.active = false;
    this.initialized = false;
    this.isBotAccount = false;
    this.isUserAccount = false;

    // internal event listeners
    this.on('start', () => this.onStarted());
    this.on('stop', () => this.onStopped());
    this.on('initialized', () => this.onInitialized());
    this.on('error', err => this.logger.log('error', err));

    // initalize default plugins
    this.use('storage', MemStore);
    this.use('logger', WinstonLogger);
    this.use('authorization', OpenAuthorization);

    // bot person
    this.person = {};
  }

  onStarted() {
    this.logger.log('Flint has started');
    this.active = true;
    if (!this.initialized) {
      this.initialize();
    }
  }

  onStopped() {
    this.logger.log('Flint has stopped');
    this.active = false;
  }

  onInitialized() {
    this.logger.log('Flint has completed initalization');
    this.initialized = true;
  }

  onMembershipCreated(data, bodyObj) {
    this.emit('memberships-created', data, bodyObj);
  }

  onMembershipUpdated(data, bodyObj) {
    this.emit('memberships-updated', data, bodyObj);
  }

  onMembershipDeleted(data, bodyObj) {
    this.emit('memberships-deleted', data, bodyObj);
  }

  onMessageCreated(data, bodyObj) {
    this.emit('messages-created', data, bodyObj);
    this.commander.message(data);
  }

  onMessageDeleted(data, bodyObj) {
    this.emit('messages-deleted', data, bodyObj);
  }

  onRoomsCreated(data, bodyObj) {
    this.emit('rooms-created', data, bodyObj);
  }

  onRoomsUpdated(data, bodyObj) {
    this.emit('rooms-updated', data, bodyObj);
  }

  initialize() {
    if (!this.initialized) {
      let newWebhook = {};
      return this.spark.personMe()
        .then((person) => {
          const botPerson = _.cloneDeep(person);
          botPerson.emails = [_.toLower(botPerson.emails[0])];
          if (botPerson.type === 'bot') {
            this.isBotAccount = true;
            this.isUserAccount = false;
          } else {
            this.isBotAccount = false;
            this.isUserAccount = true;
          }
          return when(botPerson);
        })
        .then((botPerson) => {
          this.person = botPerson;
          newWebhook = {
            name: `flint:${_.toLower(botPerson.emails[0])}`,
            targetUrl: this.options.webhookUrl,
            resource: 'all',
            event: 'all',
          };
          return when(botPerson);
        })
        .then((botPerson) => {
          const webhookName = newWebhook.name;
          return this.spark.webhooksGet()
            .then((webhooks) => {
              const foundWebhooks = _.filter(webhooks, { name: webhookName });
              if (foundWebhooks && foundWebhooks instanceof Array && foundWebhooks.length > 0) {
                return when.map(webhooks, webhook => this.spark.webhookRemove(webhook.id))
                  .catch((err) => {
                    // log error but ignore
                    this.logger.log('error', `could not remove all webhooks with name: ${webhookName}`);
                    return when(true);
                  });
              }
              return when(true);
            });
        })
        .then(() => this.spark.webhookAdd(newWebhook))
        .then(() => {
          this.emit('initialized');
          return when(true);
        })
        .catch((err) => {
          throw err;
        });
    }
    return when(false);
  }

  start() {
    if (!this.active) {
      this.spark.on('memberships-created', (data, bodyObj) => this.onMembershipCreated(data, bodyObj));
      this.spark.on('memberships-updated', (data, bodyObj) => this.onMembershipUpdated(data, bodyObj));
      this.spark.on('memberships-deleted', (data, bodyObj) => this.onMembershipDeleted(data, bodyObj));
      this.spark.on('messages-created', (data, bodyObj) => this.onMessageCreated(data, bodyObj));
      this.spark.on('messages-deleted', (data, bodyObj) => this.onMessageDeleted(data, bodyObj));
      this.spark.on('rooms-created', (data, bodyObj) => this.onRoomsCreated(data, bodyObj));
      this.spark.on('rooms-updated', (data, bodyObj) => this.onRoomsUpdated(data, bodyObj));
    }
    this.emit('start');
  }

  stop() {
    if (this.active) {
      this.spark.removeAllListeners('memberships-created');
      this.spark.removeAllListeners('memberships-updated');
      this.spark.removeAllListeners('memberships-deleted');
      this.spark.removeAllListeners('messages-created');
      this.spark.removeAllListeners('messages-deleted');
      this.spark.removeAllListeners('rooms-created');
      this.spark.removeAllListeners('rooms-updated');
    }
    this.emit('stop');
  }

  use(pluginType, PluginConstructor) {
    const validPluginTypes = ['authorization', 'logger', 'parser', 'storage'];
    if (_.includes(validPluginTypes, _.toLower(pluginType)) && typeof PluginConstructor === 'function') {
      this[_.toLower(pluginType)] = new PluginConstructor(this);
    } else {
      throw new Error('invalid plugin');
    }
  }

  hears(...args) {
    let phrase = args.length > 0 && (typeof args[0] === 'string' || args[0] instanceof RegExp || args[0] instanceof Array)
      ? args.shift()
      : null;
    const action = args.length > 0 && typeof args[0] === 'function' ? args.shift() : null;
    const helpText = args.length > 0 && typeof args[0] === 'string' ? args.shift() : null;
    const preference = args.length > 0 && typeof args[0] === 'number' ? args.shift() : 0;
    const id = uuid();

    if (phrase && typeof phrase === 'string') {
      phrase = _.toLower(phrase);
    }

    if (phrase && phrase instanceof Array) {
      _.forEach(phrase, (p, i) => {
        phrase[i] = _.toLower(p);
      });
    }

    if (phrase) {
      const hearsObj = { id, phrase, action, helpText, preference };

      this.lexicon.push(hearsObj);
      return hearsObj;
    }

    throw new Error('Invalid flint.hears() syntax');
  }

  clearHears(hearsObj) {
    this.lexicon = _.differenceBy(this.lexicon, [hearsObj], 'id');
  }

}
module.exports = Flint;
