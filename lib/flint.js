const { EventEmitter } = require('events');
const { config } = require('dotenv');
const Spark = require('node-sparky');
const uuid = require('uuid/v4');
const when = require('when');
const _ = require('lodash');

// parse .env file
config();

// define factories
const Trigger = require('./trigger');
const Bot = require('./bot');

// define command processor
const Commander = require('./commander');

// default plugins
const MemStore = require('../plugins/mem-store');

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

    // validate options
    if (!this.options.token || !this.options.webhookUrl) {
      throw new Error('invalid or missing options');
    }

    // initialize spark
    this.spark = new Spark(this.options);

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
    this.on('error', err => console.error(err));

    // initalize default plugins
    this.use('storage', MemStore);

    // initalize storage
    this.storage.create('person', {});
    this.storage.create('memberships', {});
    this.storage.create('bots', {});
  }

  person() {
    return this.storage.read('person');
  }

  memberships() {
    return this.storage.read('memberships');
  }

  bots() {
    return this.storage.read('bots');
  }

  onStarted() {
    console.log('Flint has started');
    this.active = true;
    if (!this.initialized) {
      this.initialize();
    }
  }

  onStopped() {
    console.log('Flint has stopped');
    this.active = false;
  }

  onInitialized() {
    console.log('Flint has completed initalization');
    this.initialized = true;
  }

  onMembershipCreated(data, bodyObj) {
    this.emit('memberships-created', data, bodyObj);
    if (data.personId === this.person().id) {
      if (this.storage.read(`memberships.${data.id}`)) {
        this.storage.create(`memberships.${data.id}`, data);
        this.bot.load(data.roomId)
          .catch(err => console.error(err));
      } else {
        this.storage.update(`memberships.${data.id}`, data);
        this.bot.reload(data.roomId)
          .catch(err => console.error(err));
      }
    }
  }

  onMembershipUpdated(data, bodyObj) {
    this.emit('memberships-updated', data, bodyObj);
    if (data.personId === this.person().id) {
      if (this.storage.read(`memberships.${data.id}`)) {
        this.storage.update(`memberships.${data.id}`, data);
        this.bot.reload(data.roomId)
          .catch(err => console.error(err));
      } else {
        this.storage.create(`memberships.${data.id}`, data);
        this.bot.load(data.roomId)
          .catch(err => console.error(err));
      }
    }
  }

  onMembershipDeleted(data, bodyObj) {
    this.emit('memberships-deleted', data, bodyObj);
    if (data.personId === this.person().id) {
      this.storage.delete(`memberships.${data.id}`);
      this.bot.destroy(data.roomId)
        .catch(err => console.error(err));
    }
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
          this.storage.update('person', botPerson);
          if (botPerson.emails[0].split('@')[1] === 'sparkbot.io') {
            this.isBotAccount = true;
          } else {
            this.isUserAccount = true;
          }
          return when(botPerson);
        })
        .then((person) => {
          newWebhook = {
            name: `flint:${_.toLower(person.emails[0])}`,
            targetUrl: this.options.webhookUrl,
            resource: 'all',
            event: 'all',
          };
          return when(person);
        })
        .then((person) => {
          const webhookName = newWebhook.name;
          return this.spark.webhooksGet()
            .then((webhooks) => {
              const foundWebhooks = _.filter(webhooks, { name: webhookName });
              if (foundWebhooks && foundWebhooks instanceof Array && foundWebhooks.length > 0) {
                return when.map(webhooks, webhook => this.spark.webhookRemove(webhook.id))
                  .catch((err) => {
                    // log error but ignore
                    console.error(`could not remove all webhooks with name: ${webhookName}`);
                    return when(true);
                  });
              }
              return when(true);
            });
        })
        .then(() => this.spark.webhookAdd(newWebhook))
        .then(() => this.refresh())
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
      this.emit('start');
      return true;
    }
    return false;
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
      this.emit('stop');
      return true;
    }
    return false;
  }

  refresh() {
    return this.spark.membershipsGet()
      .then(memberships => when.map(memberships, (membership) => {
        if (this.storage.read(`memberships.${membership.id}`, false)) {
          this.storage.update(`memberships.${membership.id}`, membership);
          return this.bot.reload(membership.roomId);
        }
        this.storage.create(`memberships.${membership.id}`, membership);
        return this.bot.load(membership.roomId);
      }));
  }

  use(pluginType, PluginConstructor) {
    const validPluginTypes = ['authentication', 'authorization', 'logger', 'parser', 'storage'];
    if (_.includes(validPluginTypes, _.toLower(pluginType)) && typeof PluginConstructor === 'function') {
      this[pluginType] = new PluginConstructor(this);
      return when(true);
    }
    return when.reject(new Error('invalid arguments'));
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
