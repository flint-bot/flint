'use strict';

module.exports = function(flint) {

  // flint <command> <args>
  flint.hears('/f', function(bot, trigger) {
    var command = trigger.args[0] ? trigger.args.shift() : null;

    var email;
    
    switch(command) {

      case 'add':
        // add to room
        email = trigger.args;
        if(email) bot.add(email, function(err) {
          if(err) {
            console.log('error %s', err);
          }
        });
        break;

      case 'remove':
        // remove from room
        email = trigger.args;
        if(email) bot.remove(email, function(err) {
          if(err) {
            console.log('error %s', err);
          }
        });
        break;
      
      case 'inspect':
        // inspect a person
        email = trigger.args[0];
        if(email) {
          bot.inspect(email, function(err, person) {
            if(err) {
              console.log('error %s', err);
            } else {
              bot.say('%s', JSON.stringify(person));
            }
          });
        }
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