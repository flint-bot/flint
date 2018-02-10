const redis = require('redis');
const when = require('when');
const _ = require('lodash');

// promisfy JSON.parse and JSON.stringify
const jsonParse = when.lift(JSON.parse);
const jsonStringify = when.lift(JSON.stringify);

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
      const urlRe = /^redis[s]?:\/\/.*/i;
      return (isString && urlRe.test(url));
    };
    if (!(_.has(this.config, 'url') && validUrl(this.config.url))) {
      throw new Error('invalid or malformed redis connection string');
    }

    this.connected = false;
  }

  // called by flint when starting...
  start() {
    if (!this.connected) {
      this.client = redis.createClient(this.config);
      this.connected = true;
    }
    return when(true);
  }

  // called by flint when stopping...
  stop() {
    if (this.connected) {
      this.client.quit();
      this.connected = false;
    }
    return when(true);
  }

  // name, key, [val]
  create(...args) {
    // reject if flint and/or db is not active
    if (!this.flint.active || !this.connected) {
      return when.reject(new Error('flint or redis is currently stopped'));
    }

    const name = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const key = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const val = args.length > 0 && typeof args[0] !== 'undefined' ? args.shift() : false;

    if (name && key) {
      if (val) {
        return jsonStringify(val)
          .then(stringVal => when.promise((resolve, reject) => this.client.hset(name, key, stringVal, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          })));
      }
      return when.promise((resolve, reject) => this.client.hset(name, key, null, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }));
    }
    return when.reject(new Error('invalid args'));
  }

  // name, [key]
  read(...args) {
    // reject if flint and/or db is not active
    if (!this.flint.active || !this.connected) {
      return when.reject(new Error('flint or redis is currently stopped'));
    }

    const name = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const key = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;

    if (name) {
      if (key) {
        return when.promise((resolve, reject) => this.client.hget(name, key, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        })).then((res) => {
          const parsedRes = jsonParse(res)
            .catch(() => when(res));
          return parsedRes;
        });
      }
      return when.promise((resolve, reject) => this.client.hgetall(name, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })).then((res) => {
        const resKeys = _.keys(res);
        return when.map(resKeys, (resKey) => {
          const parsedRes = jsonParse(res[resKey])
            .catch(() => when(res[resKey]));
          return parsedRes;
        });
      });
    }
    return when.reject(new Error('invalid args'));
  }

  // name, [key]
  delete(...args) {
    // reject if flint and/or db is not active
    if (!this.flint.active || !this.connected) {
      return when.reject(new Error('flint or redis is currently stopped'));
    }

    const name = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const key = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;

    if (name) {
      if (key) {
        return when.promise((resolve, reject) => this.client.hdel(name, key, (err, result) => {
          if (err) {
            resolve(true);
          } else {
            resolve(true);
          }
        }));
      }
      return when.promise((resolve, reject) => this.client.del(name, (err, result) => {
        if (err) {
          resolve(true);
        } else {
          resolve(true);
        }
      }));
    }
    return when.reject(new Error('invalid args'));
  }

}

module.exports = Storage;
