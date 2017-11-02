const when = require('when');
const _ = require('lodash');

class Commander {

  constructor(flint) {
    this.flint = flint;
  }

  message(msg) {
    // ignore messages from bot
    if (msg.personEmail === this.flint.person().emails[0]) {
      return when(false);
    }

    // function to find and execute lexicon match from msg
    const findLex = (trigger) => {
      const foundMatches = _.filter(this.flint.lexicon, (lex) => {
        if (_.has(lex, 'phrase')) {
          // check regex phrases
          if (lex.phrase instanceof RegExp && lex.phrase.test(trigger.text)) {
            return true;
          }

          // check string phrases
          if (typeof lex.phrase === 'string') {
            return trigger.asString.split(' ')[0] === lex.phrase;
          }

          // check array match
          if (lex.phrase instanceof Array) {
            return (_.intersection(lex.phrase, trigger.asArray).length === lex.phrase.length);
          }
        }
        return false;
      });

      if (foundMatches && foundMatches.length > 0) {
        this.flint.bot.query(trigger.roomId)
          .then((bot) => {
            _.forEach(foundMatches, foundMatch => foundMatch.action(bot, trigger));
            return when(true);
          })
          .catch(err => console.error(err));
      }
    };

    this.flint.trigger.create(msg)
      .then((trigger) => {
        const botData = this.flint.storage.read(`bots.${trigger.roomId}`, false);

        if (botData) {
          findLex(trigger);
        }
        return when(trigger);
      })
      .catch(err => console.error(err));

    return when(true);
  }

}

module.exports = Commander;
