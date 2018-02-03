'use strict';

var Redis = require('redis');
var when = require('when');
var _ = require('lodash');

module.exports = exports = function(connectionUrl, name) {
  name = typeof name === 'string' ? name : 'flint';
  var redis = Redis.createClient({ url: connectionUrl });

  var memStore = {};
  var memCache = {};
  var active = false;
  var syncInterval = 1000;

  // load memStore state from redis
  function initRedis() {
    return when.promise((resolve, reject) => {
      redis.get(name, (err, res) => {
        if(err) {
          memStore = {};
        } else if(res) {
          memStore = JSON.parse(res);
        } else {
          memStore = {};
        }
        resolve(true);
      });
    });
  }

  // start periodicly sync of memStore state to redis
  function syncRedis() {
    // if memStore has changed...
    if(JSON.stringify(memCache) !== JSON.stringify(memStore)) {
      return when.promise((resolve, reject) => {
        var serializedStore = JSON.stringify(memStore);
        redis.set(name, serializedStore, err => {
          if(err) {
            reject(err);
          } else {
            resolve(true);
          }
        });
      })
      .delay(syncInterval)
      .catch(err => {
        console.log(err.stack);
        return when(true);
      })
      .finally(() => {
        memCache = _.cloneDeep(memStore);
        if(active) syncRedis(memStore);
        return when(true);
      });
    }

    // else memStore has not changed...
    else {
      return when(true)
        .delay(syncInterval)
        .then(() => {
          if(active) syncRedis(memStore);
          return when(true);
        });
    }
  }

  // init redis and begin memStore sync
  initRedis()
    .then(() => {
      active = true;
      syncRedis(memStore);
    });

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
      if(typeof id === 'string') {
        // if id does not exist, create
        if(!memStore[id]) {
          // create id object in memStore
          memStore[id] = {};
        }

        if(typeof key === 'string' && typeof value !== 'undefined') {
          memStore[id][key] = value;
          return when(memStore[id][key]);
        } else {
          return when.reject(new Error('bot.store() must include a "key" argument of type "string"'));
        }
      } else {
        return when.reject(new Error('bot.store() Storage module must include a "id" argument of type "string"'));
      }
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
      // if key is defined and of type string....
      if(typeof id === 'string') {
        // if key is defined and of type string....
        if(typeof id === 'string') {
          // if id/key exists...
          if(memStore[id] && typeof key === 'string' && memStore[id][key]) {
            return when(memStore[id][key]);
          } else {
            return when.reject(new Error('bot.recall() could not find the value referenced by id/key'));
          }
        }

        // else if key is not defined
        else if(typeof key === 'undefined') {
          // if id exists...
          if(memStore[id]) {
            return when(memStore[id]);
          } else {
            return when.reject(new Error('bot.recall() has no key/values defined'));
          }
        }

        // else key is defined, but of wrong type
        else {
          return when.reject(new Error('bot.recall() key must be of type "string"'));
        }
      } else {
        return when.reject(new Error('bot.recall() Storage module must include a "id" argument of type "string"'));
      }
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
      if(typeof id === 'string') {
        // if key is defined and of type string....
        if(typeof key === 'string') {
          // if id/key exists...
          if(memStore[id] && memStore[id][key]) {
            let deletedKey = _.cloneDeep(memStore[id][key]);
            delete memStore[id][key];
            return when(deletedKey);
          } else {
            return when.reject(new Error('bot.forget() could not find the value referenced by id/key'));
          }
        }

        // else if key is not defined
        else if(typeof key === 'undefined') {
          // if id exists...
          if(memStore[id]) {
            let deletedId = _.cloneDeep(memStore[id]);
            delete memStore[id];
            return when(deletedId);
          } else {
            return when.reject(new Error('bot.forget() has no key/values defined'));
          }
        }

        // else key is defined, but of wrong type
        else {
          return when.reject(new Error('bot.forget() key must be of type "string"'));
        }
      } else {
        return when.reject(new Error('bot.forget() Storage module must include a "id" argument of type "string"'));
      }
    }
  };

};
