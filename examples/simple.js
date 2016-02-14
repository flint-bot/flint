var Flint = require('node-flint');

// define flint setup
var config = {
  // url to access this app's webservice
  hookUrl: 'http://webhook.url',
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

// command '/add' to add a person to room by email
flint.hears('/add', function(bot, trigger) {
  var email = trigger.args;
  if(email) bot.add(email);
});

// command '/remove' to remove a person from room by email
flint.hears('/remove', function(bot, trigger) {
  var email = trigger.args;
  if(email) bot.remove(email);
});

// command '/room' to create a new room with people by email
flint.hears('/room', function(bot, trigger) {
  if(trigger.args.length > 0) {
    // add the person who typed command
    trigger.args.push(trigger.person.emails[0]);
    // create room with people
    bot.room(trigger.person.displayName + '\'s Room', trigger.args);
  }
});

// command '/implode' to delete room
flint.hears('/implode', function(bot, trigger) {
  bot.implode();
});

// anytime someone says beer
flint.hears(/(^| )beer( |.|$)/i, function(bot, trigger) {
  bot.say('Enjoy a 🍺!');
});