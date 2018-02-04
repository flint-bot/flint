const when = require('when');

class Authorization {

  constructor(flint) {
    // validate required config
    // if (!flint.config.authorization) {
    //   throw new Error('invalid or missing config');
    // }
    //
    // this.config = flint.config.authorization;
  }

  auth(trigger) {
    // analyze trigger object
    if (trigger) {
      // perform other checks...
      // if good, return promise with trigger object
      return when(trigger);
    }
    // default deny if previous checks do not pass
    return when.reject(new Error('invalid authorization'));
  }

}

module.exports = Authorization;
