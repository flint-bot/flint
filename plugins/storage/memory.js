const when = require('when');
const _ = require('lodash');

class Storage {

  constructor(flint) {
    this.flint = flint;
    this.store = {};
  }

  // called by flint when starting...
  start() {
    return when(true);
  }

  // called by flint when stopping...
  stop() {
    return when(true);
  }

  // name, key, [val]
  create(...args) {
    // reject if flint is not active
    if (!this.flint.active) {
      return when.reject(new Error('flint is currently stopped'));
    }

    const name = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const key = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const val = args.length > 0 && typeof args[0] !== 'undefined' ? args.shift() : false;

    let valPath = '';
    if (name && key) {
      valPath += `${name}.${key}`;
      if (val) {
        _.set(this.store, valPath, val);
      } else {
        _.set(this.store, valPath, null);
      }
      return when(_.get(this.store, valPath));
    }
    return when.reject(new Error('invalid args'));
  }

  // name, [key]
  read(...args) {
    // reject if flint is not active
    if (!this.flint.active) {
      return when.reject(new Error('flint is currently stopped'));
    }

    const name = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const key = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;

    let valPath = '';
    if (name) {
      valPath += name;
      if (key) {
        valPath += `.${key}`;
      }

      const val = _.get(this.store, valPath, false);

      if (val) {
        return when(val);
      }
      return when.reject(new Error('not found'));
    }
    return when.reject(new Error('invalid args'));
  }

  // name, [key]
  delete(...args) {
    // reject if flint is not active
    if (!this.flint.active) {
      return when.reject(new Error('flint is currently stopped'));
    }

    const name = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;
    const key = args.length > 0 && typeof args[0] === 'string' ? args.shift() : false;

    let valPath = '';
    if (name) {
      valPath += name;
      if (key) {
        valPath += `.${key}`;
      }
    }
    _.unset(this.store, valPath);
    return when(true);
  }

}

module.exports = Storage;
