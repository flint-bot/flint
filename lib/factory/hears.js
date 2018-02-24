const uuid = require('uuid/v4');
const when = require('when');
const _ = require('lodash');

class Hears {

  constructor(flint) {
    this.flint = flint;
    this.lexicon = [];
  }

  phrase(_phrase, _action, _preference) {
    const phrase = typeof _phrase === 'string' ? _.toLower(_phrase) : undefined;
    const action = typeof _action === 'function' ? _action : undefined;
    const preference = typeof _preference === 'number' ? _preference : 0;
    const type = 'phrase';
    const id = uuid();

    if (phrase && action) {
      const hearsObj = { id, phrase, action, preference, type };
      this.lexicon.push(hearsObj);
      return hearsObj;
    }

    throw new Error('Invalid flint.hears.phrase() syntax');
  }

  pattern(_phrase, _action, _preference) {
    const phrase = _phrase instanceof RegExp ? _phrase : undefined;
    const action = typeof _action === 'function' ? _action : undefined;
    const preference = typeof _preference === 'number' ? _preference : 0;
    const type = 'pattern';
    const id = uuid();

    if (phrase && action) {
      const hearsObj = { id, phrase, action, preference, type };
      this.lexicon.push(hearsObj);
      return hearsObj;
    }

    throw new Error('Invalid flint.hears.pattern() syntax');
  }

  words(_phrase, _action, _preference) {
    const phrase = _phrase instanceof Array && _.every(_phrase, String) ? _phrase : undefined;
    const action = typeof _action === 'function' ? _action : undefined;
    const preference = typeof _preference === 'number' ? _preference : 0;
    const type = 'words';
    const id = uuid();

    if (phrase && action) {
      const hearsObj = { id, phrase, action, preference, type };
      this.lexicon.push(hearsObj);
      return hearsObj;
    }

    throw new Error('Invalid flint.hears.phrase() syntax');
  }

  match(_text) {
    if (typeof _text === 'string') {
      const text = _text;
      const textNormalized = _.toLower(text);
      const textArray = textNormalized.split(' ');

      const foundMatches = _.filter(this.lexicon, (lex) => {
        // check regex phrases
        if (lex.type === 'pattern') {
          return (lex.phrase.test(text));
        }

        // check string phrases
        if (lex.type === 'phrase') {
          return (textArray[0] === lex.phrase);
        }

        // check words match
        if (lex.type === 'words') {
          return (_.intersection(lex.phrase, textArray).length === lex.phrase.length);
        }

        return false;
      });

      if (foundMatches && foundMatches instanceof Array && foundMatches.length > 0) {
        return foundMatches;
      }
      return false;
    }
    return false;
  }

  // remove a hears action
  destroy(hearsObjOrID) {
    let hearsObj = null;

    if (typeof hearsObjOrID === 'string') {
      hearsObj = _.find(this.lexicon, { id: hearsObjOrID });
    }

    if (typeof hearsObjOrID === 'object' && _.has(hearsObjOrID, 'id')) {
      hearsObj = _.find(this.lexicon, { id: hearsObjOrID.id });
    }

    if (hearsObj) {
      this.lexicon = _.differenceBy(this.lexicon, [hearsObj], 'id');
    }

    return when(true);
  }

}

module.exports = Hears;
