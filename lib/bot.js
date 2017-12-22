const { EventEmitter } = require('events');
const when = require('when');
const _ = require('lodash');

class Bot extends EventEmitter {

  constructor(flint) {
    super();
    this.flint = flint;
  }

  build(roomId, membershipId) {
    const bot = {
      room: {
        add: () => {},
        rename: () => {},
        moderate: () => {},
        unmoderate: () => {},
        exit: () => {},
      },

      memberships: {
        add: (emails) => {
          // returns promise that resolves to string of email successfully added
          // rejects on failure
          const addEmail = (email) => {
            const personEmail = email.trim();
            if (this.flint.validator.isEmail(personEmail)) {
              return this.flint.spark.membershipAdd({ personEmail, roomId })
                .then(() => when(personEmail));
            }
            return when.reject(new Error(`invalid email "${email}" was used in bot.add()`));
          };

          // returns promise that resolves to array of emails successfully added
          // rejects when any emails aare not sucessfully added
          const addEmails = (emailArray) => {
            const personEmails = emailArray;
            return when.map(personEmails, personEmail => addEmail(personEmail).catch((err) => {
              this.flint.logger.log('error', err);
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
                  this.flint.logger.log('error', err);
                  return when.reject(err);
                });
            }

            // test if multiple emails in string
            if (personEmails.length > 1) {
              // multiple emails
              return addEmails(personEmails)
                .catch((err) => {
                  this.flint.logger.log('error', err);
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
                this.flint.logger.log('error', err);
                return when.reject(err);
              });
          }

          // default error
          const invalidArguments = new Error('invalid arguments passed to bot.add()');
          this.flint.logger.log('error', invalidArguments);
          return when.reject(invalidArguments);
        },

        remove: (emails) => {
          // returns promise that resolves to string of email successfully removed
          // rejects on failure
          const removeEmail = (email) => {
            const personEmail = email.trim();
            if (this.flint.validator.isEmail(personEmail)) {
              return this.flint.spark.membershipsGet({ personEmail, roomId })
                .then((memberships) => {
                  if (memberships instanceof Array && memberships.length === 1) {
                    return this.flint.spark.membershipRemove(memberships[0].id);
                  }
                  return when.reject(new Error(`invalid email "${email}" was used in bot.remove()`));
                })
                .then(() => when(personEmail));
            }
            return when.reject(new Error(`invalid email "${email}" was used in bot.add()`));
          };

          // returns promise that resolves to array of emails successfully removed
          // rejects when any emails aare not sucessfully added
          const removeEmails = (emailArray) => {
            const personEmails = emailArray;
            return when.map(personEmails, personEmail => removeEmail(personEmail).catch((err) => {
              this.flint.logger.log('error', err);
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
                  this.flint.logger.log('error', err);
                  return when.reject(err);
                });
            }

            // test if multiple emails in string
            if (personEmails.length > 1) {
              // multiple emails
              return removeEmails(personEmails)
                .catch((err) => {
                  this.flint.logger.log('error', err);
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
                this.flint.logger.log('error', err);
                return when.reject(err);
              });
          }

          // default error
          const invalidArguments = new Error('invalid arguments passed to bot.remove()');
          this.flint.logger.log('error', invalidArguments);
          return when.reject(invalidArguments);
        },
      },

      say: (text, file) => {
        const asText = (tx, fi) => {
          if (typeof fi === 'string') {
            // process file as local path
          }
          if (typeof fi === 'object') {
            // process file as spark file object or buffer
          }
          return this.flint.spark.messageSend({ roomId: roomId, text: tx });
        };
        const asMarkdown = (md, fi) => {
          if (typeof fi === 'string') {
            // process file as local path
          }
          if (typeof fi === 'object') {
            // process file as spark file object or buffer
          }
          return this.flint.spark.messageSend({ roomId: roomId, markdown: md });
        };

        if (typeof text === 'string') {
          return asText(text, file);
        }
        return {
          text: asText,
          markdown: asMarkdown,
        };
      },

      store: (key, val) => {},

      recall: (key) => {},

      forget: (key) => {},
    };

    return bot;
  }

  destroy(roomId) {
    this.flint.storage.delete('bots', roomId)
      .catch(err => this.flint.logger.log('error', err));
  }

}

module.exports = Bot;
