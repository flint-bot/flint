'use strict';

var when = require('when');
var processEvent = require('./process-event'); 

/**
 * Processes a inbound Spark API webhook.
 * @function
 * @private
 * @param {Object} flint - The flint object this function applies to.
 * @returns {Function}
 * Function that can be used for Express and Express-like webserver routes.
 *
 */
function Webhook(flint) {

  return function(req, res) {

    // emit webhook event (mostly here for debugging...)
    flint.emit('webhook', req[flint.options.webhookRequestJSONLocation]);

    // if "res" is passed to function...
    if(typeof res !== 'undefined') {
      res.status(200);
      res.send('OK');
    }

    // get webhook header to determine if security is enabled
    var sig = req.headers['x-spark-signature'] || false;
    var body = req[flint.options.webhookRequestJSONLocation] || false;

    if(!body){
      return when(true);
    }

    if(flint.spark.webhookSecret && !(sig && flint.spark.webhookAuth(sig, body))) {
      // invalid signature, ignore processing webhook
      flint.debug('invalid signature in webhook callback, ignoring...');
      return when(true);
    }

    return processEvent(flint, body);

  }; // end of return function...
}

module.exports = Webhook;
