const _ = require('lodash');

const Text = (text) => {
  if (typeof text !== 'string') {
    throw new Error('argument must be a string');
  }

  const TextUtil = {
    normalize() {
      // match carriage returns / new lines
      const crRe = /[\n\r]+/g;
      // match on all non alphanumberic
      const symbolsRe = /[\W_]+/g;
      // match muliple consecutive spaces
      const spacesRe = /\s\s+/g;

      const normalizedText = text.toLowerCase()
        .replace(crRe, ' ')
        .replace(symbolsRe, ' ')
        .replace(spacesRe, ' ');

      return normalizedText;
    },

    keys(sort) {
      const normalizedText = TextUtil.normalize();
      const tokenizedText = _.uniq(normalizedText.split(' '));
      if (typeof sort === 'number' && (sort < 0 || sort > 0)) {
        tokenizedText.sort(sort);
      }
      if (typeof sort === 'boolean' && sort) {
        tokenizedText.sort(1);
      }
      return tokenizedText;
    },
  };
  return TextUtil;
};

module.exports = Text;
