/**
* @file Defines In Memory Data Store
* @author Nicholas Marus <nmarus@gmail.com>
* @license LGPL-3.0
*/

'use strict';

var when = require('when');
var _ = require('lodash');

function Storage() {
  var memStore = {};

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
