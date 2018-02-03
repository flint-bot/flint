'use strict';

var Redis = require('redis');
var when = require('when');
var _ = require('lodash');

function Storage(connectionUrl, name) {
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
     * @function
     * @param {String} id
     * @param {String} key
     * @param {(String|Number|Boolean|Array|Object)} value
     * @returns {(String|Number|Boolean|Array|Object)}
     */
    store: function(id, key, value) {
      if(!memStore[id]) {
        memStore[id] = {};
      }

      if(typeof key === 'string' && typeof value !== 'undefined') {
        memStore[id][key] = value;
        return memStore[id][key];
      } else {
        throw new Error('invalid data type or missing value');
        return false;
      }
    },

    /**
     * Recall value of data stored by 'key'.
     *
     * @function
     * @param {String} id
     * @param {String} key
     * @returns {(String|Number|Boolean|Array|Object|undefined)}
     */
    recall: function(id, key) {
      if(memStore[id] && typeof key === 'string' && memStore[id][key]) {
        return memStore[id][key];
      } else {
        return undefined;
      }
    },

    /**
     * Forget a key or entire store.
     *
     * @function
     * @param {String} id
     * @param {String} [key] - Optional key value to forget. If key is not passed, id is removed.
     * @returns {Boolean}
     */
    forget: function(id, key) {
      // if key is defined and of type string....
      if(typeof key !== 'undefined' && typeof key === 'string') {

        // if id/key exists...
        if(memStore[id] && memStore[id][key]) {
          delete memStore[id][key];
        }

        return true;
      }

      // else if key is not defined...
      else if(typeof key === 'undefined') {
        delete memStore[id];
        return true;
      }

      // else key defined, but not of type string...
      else {
        throw new Error('invalid data type or missing value');
        return false;
      }
    }

  };
}
module.exports = Storage;
