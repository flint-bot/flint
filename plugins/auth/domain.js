const when = require('when');
const _ = require('lodash');

class Authorization {

  constructor(flint) {
    // validate required config
    if (!flint.config.authorization) {
      throw new Error('invalid or missing config');
    }

    this.config = flint.config.authorization;
  }

  auth(trigger) {
    // analyze trigger object
    if (trigger && _.includes(this.config.domains, trigger.person.domain)) {
      return when(trigger);
    }
    // default deny
    return when.reject(new Error('invalid authorization'));
  }

}

module.exports = Authorization;
