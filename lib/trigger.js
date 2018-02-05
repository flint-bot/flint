const fingerprint = require('talisman/keyers/fingerprint');
const validator = require('node-sparky/validator');
const moment = require('moment');
const when = require('when');
const _ = require('lodash');

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
        updatedPersonObj.username = _.toLower(personObj.emails[0].split('@')[0]);
        updatedPersonObj.domain = _.toLower(personObj.emails[0].split('@')[1]);

        return when(updatedPersonObj);
      };

      // take a array of person Ids and return array of valid person objects
      const getPeople = personIds => when.map(personIds, personId => this.flint.spark.personGet(personId)
        .then(personObj => formatPerson(personObj))
        .catch(err => when(false)))
        .then(results => when(_.compact(results)));

      // take array of file URLs and return array of valid file
      const getFiles = fileUrls => when.map(fileUrls, fileUrl => this.flint.spark.contentGet(fileUrl)
        .catch(err => when(false)))
        .then(results => when(_.compact(results)));

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
        created: moment().toDate(),
      };

      // populate mentionedPeople
      return getPeople(trigger.message.mentionedPeople)
        .then((people) => {
          trigger.message.mentionedPeople = people;
          return when(true);
        })

        // populate person
        .then(() => this.flint.spark.personGet(trigger.person.id))
        .then(person => when(_.merge(trigger.person, person)))
        .then(person => formatPerson(person))
        .then((person) => {
          trigger.person = person;
          return when(true);
        })

        // enhance message
        .then(() => {
          // match carriage returns / new lines
          const crRe = /[\n\r]+/g;
          // match muliple consecutive spaces
          const spacesRe = /\s\s+/g;
          // match special characters from end of words only
          const normalRe = /\b[-.,/()&$#![\]{}"']+\B/g;

          const normalText = trigger.message.text
            .toLowerCase()
            .replace(crRe, ' ')
            .replace(spacesRe, ' ')
            .replace(normalRe, '');

          const botIdentities = [this.flint.person.email, _.toLower(this.flint.person.displayName)];

          trigger.message.normalized = _.difference(normalText.split(' '), botIdentities).join(' ');
          trigger.message.array = trigger.message.normalized.split(' ');
          trigger.message.words = fingerprint(trigger.message.normalized).split(' ');

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
