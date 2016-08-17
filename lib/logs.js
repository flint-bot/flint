var util = require('util');
var _ = require('lodash');

module.exports = function(flint) {

  flint.on('initialized', function(id) {
    var msg = util.format('(Flint Initialized) %s rooms', flint.bots.length);
    flint.log(msg);
  });

  flint.on('start', function(id) {
    var msg = util.format('(Flint Started) "%s"', flint.email);
    flint.log(msg);
  });

  flint.on('stop', function(id) {
    var msg = util.format('(Flint Stopped) "%s"', flint.email);
    flint.log(msg);
  });

  flint.on('spawn', (bot, id) => {
    var msg = util.format('(Room Discovered) "%s"', bot.room.title);
    flint.log(msg);
  });

  flint.on('despawn', (bot, id) => {
    var msg = util.format('(Room Removed) "%s"', bot.room.title);
    flint.log(msg);
  });

  flint.on('message', (bot, trigger, id) => {
    var msg = util.format('(Messsage Received) "%s" "%s" "%s"', bot.room.title, trigger.personEmail, trigger.text);
    flint.log(msg);
  });

  flint.on('files', (bot, trigger, id) => {
    _.forEach(trigger.files, file => {
      var msg = util.format('(File Uploaded) "%s" "%s" "%s"', bot.room.title, trigger.personEmail, file.name);
      flint.log(msg);
    });
  });

  flint.on('roomLocked', (bot, id) => {
    var msg = util.format('(Room moderated) "%s"', bot.room.title);
    flint.log(msg);
  });

  flint.on('roomUnlocked', (bot, id) => {
    var msg = util.format('(Room unmoderated) "%s"', bot.room.title);
    flint.log(msg);
  });

  flint.on('botAddedAsModerator', (bot, id) => {
    var msg = util.format('(Added as Room Moderator) "%s" "%s"', bot.room.title, bot.email);
    flint.log(msg);
  });

  flint.on('botRemovedAsModerator', (bot, id) => {
    var msg = util.format('(Removed as Room Moderator) "%s" "%s"', bot.room.title, bot.email);
    flint.log(msg);
  });

  flint.on('personAddedAsModerator', (bot, person, id) => {
    var msg = util.format('(Added as Room Moderator) "%s" "%s"', bot.room.title, person.email);
    flint.log(msg);
  });

  flint.on('personRemovedAsModerator', (bot, person, id) => {
    var msg = util.format('(Removed as Room Moderator) "%s" "%s"', bot.room.title, person.email);
    flint.log(msg);
  });

  flint.on('personEnters', function(bot, person, id) {
    var msg = util.format('(Room Entered) "%s" "%s"', bot.room.title, person.email);
    flint.log(msg);
  });

  flint.on('personExits', function(bot, person, id) {
    var msg = util.format('(Room Exited) "%s" "%s"', bot.room.title, person.email);
    flint.log(msg);
  });

};
