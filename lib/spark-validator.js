'use strict';

var _ = require('lodash');

var SparkValidator = {

  isRoom: function(room) {
    if(room instanceof Array) room = room[0];
    var result = (typeof room === 'object'
      && room.id
      && room.title
      && room.created
    );
    return result;
  },

  isPerson: function(person) {
    if(person instanceof Array) person = person[0];
    var result = (typeof person === 'object'
      && person.id
      && person.displayName
      && person.created
      && person.avatar
      && person.emails 
    );
    return result;
  },

  isMessage: function(message) {
    if(message instanceof Array) message = message[0];
    var result = (typeof message === 'object'
      && message.id
      && message.personId
      && message.personEmail
      && message.created
      && (message.text || message.files)
    );
    return result;
  },

  isMembership: function(membership) {
    if(membership instanceof Array) membership = membership[0];
    var result = (typeof membership === 'object'
      && membership.id
      && membership.personId
      && membership.personEmail
      && membership.created
    );
    return result;
  },

  isWebhook: function(webhook) {
    if(webhook instanceof Array) webhook = webhook[0];
    var result = (typeof webhook === 'object'
      && webhook.id
      && webhook.name
      && webhook.targetUrl
      && webhook.resource
      && webhook.event
      && webhook.filter
    );
    return result;
  },
  
  //
  // collection testing
  //
  
  isRooms: function(rooms) {
    if(rooms instanceof Array) {
      return _.every(rooms, SparkValidator.isRoom);
    } else {
      return false;
    }
  },
  
  isPeople: function(people) {
    if(people instanceof Array) {
      return _.every(people, SparkValidator.isPerson);
    } else {
      return false;
    }
  },
  
  isMessages: function(messages) {
    if(messages instanceof Array) {
      return _.every(messages, SparkValidator.isMessage);
    } else {
      return false;
    }
  },
  
  isMemberships: function(memberships) {
    if(memberships instanceof Array) {
      return _.every(memberships, SparkValidator.isMembership);
    } else {
      return false;
    }
  },
  
  isWebhooks: function(webhooks) {
    if(webhooks instanceof Array) {
      return _.every(webhooks, SparkValidator.isWebhook);
    } else {
      return false;
    }
  },
  
  
  // inverse testing
  isNotRoom: function(room) { return !SparkValidator.isRoom(room) },
  isNotPerson: function(person) { return !SparkValidator.isPerson(person) },
  isNotMessage: function(message) { return !SparkValidator.isMessage(message) },
  isNotMembership: function(membership) { return !SparkValidator.isMembership(membership) },
  isNotWebhook: function(webhook) { return !SparkValidator.isWebhook(webhook) }

};

module.exports = SparkValidator;