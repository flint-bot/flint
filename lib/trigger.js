const fingerprint = require('talisman/keyers/fingerprint');
const moment = require('moment');
const when = require('when');
const _ = require('lodash');

class Trigger {

  constructor(flint) {
    this.flint = flint;
  }

  createFromMessages(message) {
    if (typeof message === 'object' && _.has(message, 'personId')) {
      const trigger = _.cloneDeep(message);
      trigger.files = [];

      // normalize properties
      trigger.created = moment(trigger.created).toDate();
      trigger.personEmail = _.toLower(trigger.personEmail);

      // normalize text
      if (_.has(trigger, 'text')) {
        // normailze text
        trigger.text = trigger.text.replace(/\s\s+/g, ' ').trim();

        // define asString
        trigger.asString = trigger.text;
        // replace carriage returns / new lines with a space
        trigger.asString = trigger.asString.toLowerCase().replace(/[\n\r]+/g, ' ');
        // remove all consecutive white space characters
        trigger.asString = trigger.asString.replace(/\s\s+/g, ' ');
        // remove special characters from end of words only.
        trigger.asString = trigger.asString.replace(/\b[-.,/()&$#![\]{}"']+\B/g, '');
        // remove bot email/displayName
        trigger.asString = _.difference(trigger.asString.split(' '),
          [this.flint.person.emails[0], _.toLower(this.flint.person.displayName)])
          .join(' ');

        // define asArray
        trigger.asArray = trigger.asString
          // .replace(/[^\sa-z0-9+]+/gi, '')
          // .replace(/\b[-.,()&$#![\]{}"']+\B|\B[-.,()&$#![\]{}"']+\b/g, '')
          .replace(/\b[^a-z0-9+]+\B|\B[^a-z0-9+]+\b/gi, ' ')
          .replace(/\s\s+/g, ' ')
          .trim()
          .split(' ');

        // nlp tools
        const f = fingerprint(trigger.asString);
        trigger.words = f.split(' ');
      }

      // enhance trigger richness
      return this.flint.spark.personGet(trigger.personId)
        .then((person) => {
          trigger.personDisplayName = person.displayName;
          trigger.personUsername = _.toLower(person.emails[0].split('@')[0]);
          trigger.personDomain = _.toLower(person.emails[0].split('@')[1]);
          trigger.personAvatar = person.avatar || false;
          return when(true);
        })
        .then(() => this.flint.spark.roomGet(trigger.roomId))
        .then((room) => {
          trigger.roomTitle = room.title;
          trigger.roomIsLocked = room.isLocked;
        })
        .then(() => this.flint.spark.membershipsGet())
        .then((memberships) => {
          const roomMembership = _.find(memberships, (membership) => {
            const found = (membership.roomId === trigger.roomId);
            return found;
          });
          trigger.membershipId = roomMembership.id || false;
          trigger.isModerator = roomMembership.isModerator || false;
          trigger.isMonitor = roomMembership.isMonitor || false;
          trigger.personOrgId = roomMembership.personOrgId || false;
        })
        .then(() => {
          if (_.has(message, 'files') && message.files instanceof Array) {
            return when.map(message.files, url => this.flint.spark.contentGet(url)
              .then(file => trigger.files.push(file))
              .catch(() => when(false)));
          }
          return when(true);
        })
        .then(() => {
          if (_.has(trigger, 'mentionedPeople') && trigger.mentionedPeople instanceof Array) {
            if (_.includes(trigger.mentionedPeople, this.flint.person.id)) {
              this.flint.emit('mentioned', this.flint.bot.build(trigger.roomId, trigger.membershipId), trigger);
            }
          }
          return when(trigger);
        })
        .catch((err) => {
          this.flint.logger.log('error', err);
          trigger.personDisplayName = trigger.personEmail;
          trigger.personUsername = trigger.personEmail.split('@')[0];
          trigger.personDomain = trigger.personEmail.split('@')[1];
          trigger.files = message.files;
          return when(trigger);
        });
    }
    return when.reject(new Error('trigger can not parse an invalid message'));
  }

}

module.exports = Trigger;
