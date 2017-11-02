const { EventEmitter } = require('events');
// const validator = require('node-sparky/validator');
const when = require('when');
const _ = require('lodash');

class Bot extends EventEmitter {

  constructor(flint) {
    super();
    this.flint = flint;
  }

  frame(roomId) {
    const bot = {
      roomId: roomId,
      spark: this.flint.spark,
      person: this.flint.person(),

      storage: {
        create: (key, val) => this.flint.storage.create(`bots.${roomId}.storage.${key}`, val),
        read: key => this.flint.storage.read(`bots.${roomId}.storage.${key}`),
        update: (key, val) => this.flint.storage.update(`bots.${roomId}.storage.${key}`, val),
        delete: key => this.flint.storage.delete(`bots.${roomId}.storage.${key}`),
      },

      add: personEmail => this.flint.spark.membershipAdd({ personEmail, roomId }),

      remove: personEmail => this.flint.spark.membershipsGet({ personEmail, roomId })
        .then((memberships) => {
          if (memberships instanceof Array && memberships.length === 1) {
            return this.flint.spark.membershipRemove(memberships[0].id);
          }
          return when(false);
        }),

      say: (text) => {
        const asText = tx => this.flint.spark.messageSend({ roomId: roomId, text: tx });
        const asMarkdown = md => this.flint.spark.messageSend({ roomId: roomId, markdown: md });

        if (typeof text === 'string') {
          return asText(text);
        }
        return {
          text: asText,
          markdown: asMarkdown,
        };
      },
    };

    return bot;
  }

  load(roomId) {
    return this.flint.spark.roomGet(roomId)
      .then((room) => {
        this.flint.storage.create(`bots.${roomId}.room`, room);
        return when(room);
      })
      .then(() => this.flint.spark.membershipsGet({ roomId }))
      .then((memberships) => {
        const botMembership = _.find(memberships, { personEmail: this.flint.person().emails[0] });
        if (botMembership) {
          this.flint.storage.create(`bots.${roomId}.membership`, botMembership);
        }
        this.flint.storage.create(`bots.${roomId}.memberships`, memberships);
        return when(memberships);
      });
  }

  reload(roomId) {
    return this.flint.spark.roomGet(roomId)
      .then((room) => {
        this.flint.storage.update(`bots.${roomId}.room`, room);
        return when(room);
      })
      .then(() => this.flint.spark.membershipsGet({ roomId }))
      .then((memberships) => {
        const botMembership = _.find(memberships, { personEmail: this.flint.person().emails[0] });
        if (botMembership) {
          this.flint.storage.update(`bots.${roomId}.membership`, botMembership);
        }
        this.flint.storage.update(`bots.${roomId}.memberships`, memberships);
        return when(memberships);
      });
  }

  build(roomId) {
    return this.load(roomId)
      .then(() => {
        const bot = this.frame(roomId);
        bot.room = this.flint.storage.read(`bots.${roomId}.room`, false);
        bot.membership = this.flint.storage.read(`bots.${roomId}.membership`, false);
        bot.memberships = this.flint.storage.read(`bots.${roomId}.memberships`, []);
        return when(bot);
      });
  }

  query(roomId) {
    const bot = this.frame(roomId);
    bot.room = this.flint.storage.read(`bots.${roomId}.room`, false);
    bot.membership = this.flint.storage.read(`bots.${roomId}.membership`, false);
    bot.memberships = this.flint.storage.read(`bots.${roomId}.memberships`, []);
    return when(bot);
  }

  patch(roomId) {
    return this.reload(roomId)
      .then(() => {
        const bot = this.frame(roomId);
        bot.room = this.flint.storage.read(`bots.${roomId}.room`, false);
        bot.membership = this.flint.storage.read(`bots.${roomId}.membership`, false);
        bot.memberships = this.flint.storage.read(`bots.${roomId}.memberships`, []);
        return when(bot);
      });
  }

  destroy(roomId) {
    this.flint.storage.delete(`bots.${roomId}`);
    return when(true);
  }

}

module.exports = Bot;
