'use strict';

var uuid = require('uuid');
var base64 = require('js-base64').Base64;

var Utils = {};

/**
 * Base64 encode a string
 * @function
 * @private
 * @param {String} string
 * @returns {String} Base64 encoded string.
 */
Utils.base64encode = function(string) {
  // deprecated return new Buffer(string).toString('base64');
    return base64.encode(string);
};

/**
 * Generate UUID string
 * @function
 * @private
 * @returns {String} UUID string.
 */
Utils.genUUID = function() {
  return uuid.v4();
};

/**
 * Generate a Base64 encoded UUID
 * @function
 * @private
 * @returns {String} Base64 encoded UUID.
 */
Utils.genUUID64 = function() {
  return Utils.base64encode(Utils.genUUID());
};

module.exports = Utils;
