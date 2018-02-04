// error: 0,
// warn: 1,
// info: 2,
// verbose: 3,
// debug: 4,
// silly: 5

class Logger {

  constructor(flint) {
    // validate required config
    // if (!flint.config.logger) {
    //   throw new Error('invalid or missing config');
    // }
    //
    // this.config = flint.config.logger;
  }

  // level, message
  log(...args) {
    const message = args.length > 0 ? args.pop() : false;
    const level = args.length > 0 ? args.pop() : 'info';

    if (message) {
      console.log(`${level}:`, message);
    }
  }

  // Error, meta
  error(err, meta) {
    if (err) {
      console.error(err);
    }
  }

  // message, meta
  warn(message, meta) {
    if (message) {
      console.log('warn:', message);
    }
  }

  // message, meta
  info(message, meta) {
    if (message) {
      console.log('info:', message);
    }
  }

  // message, meta
  verbose(message, meta) {
    if (message) {
      console.log('verbose:', message);
    }
  }

  // message, meta
  debug(message, meta) {
    if (message) {
      console.log('debug:', message);
    }
  }

  // message, meta
  silly(message, meta) {
    if (message) {
      console.log('silly:', message);
    }
  }

}

module.exports = Logger;
