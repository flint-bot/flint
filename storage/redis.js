'use strict';

const Redis = require('redis');
const when = require('when');
const _ = require('lodash');

// promisfy JSON.parse and JSON.stringify
const jsonParse = when.lift(JSON.parse);
const jsonStringify = when.lift(JSON.stringify);

module.exports = exports = function(connectionUrl) {
  const redis = Redis.createClient({ url: connectionUrl });

  return {

    /**
     * Store key/value data.
     *
     * This method is exposed as bot.store(key, value);
     *
     * @function
     * @param {String} id - Room/Conversation/Context ID
     * @param {String} key - Key under id object
     * @param {(String|Number|Boolean|Array|Object)} value - Value of key
     * @returns {(Promise.<String>|Promise.<Number>|Promise.<Boolean>|Promise.<Array>|Promise.<Object>)}
     */
    store: function(id, key, value) {
      if (id && key) {
        if (value) {
          return jsonStringify(value)
            .then(stringVal => when.promise((resolve, reject) => redis.hset(id, key, stringVal, (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            })));
        }
        return when.promise((resolve, reject) => redis.hset(id, key, '', (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }));
      }
      return when.reject(new Error('invalid args'));
    },

    /**
     * Recall value of data stored by 'key'.
     *
     * This method is exposed as bot.recall(key);
     *
     * @function
     * @param {String} id - Room/Conversation/Context ID
     * @param {String} [key] - Key under id object (optional). If key is not passed, all keys for id are returned as an object.
     * @returns {(Promise.<String>|Promise.<Number>|Promise.<Boolean>|Promise.<Array>|Promise.<Object>)}
     */
    recall: function(id, key) {
      if (id) {
        if (key) {
          return when.promise((resolve, reject) => redis.hget(id, key, (err, result) => {
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
        return when.promise((resolve, reject) => redis.hgetall(id, (err, result) => {
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
    },

    /**
     * Forget a key or entire store.
     *
     * This method is exposed as bot.forget(key);
     *
     * @function
     * @param {String} id - Room/Conversation/Context ID
     * @param {String} [key] - Key under id object (optional). If key is not passed, id and all children are removed.
     * @returns {(Promise.<String>|Promise.<Number>|Promise.<Boolean>|Promise.<Array>|Promise.<Object>)}
     */
    forget: function(id, key) {
      if (id) {
        if (key) {
          return when.promise((resolve, reject) => redis.hdel(id, key, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }));
        }
        return when.promise((resolve, reject) => redis.del(id, (err, result) => {
          if (err) {
            resolve(true);
          } else {
            resolve(true);
          }
        }));
      }
      return when.reject(new Error('invalid args'));
    }
  };

};
