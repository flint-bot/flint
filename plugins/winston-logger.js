const winston = require('winston');

class Logger {

  constructor() {
    this.winston = new winston.Logger({
      transports: [
        new (winston.transports.Console)({
          colorize: true,
          timestamp: true,
        }),
      ],
    });
  }

  // level, message
  log(...args) {
    const message = args.length > 0 ? args.pop() : false;
    const level = args.length > 0 ? args.pop() : 'info';
    if (message) {
      this.winston.log(level, message);
    }
  }

}

module.exports = Logger;
