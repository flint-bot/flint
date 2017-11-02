const _ = require('lodash');

class Storage {

  constructor(flint) {
    this.flint = flint;
    this.store = {};
  }

  create(key, val) {
    if (_.get(this.store, key)) {
      return false;
    }
    return _.set(this.store, key, val);
  }

  read(key, _default) {
    return _.get(this.store, key, _default);
  }

  update(key, val) {
    if (_.get(this.store, key)) {
      return _.set(this.store, key, val);
    }
    return false;
  }

  delete(key) {
    return _.unset(this.store, key);
  }

}

module.exports = Storage;
