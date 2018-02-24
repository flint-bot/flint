const when = require('when');
const _ = require('lodash');

class Dialog {

  constructor(conversation) {
    this.conversation = conversation;
  }

}

class Conversation {

  constructor(flint) {
    this.flint = flint;
  }

  start(bot, trigger) {
    // if trigger is not specified, initiates a conversation is 1:1 mode
    // returns dialog object
    // TODO

    const conversation = {
      // TODO
    };

    return new Dialog(conversation);
  }

}

module.exports = Conversation;
