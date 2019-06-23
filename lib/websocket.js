'use strict';

var when = require('when');
var Webex = require('webex'); 
var processEvent = require('./process-event'); 

/**
 * A class to register for webex teams messaging events to be delivered
 * via socket using the webex SDK
 * 
 * This class will register to listen to the events.  When an event
 * is received it will call the webhook handler with the event payload
 * 
 * This approach allows bot developers to deploy bots behind a firewall
 * without requiring a public IP address in order to receive webhooks
 * 
 * @function
 * @private
 * @param {Object} flint - The flint object this function applies to.
 * @param {Object} webhook - The webhook handler object for this instance
 * @returns {Object}
 *
 */
function Websocket(flint, webhook) {
  this.flint = flint;
  this.webhook = webhook;
  // Todo make this more like the traditional flint "name"
  // B64 encoding of URL and bot name...
  this.name = 'webex sdk socket event';
  flint.webhook.name = this.name;
}

Websocket.prototype.init = function() {
  this.flint.webex = Webex.init({
    credentials: {
      access_token: this.flint.options.token
    }
  });

  if (!((this.flint.webex) && (this.flint.webex.canAuthorize))) {
    console.error('Unable to intiatize Webex SDK for events');
    return when(false);
  }

  // register for message, membership and room events
  let messagesPromise = this.flint.webex.messages.listen();
  let membershipsPromise = this.flint.webex.memberships.listen();
  let roomsPromise = this.flint.webex.rooms.listen();

  return Promise.all([messagesPromise, membershipsPromise, roomsPromise])
    .then(() => {
      this.flint.webex.messages.on('created', (event) => processEvent(this.flint, event, this.name));
      this.flint.webex.messages.on('deleted', (event) => processEvent(this.flint, event, this.name));
      this.flint.webex.memberships.on('created', (event) => processEvent(this.flint, event, this.name));
      this.flint.webex.memberships.on('deleted', (event) => processEvent(this.flint, event, this.name));
      this.flint.webex.memberships.on('updated', (event) => processEvent(this.flint, event, this.name));
      this.flint.webex.rooms.on('created', (event) => processEvent(this.flint, event, this.name));
      this.flint.webex.rooms.on('updated', (event) => processEvent(this.flint, event, this.name));
      console.log('Listening for webex teams events...');
      return when(true);
    })
    .catch((err) => {
      console.error(`error listening for webex teams events: ${err}`);
      return Promise.reject(err);
    });
};

Websocket.prototype.cleanup = function() {
  // register for message, membership and room events
  this.flint.webex.messages.stopListening();
  this.flint.webex.memberships.stopListening();
  this.flint.webex.rooms.stopListening();

  this.flint.webex.messages.off('created');
  this.flint.webex.messages.off('deleted');
  this.flint.webex.memberships.off('created');
  this.flint.webex.memberships.off('deleted');
  this.flint.webex.memberships.off('updated');
  this.flint.webex.rooms.off('created');
  this.flint.webex.rooms.off('updated');
  console.log('Stopped istening for webex teams events...');
  return when(true);
};

module.exports = Websocket;

