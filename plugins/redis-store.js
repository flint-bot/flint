const redis = require('redis');
const when = require('when');
const _ = require('lodash');

// promisfy JSON.parse and JSON.stringify
const jsonParse = when.lift(JSON.parse);
const jsonStringify = when.lift(JSON.stringify);

class Storage {

  constructor(flint) {
    this.config = flint.config;

    // validate required config
    if (!this.config.redisStore) {
      throw new Error('invalid or missing config');
    }

    this.client = redis.createClient(this.config.redisStore);
  }

  // called by flint when starting...
  static start() {
    return when(true);
  }

  // called by flint when stopping...
  stop() {
    return this.client.quit();
  }

  // name, key, [val]
  create(...args) {
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
      return when.promise((resolve, reject) => this.client.hset(name, key, '', (err, result) => {
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
