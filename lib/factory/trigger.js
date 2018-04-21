const validator = require('node-sparky/validator');
const moment = require('moment');
const when = require('when');
const _ = require('lodash');

const text = require('../text');

/*
  eslint max-len: ["error", { "code": 100, "ignoreComments": true }]
*/

class Trigger {

  constructor(flint) {
    this.flint = flint;
  }

  createFromMessage(message) {
    if (typeof message === 'object' && validator.isMessage(message)) {
      // normalize personObj
      const formatPerson = (personObj) => {
        const updatedPersonObj = personObj;

        updatedPersonObj.email = _.toLower(personObj.emails[0]);
        updatedPersonObj.username = updatedPersonObj.email.split('@')[0];
        updatedPersonObj.domain = updatedPersonObj.email.split('@')[1];

        return when(updatedPersonObj);
      };

      // take array of file URLs and return array of valid file
      const getFiles = fileUrls => when.map(fileUrls,
        fileUrl => this.flint.spark.contentGet(fileUrl)
          .catch(err => when(false))).then(results => when(_.compact(results)));

      // define main trigger object structure
      const trigger = {
        person: {
          id: message.personId,
          email: _.toLower(message.personEmail),
          username: _.toLower(message.personEmail.split('@')[0]),
          domain: _.toLower(message.personEmail.split('@')[1]),
        },
        room: {
          id: message.roomId,
          type: message.roomType,
        },
        message: {
          id: message.id,
          text: message.text.replace(/\s\s+/g, ' ').trim(),
          html: message.html,
          files: message.files || [],
          mentionedPeople: message.mentionedPeople || [],
          created: moment(message.created).toDate(),
        },
        testTrackingId: message.testTrackingId,
        created: moment().toDate(),
      };

      // Keep a copy of ourselves
      const self = this;
      // populate person
      return this.flint.spark.personGet(trigger.person.id)
        .then(person => when(_.merge(trigger.person, person)))
        .then(person => formatPerson(person))
        .then((person) => {
          trigger.person = person;
          return when(true);
        })

        // enhance message
        .then(() => {
          let normalText = text(trigger.message.text).normalize();
          /* TODO: Validate that it is intentional that this method
          // should strip of forward slashes and lowere case eveything
          // ie: change this:  "Bot /echo Repeat this back to me."
          // to:  "bot echo repeat this back to me "
          */

          // remove bot from mentioned people
          if (trigger.message.mentionedPeople.length > 0
            && _.includes(trigger.message.mentionedPeople, self.flint.person.id)
          ) {
            /* TODO This method of trying to strip the mention name out of 
            // the message depends on the mentioned name matching the displayName
            // or email.   WIth the APIs this is not necearily the case as
            // it can be set arbitrariy via the API
            // Better would be to ferret out the mention name stored in the 
            // markup field in the message object, ie:
            // markdown: "<spark-mention data-object-type=\"person\" data-object-id=\"Y2l...w\">The Bot I'm Testing</spark-mention>
            // JP didn't implement this because he's not building that yet in the spark-emulator
            */
            const botIdentities = [];
            // add bot email if email to name resolution has not yet occcurred
            botIdentities.push(self.flint.person.emails[0]); // never understood why this is an array....
            // add bot display name
            botIdentities.push(_.toLower(self.flint.person.displayName));
            // add bot first name when bot name is two or more words
            if (self.flint.person.displayName.split(' ').length > 1) {
              botIdentities.push(_.toLower(self.flint.person.displayName).split(' ')[0]);
            }
            // if bot is mentioned in first word(s)
            _.forEach(botIdentities, (botIdentity) => {
              if (normalText.indexOf(botIdentity) === 0) {
                const botIdRe = new RegExp(`^${botIdentity}`);
                normalText = normalText.replace(botIdRe, '');
              }
            });
            // TODO its also not clear this logic works if there are multiple mentions in the same message
          }

          trigger.message.normalized = normalText.trim();
          trigger.message.array = trigger.message.normalized.split(' ');
          trigger.message.words = text(trigger.message.normalized).keys(true);

          return when(true);
        })

        // process files
        .then(() => getFiles(trigger.message.files))
        .then((files) => {
          trigger.message.files = files;
          return when(true);
        })

        // return populated trigger
        .then(() => when(trigger));
    }
    return when.reject(new Error('trigger can not parse an invalid message'));
  }

}

module.exports = Trigger;
