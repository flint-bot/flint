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

// add a person or people to room by email
flint.hears('/add', function(bot, trigger) {
  var email = trigger.args;
  if(email) bot.add(email);
});

// remove a person or people from room by email
flint.hears('/remove', function(bot, trigger) {
  var email = trigger.args;
  if(email) bot.remove(email);
});

// create a new room with people by email
flint.hears('/room', function(bot, trigger) {
  if(trigger.args.length > 0) {
    // add the person who typed command
    trigger.args.push(trigger.person.emails[0]);
    // create room with people
    bot.room(trigger.person.displayName + '\'s Room', trigger.args);
  }
});

// anytime someone says beer
flint.hears(/(^| )beer( |.|$)/i, function(bot, trigger) {
  bot.say('Enjoy a beer, %s!', trigger.person.displayName);
});
