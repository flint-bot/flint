"use strict";

module.exports = function(flint) {
  flint.hears('hello', function(bot, trigger) {
    bot.say('Hello %s!', trigger.personDisplayName);
  });
};
