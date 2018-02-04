const winston = require('winston');

// error: 0,
// warn: 1,
// info: 2,
// verbose: 3,
// debug: 4,
// silly: 5

class Logger {

  constructor(flint) {
    // validate required config
    if (!flint.config.logger) {
      throw new Error('invalid or missing config');
    }

    this.config = flint.config.logger;

    this.winston = new winston.Logger({
      transports: this.config.transports,
    });
  }

  static get winston() {
    return winston;
  }

  // level, message, meta
  log(...args) {
    const message = args.length > 0 ? args.pop() : false;
    const level = args.length > 0 ? args.pop() : 'info';

    if (message) {
      this.winston.log(level, message);
    }
  }

  // message, meta
  error(...args) {
    const message = args.length > 0 ? args.shift() : false;

    if (message) {
      this.winston.error(...args);
    }
  }

  // message, meta
  warn(...args) {
    const message = args.length > 0 ? args[0] : false;

    if (message) {
      this.winston.warn(...args);
    }
  }

  // message, meta
  info(...args) {
    const message = args.length > 0 ? args[0] : false;

    if (message) {
      this.winston.info(...args);
    }
  }

  // message, meta
  verbose(...args) {
    const message = args.length > 0 ? args[0] : false;

    if (message) {
      this.winston.verbose(...args);
    }
  }

  // message, meta
  debug(...args) {
    const message = args.length > 0 ? args[0] : false;

    if (message) {
      this.winston.debug(...args);
    }
  }

  // message, meta
  silly(...args) {
    const message = args.length > 0 ? args[0] : false;

    if (message) {
      this.winston.silly(...args);
    }
  }

}

module.exports = Logger;
