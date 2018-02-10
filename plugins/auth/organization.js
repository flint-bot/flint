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
    if (trigger
      && _.has(trigger.person, 'orgId')
      && _.includes(this.config.orgIds, trigger.person.orgId)
    ) {
      return when(trigger);
    }
    // default deny
    return when.reject(new Error('invalid authorization'));
  }

}

module.exports = Authorization;
