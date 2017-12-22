const when = require('when');

class Authorization {

  constructor() {
    return trigger => when(trigger);
  }

}

module.exports = Authorization;
