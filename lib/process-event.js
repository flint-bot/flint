'use strict';

var when = require('when');

/**
 * Processes an inbound Webex event.
 * This can be called by either the webhook or websocket handler.
 * @function
 * @private
 * @param {Object} flint - The flint object this function applies to.
 * @param {Object} body - The body of the event being processed
 * @param {String} name - The name of the webhook, if a webhook is being processed
 */
function processEvent(flint, body, name = '') {
  if(!flint.active) {
    return when(true);
  }

  // get event content
  var name = name ? name : body.name;
  var resource = body.resource;
  var event = body.event;
  var data = body.data;
  var roomId = body.filter ? body.filter.split('=')[1] : null;

  // validate event is bound for this instance of flint
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

  // Buttons & Cards Attachment Actions
  if(resource === 'attachmentActions') {
    // action created
    if(event === 'created') {
      return flint.getAttachmentAction(data.id)
        .then(attachmentAction => {
          // Not really sure what this does
          //flint.emit('messageCreated', message, flint.id);

          return flint.onAttachmentActions(attachmentAction)
            .catch(err => {
              flint.debug(err.stack);
              return when(true);
            });
        })
        .catch(() => {
          return when(true);
        });
    }
  }

}

module.exports = processEvent;
