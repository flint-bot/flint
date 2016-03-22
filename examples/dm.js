var Flint = require('node-flint');

// define flint setup
var config = {
  // url to access this app's webservice
  baseUrl: 'http://webhook.url',
  // port that local server listens on
  localPort: 80,
  // spark account email
  sparkEmail: '<spark-email>',
  // spark api token
  sparkToken: '<token>'
};

// init flint framework
var flint = new Flint(config);

// echo test
flint.hears('/echo', function(bot, trigger) {
  bot.say(trigger.args.join(' '));
});

// domain name to use for @name format
var domain = '@domain.com';

// dm (@name | <email>) <message>
flint.hears('/dm', function(bot, trigger) {
  // manually parse message
  var message = trigger.message.text ? trigger.message.text.split(' ') : null;
  var command = message ? message.shift() : null;
  var name = message ? message.shift() : null;
  var email;
  
  if(!name || !message) {
    bot.say('%s, I was unable to deliver your message.', trigger.person.displayName);
    return;
  } else {
    // convert @name to email
    email = name.charAt(0) === '@' ? name.slice(1) + domain : name;

    // format message
    message = trigger.person.displayName + ' <' + trigger.person.emails[0] + '> says:\n' + message.join(' ');
    
    // send message directly to person
    bot.dm(email, message, function(err) {
      if(err) {
        bot.say('%s, I was unable to deliver your message.', trigger.person.displayName);
      } else {
        bot.say('%s, your message was sent to %s.', trigger.person.displayName, email);
      }
    });
  }
  
});