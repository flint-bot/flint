const moment = require('moment');
const when = require('when');
const _ = require('lodash');

class Bot {

  constructor(flint) {
    this.flint = flint;
  }

  build(_room, _membership) {
    const room = _room;
    const membership = _membership;

    // fix dates
    room.lastActivity = moment(room.lastActivity).toDate();
    room.created = moment(room.created).toDate();
    membership.created = moment(membership.created).toDate();

    const bot = {
      room: {
        info: room,

        /**
         * Instructs Bot to exit from space. Removes storage associated with
         * this space.
         *
         * @function
         * @returns {Promise.<Boolean>} Promise
         *
         * @example
         * bot.exit();
         */
        exit: () => this.flint.spark.membershipRemove(membership.id)
          .then(() => this.flint.bot.destroy(room.id)),

        moderate: (emails) => {
          // moderate this room
          // bot assigns self as moderator
          // returns promise of this bot object
          // rejects if room is a team sub room
          // rejects if room is already moderated and bot is not a moderator
          // TODO
        },

        unmoderate: (emails) => {
          // moderate this room
          // bot assigns self as moderator
          // returns promise of this bot object
          // rejects if room is a team sub room
          // rejects if room is already moderated and bot is not a moderator
          // TODO
        },

        memberships: () => this.flint.spark.membershipsGet({ roomId: _room.id })
          .then((memberships) => {
            const updatedMemberships = _.differenceBy(memberships, [membership], 'id');
            return when(updatedMemberships);
          }),
      },

      membership: {
        info: membership,
        add: (emails) => {
          // returns promise that resolves to string of email successfully added
          // rejects on failure
          const addEmail = (email) => {
            const personEmail = email.trim();
            if (this.flint.validator.isEmail(personEmail)) {
              const roomId = room.id;
              return this.flint.spark.membershipAdd({ personEmail, roomId })
                .delay(200)
                .then(() => when(personEmail));
            }
            return when.reject(new Error(`invalid email "${email}" was used in bot.add()`));
          };

          // returns promise that resolves to array of emails successfully added
          // rejects when any emails aare not sucessfully added
          const addEmails = (emailArray) => {
            const personEmails = emailArray;
            return when.map(personEmails, personEmail => addEmail(personEmail).catch((err) => {
              this.flint.logger.error(err);
              return when(false);
            })).then((results) => {
              const successfulAdds = _.compact(results);
              if (successfulAdds.length < results.length) {
                const addEmailsError = new Error('all emails were not sucessfully added (see err.status)');
                addEmailsError.status = {
                  added: successfulAdds,
                  total_count: parseInt(results.length, 10),
                  failed_count: parseInt(results.length - successfulAdds.length, 10),
                  sucessful_count: parseInt(successfulAdds.length, 10),
                };
                return when.reject(addEmailsError);
              }
              return successfulAdds;
            });
          };

          // if emails is a string
          if (typeof emails === 'string') {
            // clean up / normalize email string
            const personEmails = _.compact(emails
              // replace common delimiters with a space
              .replace(/[,|\t|\n|\n\r]/g, ' ')
              // remove leading and trailing deal=d space
              .trim()
              // remove consecutive white space characters
              .replace(/\s\s/g, ' ')
              // split into space delimited array
              .split(' '));

            // test if single email in string
            if (personEmails.length === 1) {
              return addEmail(personEmails[0])
                .catch((err) => {
                  this.flint.logger.error(err);
                  return when.reject(err);
                });
            }

            // test if multiple emails in string
            if (personEmails.length > 1) {
              // multiple emails
              return addEmails(personEmails)
                .catch((err) => {
                  this.flint.logger.error(err);
                  return when.reject(err);
                });
            }
          }

          // if emails is an array of emails
          if (typeof emails === 'object' && emails instanceof Array) {
            const personEmails = emails;
            // multiple emails in array
            return addEmails(personEmails)
              .catch((err) => {
                this.flint.logger.error(err);
                return when.reject(err);
              });
          }

          // default error
          const invalidArguments = new Error('invalid arguments passed to bot.add()');
          this.flint.logger.error(invalidArguments);
          return when.reject(invalidArguments);
        },

        remove: (emails) => {
          // returns promise that resolves to string of email successfully removed
          // rejects on failure
          const removeEmail = (email) => {
            const personEmail = email.trim();
            if (this.flint.validator.isEmail(personEmail)) {
              const roomId = room.id;
              return this.flint.spark.membershipsGet({ personEmail, roomId })
                .then((memberships) => {
                  if (memberships instanceof Array && memberships.length === 1) {
                    return this.flint.spark.membershipRemove(memberships[0].id);
                  }
                  return when.reject(new Error(`invalid email "${email}" was used in bot.remove()`));
                })
                .delay(200)
                .then(() => when(personEmail));
            }
            return when.reject(new Error(`invalid email "${email}" was used in bot.add()`));
          };

          // returns promise that resolves to array of emails successfully removed
          // rejects when any emails aare not sucessfully added
          const removeEmails = (emailArray) => {
            const personEmails = emailArray;
            return when.map(personEmails, personEmail => removeEmail(personEmail).catch((err) => {
              this.flint.logger.error(err);
              return when(false);
            })).then((results) => {
              const successfulRemoves = _.compact(results);
              if (successfulRemoves.length < results.length) {
                const removeEmailsError = new Error('all emails were not sucessfully removed (see err.status)');
                removeEmailsError.status = {
                  removed: successfulRemoves,
                  total_count: parseInt(results.length, 10),
                  failed_count: parseInt(results.length - successfulRemoves.length, 10),
                  sucessful_count: parseInt(successfulRemoves.length, 10),
                };
                return when.reject(removeEmailsError);
              }
              return successfulRemoves;
            });
          };

          // if emails is a string
          if (typeof emails === 'string') {
            // clean up / normalize email string
            const personEmails = _.compact(emails
              // replace common delimiters with a space
              .replace(/[,|\t|\n|\n\r]/g, ' ')
              // remove leading and trailing deal=d space
              .trim()
              // remove consecutive white space characters
              .replace(/\s\s/g, ' ')
              // split into space delimited array
              .split(' '));

            // test if single email in string
            if (personEmails.length === 1) {
              return removeEmail(personEmails[0])
                .catch((err) => {
                  this.flint.logger.error(err);
                  return when.reject(err);
                });
            }

            // test if multiple emails in string
            if (personEmails.length > 1) {
              // multiple emails
              return removeEmails(personEmails)
                .catch((err) => {
                  this.flint.logger.error(err);
                  return when.reject(err);
                });
            }
          }

          // if emails is an array of emails
          if (typeof emails === 'object' && emails instanceof Array) {
            const personEmails = emails;
            // multiple emails in array
            return removeEmails(personEmails)
              .catch((err) => {
                this.flint.logger.error(err);
                return when.reject(err);
              });
          }

          // default error
          const invalidArguments = new Error('invalid arguments passed to bot.remove()');
          this.flint.logger.error(invalidArguments);
          return when.reject(invalidArguments);
        },
      },

      say: (text, file) => { // TODO process file
        // send message as text with optional file
        const asText = () => {
          return this.flint.spark.messageSend({ roomId: room.id, text: text });
        };

        // send message as markdown with optional file
        const asMarkdown = () => {
          return this.flint.spark.messageSend({ roomId: room.id, markdown: text });
        };

        return {
          text: asText,
          markdown: asMarkdown,
        };
      },

      message: (email, text, file) => this.flint.message(email, text, file),

      /**
       * Store key/value data.
       *
       * @function
       * @param {String} key Key
       * @param {(String|Number|Boolean|Array|Object)} value Value
       * @returns {(Promise.<String>|Promise.<Number>|Promise.<Boolean>|Promise.<Array>|Promise.<Object>)} Promise
       */
      store: (key, value) => this.flint.storage.create(room.id, key, value),

      /**
       * Recall value of data stored by 'key'.
       *
       * @function
       * @param {String} [key] Key
       * @returns {(Promise.<String>|Promise.<Number>|Promise.<Boolean>|Promise.<Array>|Promise.<Object>)} Promise
       */
      recall: key => this.flint.storage.read(room.id, key),

      /**
       * Forget a key or entire store.
       *
       * @function
       * @param {String} [key] Key
       * @returns {(Promise.<String>|Promise.<Number>|Promise.<Boolean>|Promise.<Array>|Promise.<Object>)} Promise
       */
      forget: key => this.flint.storage.delete(room.id, key),
    };

    return bot;
  }

  destroy(roomId) {
    // clean up operations
    return this.flint.storage.delete(roomId);
  }

}

module.exports = Bot;
