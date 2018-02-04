const when = require('when');

class Authorization {

  constructor(flint) {}

  auth(trigger) {
    return when(trigger);
  }

}

module.exports = Authorization;
