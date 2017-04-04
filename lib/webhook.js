'use strict';

var when = require('when');

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

    if(!flint.active) {
      return when(true);
    }

    // get webhook content
    var id = body.id;
    var name = body.name;
    var resource = body.resource;
    var event = body.event;
    var data = body.data;
    var roomId = body.filter ? body.filter.split('=')[1] : null;

    // validate webbhook is bound for this instance of flint
    if(name !== flint.webhook.name || (typeof flint.webhook.roomId !== 'undefined' && flint.webhook.roomId !== roomId)) {
      return when(true);
    }

    if(typeof resource !== 'string' || typeof event !== 'string') {
      flint.debug('Can not determine webhook type');
      return when(true);
    }

    // rooms
    if(resource === 'rooms') {
      return flint.getRoom(data.id)
        .then(room => {

          // set room title for rooms with none set (api bug?)
          if(room.title == '') {
            room.title = 'Default title';
          }

          // room created
          if(event === 'created') {
            flint.emit('roomCreated', room, flint.id);

            return flint.onRoomCreated(room)
              .catch(err => {
                flint.debug(err.stack);
                return when(true);
              });
          }

          // room updated
          if(event === 'updated') {
            flint.emit('roomUpdated', room, flint.id);

            return flint.onRoomUpdated(room)
              .catch(err => {
                flint.debug(err.stack);
                return when(true);
              });
          }

        })
        .catch(() => {
          return when(true);
        });
    }

    // memberships
    if(resource === 'memberships') {

      // membership created
      if(event === 'created') {
        return flint.getMembership(data.id)
          .then(membership => {
            flint.emit('membershipCreated', membership, flint.id);

            return flint.onMembershipCreated(membership)
              .catch(err => {
                flint.debug(err.stack);
                return when(true);
              });
          })
          .catch(() => {
            return when(true);
          });
      }

      // membership updated
      if(event === 'updated') {
        return flint.getMembership(data.id)
          .then(membership => {
            flint.emit('membershipUpdated', membership, flint.id);

            return flint.onMembershipUpdated(membership)
              .catch(err => {
                flint.debug(err.stack);
                return when(true);
              });
          })
          .catch(() => {
            return when(true);
          });
      }

      // membership deleted
      if(event === 'deleted') {
        flint.emit('membershipDeleted', data, flint.id);

        return flint.onMembershipDeleted(data)
          .catch(err => {
            flint.debug(err.stack);
            return when(true);
          });
      }

    }

    // messages
    if(resource === 'messages') {
      // membership created
      if(event === 'created') {
        return flint.getMessage(data.id)
          .then(message => {
            flint.emit('messageCreated', message, flint.id);

            return flint.onMessageCreated(message)
              .catch(err => {
                flint.debug(err.stack);
                return when(true);
              });
          })
          .catch(() => {
            return when(true);
          });
      }

      // message deleted
      if(event === 'deleted') {
        flint.emit('messageDeleted', data, flint.id);
        return when(true);
      }
    }
  }; // end of return function...
}

module.exports = Webhook;
