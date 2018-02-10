const mongoose = require('mongoose');
const moment = require('moment');
const when = require('when');
const poll = require('when/poll');
const _ = require('lodash');

class Storage {

  constructor(flint) {
    // validate required config object
    if (!(_.has(flint.config, 'storage') && typeof flint.config.storage === 'object')) {
      throw new Error('invalid or missing config');
    }

    this.flint = flint;

    this.config = flint.config.storage;

    // validate required config object props
    const validUrl = (url) => {
      const isString = (typeof url === 'string');
      const urlRe = /^mongodb:\/\/.*/i;
      return (isString && urlRe.test(url));
    };
    if (!(_.has(this.config, 'url') && validUrl(this.config.url))) {
      throw new Error('invalid or malformed mongodb connection string');
    }

    this.connected = false;

    // set options prop if not defined or invalid
    if (!(_.has(this.config, 'options') && typeof this.config.options === 'object')) {
      this.config.options = {};
    }

    // force mongo client
    this.config.options.useMongoClient = true;

    // use when.js for mongoose promise library
    mongoose.Promise = when.promise;

    this.Model = null;

    // schema
    this.schema = {
      name: {
        type: String,
        required: true,
        unique: true,
      },
      data: {
        type: mongoose.Schema.Types.Mixed,
      },
      creationDate: {
        type: Date,
        default: () => moment().toDate(),
      },
    };

    // schema options
    this.schemaOptions = {};

    if (_.has(this.config, 'url')) {
      mongoose.connection.once('open', () => {
        this.Model = mongoose.model('Notion', mongoose.Schema(this.schema, this.schemaOptions));
      });
      mongoose.connection.on('error', (err) => {
        this.flint.logger.error(err);
      });
      mongoose.connection.on('connected', () => {
        this.connected = true;
      });
      mongoose.connection.on('disconnected', () => {
        this.connected = false;
      });
    } else {
      throw new Error('mongo database connection url invalid');
    }
  }

  // called by flint when starting...
  start() {
    if (!this.connected) {
      // connect db
      mongoose.connect(this.config.url, this.config.options);
    }

    return when(true);
  }

  // called by flint when stopping...
  stop() {
    if (this.connected) {
      // disconnect db
      mongoose.connection.close();
    }

    return when(true);
  }

  // waitfor / verify connection
  connect() {
    const isReady = () => (this.connected && this.Model);

    if (isReady()) {
      return when(this.Model);
    }
    return poll(() => true, 2000, isReady);
  }

  // name, key, [val]
  create(...args) {
    // reject if flint and/or db is not active
    if (!this.flint.active || !this.connected) {
      return when.reject(new Error('flint or mongo is currently stopped'));
    }

    const name = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const key = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const val = args.length > 0 && typeof args[0] !== 'undefined' ? args.shift() : false;

    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };

    if (name && key) {
      // construct object
      const object = {
        name: name,
        data: {},
      };
      if (val) {
        object.data[key] = val;
      } else {
        object.data[key] = null;
      }

      return this.connect()
        .then(() => this.Model.update({ name }, object, opts));
    }

    return when.reject(new Error('invalid args'));
  }

  // name, [key]
  read(...args) {
    // reject if flint is not active
    if (!this.flint.active || !this.connected) {
      return when.reject(new Error('flint or mongo is currently stopped'));
    }

    const name = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const key = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;

    if (name) {
      const found = this.connect()
        .then(() => this.Model.findOne({ name }))
        .then((result) => {
          if (result && _.has(result.toObject(), 'data')) {
            return when(result.toObject().data);
          }

          return when.reject(new Error('record not found'));
        });

      if (key) {
        return found.then((data) => {
          if (_.has(data, key)) {
            return when(data[key]);
          }
          return when.reject(new Error('record not found'));
        });
      }

      return found;
    }

    return when.reject(new Error('invalid args'));
  }

  // name, [key]
  delete(...args) {
    // reject if flint is not active
    if (!this.flint.active || !this.connected) {
      return when.reject(new Error('flint or mongo is currently stopped'));
    }

    const name = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const key = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;

    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };

    if (name) {
      const found = this.connect()
        .then(() => this.Model.findOne({ name }))
        .then((result) => {
          if (result && _.has(result.toObject(), 'data')) {
            return when(result.toObject().data);
          }

          return when.reject(new Error('record not found'));
        });

      // remove only key
      if (key) {
        return found.then((data) => {
          if (_.has(data, key)) {
            const updatedData = _.omit(data, [key]);
            return this.connect()
              .then(() => this.Model.update({ name }, { name: name, data: updatedData }, opts))
              .then(() => when(true))
              .catch(() => when(true));
          }
          return when(true);
        });
      }

      // remove doc with property name
      return this.connect()
        .then(() => this.Model.remove({ name }))
        .then(() => when(true))
        .catch(() => when(true));
    }

    return when(true);
  }

}

module.exports = Storage;
