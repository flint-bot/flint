'use strict';

var debug = require('debug')('flint');
var validator = require('validator');
var moment = require('moment');

module.exports = function(flint) {

  flint.on('spawn', function(bot) {
    // debug('new bot spawned in room: %s', bot.myroom.title);
  });
  
  flint.on('despawn', function(bot) {
    // debug('bot despawned in room: %s', bot.myroom.title);
  });
  
  flint.on('message', function(message, bot) {
    // debug('"%s" said "%s" in room "%s"', message.personEmail, message.text, bot.myroom.title);
  });
  
  flint.on('file', function(file, bot) {
    // debug('recieved file "%s"', file.name);
  });
  
  flint.on('error', function(err) {
    debug(err);
  });

  // flint <command> <args>
  flint.hears('/flint', function(bot, trigger) {
    var command = trigger.args[0] ? trigger.args.shift() : null;
    
    switch(command) {

      case 'add':
        // add to room
        var email = trigger.args;
        if(email) bot.add(email, function(err) {
          if(err) {
            console.log('error %s', err);
          }
        });
        break;

      case 'remove':
        // remove from room
        var remove = trigger.args;
        if(remove) bot.remove(remove, function(err) {
          if(err) {
            console.log('error %s', err);
          }
        });
        break;
      
      case 'inspect':
        // inspect a person
        var inspect = trigger.args[0];
        if(inspect) {
          bot.inspect(inspect, function(err, person) {
            if(err) {
              console.log('error %s', err);
            } else {
              bot.say('%s', JSON.stringify(person));
            }
          });
        }
        break;

      case 'say':
        var say = trigger.message.text.split(' ');
        say = say.slice(2);
        say = say.join(' ');
        bot.say(say);
        break;

      case 'broadcast':
        var bc = trigger.message.text.split(' ');
        bc = bc.slice(2);
        bc = bc.join(' ');
        flint.say(bc);
        break;
      
      case 'rollcall':
        // get all email addresses for room
        bot.rollcall(function(err, emails) {
          if(err) {
            console.log('error %s', err);
          } else {
            bot.say(emails.join('\n'));
          }
        });
        break;

      case 'room':
        // create a new room
        if(trigger.args.length > 0) {
          // add the person who typed command
          trigger.args.push(trigger.message.personEmail);
          // create room with people
          bot.room(trigger.person.displayName + '\'s Room', trigger.args, function(err) {
            if(err) {
              console.log('error %s', err);
            }
          });
        }
        break;

      case 'implode':
        // remove all from room and delete room
        bot.implode(function(err) {
          if(err) {
            console.log('error %s', err);
          }
        });
        break;

      case 'download':
        var urlDefault = 'https://i.imgflip.com/8ee46.jpg';
        var url;
        if(trigger.args.length > 0 && typeof trigger.args[0] === 'string') {
          url = validator.isURL(trigger.args[0]) ? trigger.args[0] : urlDefault;
        } else {
          url = urlDefault;
        }
        bot.file(url);
        break;

      case 'avatar':
        var avatar = trigger.args[0];
        avatar = avatar || bot.myemail;
        if(avatar) {
          bot.inspect(avatar, function(err, person) {
            if(!err && person.avatar && validator.isURL(person.avatar)) {
              bot.file(person.avatar);
            }
          });
        }
        break;

      case 'debug':
        bot.say('person who ran this command:\n%s\n\n', JSON.stringify(trigger.person));
        bot.say('this room:\n%s\n\n', JSON.stringify(trigger.room));
        bot.say('total rooms: %s\n\n', flint.bots.length);
        bot.isModerated(function(isModerated) {
          if(isModerated) {
            bot.say('This is room is moderated');
          } else {
            bot.say('This room is not moderated');
          }
        });
        break;

      case 'exit':
        // ask bot to exit room
        bot.exit();
        break;

      case 'exit-all':
        // ask bot to exit all rooms
        flint.exit();
        break;

      default:
        // unrecognized command
        bot.say('Hello, %s!', trigger.person.displayName, function(err) {
          if(err) {
            console.log('error %s', err);
          }
        });
        break;
    }

  });

};