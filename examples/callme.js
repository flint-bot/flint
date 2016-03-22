var Flint = require('node-flint');
var _ = require('lodash');

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

// command '/callme' to get person nickname in room
flint.hears('/callme', function(bot, trigger) {
  // check if anything was sent after /callme
  if(trigger.args.length > 0) {
    // set nickname to word following /callme and normalize to proper case
    var nickname = _.startCase(trigger.args.join(' '));

    // save to local bots memory
    bot.store('nicknames', trigger.message.personEmail, nickname);
    bot.say('I will call you ' + nickname + ' from now on in this room.');
  } else {
    bot.say('Maybe later.');
  }
});

// command '/hello' responds with greeting
flint.hears('/hello', function(bot, trigger) {
  // recall nickname
  var nickname = bot.recall('nicknames', trigger.message.personEmail);

  // check if we know a nickname
  if(nickname) {
    // nickname was found, greet by nickname
    bot.say('Hello ' + nickname);
  } else {
    // nickname was not found, greet by display name
    bot.say('Hello ' + trigger.person.displayName);
  }
});