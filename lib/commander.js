const when = require('when');
const _ = require('lodash');

class Commander {

  constructor(flint) {
    this.flint = flint;
  }

  message(msg) {
    // ignore messages from Bot
    if (msg.personEmail === this.flint.person.emails[0]) {
      return when(false);
    }

    return this.flint.trigger.createFromMessage(msg)
      .then(trigger => this.flint.authorization.auth(trigger))
      .then((trigger) => {
        // filter
        const foundMatches = _.filter(this.flint.lexicon, (lex) => {
          if (_.has(lex, 'phrase')) {
            // check regex phrases
            if (lex.phrase instanceof RegExp && lex.phrase.test(trigger.message.text)) {
              return true;
            }

            // check string phrases
            if (typeof lex.phrase === 'string') {
              return trigger.message.normalized.split(' ')[0] === lex.phrase;
            }

            // check array match
            if (lex.phrase instanceof Array) {
              return (_.intersection(lex.phrase, trigger.message.array).length === lex.phrase.length);
            }
          }
          return false;
        });

        if (foundMatches && foundMatches.length > 0) {
          // sort matches by preference
          let sortedMatches = _.sortBy(foundMatches, foundMatch => foundMatch.preference);
          // lowest preference number of all matches
          const prefLow = parseInt(sortedMatches[0].preference, 10);
          // highest preference number of all matches
          const prefHigh = parseInt(sortedMatches[sortedMatches.length - 1].preference, 10);
          // if all matches are not the same preference, include ONLY lowest preference matches
          if (prefLow !== prefHigh) {
            sortedMatches = _.filter(sortedMatches, sortedMatch => (sortedMatch.preference === prefLow));
          }

          return this.flint.query({ roomId: trigger.room.id })
            .then(bot => when.map(sortedMatches, sortedMatch => when.try(sortedMatch.action, bot, trigger)));
        }

        return when(true);
      })
      .catch((err) => {
        this.flint.logger.error(err);
        return when(true);
      });
  }

}

module.exports = Commander;
