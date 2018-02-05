const { EventEmitter } = require('events');
const validator = require('node-sparky/validator');
const Spark = require('node-sparky');
const uuid = require('uuid/v4');
const when = require('when');
const _ = require('lodash');

// load env from .env file if it exists...
require('dotenv').config();

// define factories
const Trigger = require('./trigger');
const Bot = require('./bot');
const Conversation = require('./conversation');

// define command processor
const Commander = require('./commander');

// default plugins
const MemStorage = require('../plugins/storage/memory');
const ConsoleLogger = require('../plugins/logger/console');
const NoAuthorization = require('../plugins/auth/none');
const WebhookListener = require('../plugins/listener/webhook');

class Flint extends EventEmitter {

  constructor(config) {
    super();

    this.config = config;

    // ensure default options are defined and allow ENV to override...
    this.config.token = process.env.TOKEN || config.token || null;
    this.config.webhookSecret = process.env.WEBHOOK_SECRET || config.webhookSecret || 's3cret';
    this.config.webhookUrl = process.env.WEBHOOK_URL || config.webhookUrl || null;
    this.config.webhookReqNamespace = config.webhookReqNamespace || 'body';

    // define lexicon
    this.lexicon = [];

    // validate required options
    if (!this.config.token) {
      throw new Error('invalid or missing options');
    }

    // initialize spark
    this.spark = new Spark(this.config);

    // attach validator functions from node-sparky
    this.validator = validator;

    // initialize factories
    this.bot = new Bot(this);
    this.trigger = new Trigger(this);
    this.conversation = new Conversation(this);

    // initialize command processor
    this.commander = new Commander(this);

    // default status on constructor instantiation
    this.active = false;
    this.initialized = false;

    // initalize default plugins
    this.use('storage', MemStorage);
    this.use('logger', ConsoleLogger);
    this.use('authorization', NoAuthorization);
    this.use('listener', WebhookListener);

    // internal event listeners
    this.on('start', () => this.onStarted());
    this.on('stop', () => this.onStopped());
    this.on('initialized', () => this.onInitialized());
    this.on('error', err => this.logger.error(err));

    // bot person
    this.person = {};
  }

  // flint.spark event emitter handlers
  onStarted() {
    this.logger.info('Flint has started');
    this.active = true;
    if (!this.initialized) {
      this.initialize();
    }

    // send start to storage plugin if function is defined....
    if (this.storage && this.storage.start && typeof this.storage.start === 'function') {
      this.storage.start()
        .then(() => this.logger.info('Storage engine started...'))
        .catch(err => this.logger.error(err));
    }
  }
  onStopped() {
    this.logger.info('Flint has stopped');
    this.active = false;

    // send stop to storage plugin if function is defined....
    if (this.storage && this.storage.stop && typeof this.storage.stop === 'function') {
      this.storage.stop()
        .then(() => this.logger.info('Storage engine stopped...'))
        .catch(err => this.logger.error(err));
    }
  }
  onInitialized() {
    this.logger.info('Flint has completed initalization');
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
    // destroy bot memory if bot is removed from room
    if (this.person.id === data.personId) {
      this.bot.destroy(data.roomId);
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

  // initialize flint
  initialize() {
    if (!this.initialized) {
      return this.spark.personMe()
        .then((person) => {
          const botPerson = _.cloneDeep(person);
          if (botPerson.type === 'bot') {
            botPerson.emails = [_.toLower(botPerson.emails[0])];
            this.person = botPerson;
            return when(true);
          }
          return when.reject(new Error('spark token is not for a bot account'));
        })
        .then(() => this.listener.init())
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

  // start flint and listener
  start() {
    this.listener.start();
    this.emit('start');
  }

  // stop flint and listener
  stop() {
    this.listener.stop();
    this.emit('stop');
  }

  // load a plugin
  use(pluginType, PluginConstructor) {
    const validPluginTypes = ['authorization', 'logger', 'storage', 'listener'];
    if (_.includes(validPluginTypes, _.toLower(pluginType)) && typeof PluginConstructor === 'function') {
      this[_.toLower(pluginType)] = new PluginConstructor(this);
    } else {
      throw new Error('invalid plugin');
    }
  }

  // returns a bot object based on a query
  query(query) {
    if (typeof query === 'object') {
      // initial query support for roomId only...
      if (_.has(query, 'roomId')) {
        return this.spark.membershipsGet()
          .then((memberships) => {
            const roomMembership = _.find(memberships, (membership) => {
              const found = (membership.roomId === query.roomId);
              return found;
            });
            if (roomMembership) {
              return this.spark.roomGet(query.roomId)
                .then(room => this.bot.build(room, roomMembership));
            }
            return when.reject(new Error('bot not found'));
          });
      }
    }
    return when.reject(new Error('invalid query'));
  }

  send(email) {
    if (!email) {
      return when.reject(new Error('invalid or missing email argument'));
    }

    // send message as text with optional file
    const asText = (tx, fi) => {
      if (typeof tx === 'string') {
        if (typeof fi === 'string') {
          // process file as local path
          // TODO
        }
        if (typeof fi === 'object') {
          // process file as spark file object or buffer
          // TODO
        }
        return this.spark.messageSend({ toPersonEmail: email, text: tx })
          .then(message => this.query(message));
      }
      return when.reject(new Error('invalid or missing text argument'));
    };

    // send message as markdown with optional file
    const asMarkdown = (md, fi) => {
      if (typeof md === 'string') {
        if (typeof fi === 'string') {
          // process file as local path
          // TODO
        }
        if (typeof fi === 'object') {
          // process file as spark file object or buffer
          // TODO
        }
        return this.spark.messageSend({ toPersonEmail: email, markdown: md })
          .then(message => this.query(message));
      }
      return when.reject(new Error('invalid or missing text argument'));
    };

    return {
      text: asText,
      markdown: asMarkdown,
    };
  }

  // define a action when bot "hears" conversations defined by various trigger methods...
  hears(...args) {
    let phrase = args.length > 0 && (typeof args[0] === 'string' || args[0] instanceof RegExp || args[0] instanceof Array)
      ? args.shift()
      : null;
    const action = args.length > 0 && typeof args[0] === 'function' ? args.shift() : null;
    const preference = args.length > 0 && typeof args[0] === 'number' ? args.shift() : 0;
    const id = uuid();

    if (phrase && typeof phrase === 'string') {
      phrase = _.toLower(phrase);
      const hearsObj = { id, phrase, action, preference };
      this.lexicon.push(hearsObj);
      return hearsObj;
    }

    if (phrase && phrase instanceof Array) {
      _.forEach(phrase, (p, i) => {
        phrase[i] = _.toLower(p);
      });
      const hearsObj = { id, phrase, action, preference };
      this.lexicon.push(hearsObj);
      return hearsObj;
    }

    if (phrase && phrase instanceof RegExp) {
      const hearsObj = { id, phrase, action, preference };
      this.lexicon.push(hearsObj);
      return hearsObj;
    }

    throw new Error('Invalid flint.hears() syntax');
  }

  // remove a hears action
  clearHears(hearsObj) {
    this.lexicon = _.differenceBy(this.lexicon, [hearsObj], 'id');
  }

}
module.exports = Flint;
