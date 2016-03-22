var validator = require('validator');
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

// domain name to use for @name formats
var domain = '@domain.com';

// props [<name>]
flint.hears('/props', function(bot, trigger) {
  var email = trigger.args ? trigger.args[0] : null;
  var name;
  
  // convert @name to email
  email = email && email.charAt(0) === '@' ? email.slice(1) + domain : email;
  
  if(email && validator.isEmail(email)) {
    // get display name
    bot.inspect(email, function(err, person) {
      if(err || !person) {
        bot.say('Invalid email address or @name.');
      } else {
        name = person.displayName;
        
        // get total props
        var total = bot.recall('props', email).total ? bot.recall('props', email).total : 0;
        
        // increase props by 1
        total++;
        
        // save score and let everyone know
        bot.remember('props', email, { name: name, total: total});
        bot.say('%s now has %s points with a +1 from %s!', name, total, trigger.person.displayName);
      }
    });
  }
  
  else if(email) {
    bot.say('Invalid email address or @name.');
  }
  
  // show stats
  else {
    if(bot.recall('props')) {
      Object.keys(bot.recall('props')).forEach(function(p) {
        bot.say('%s (%s)', bot.recall('props')[p].name, bot.recall('props')[p].total);
      });
      
    } else {
      bot.say('No props have been given...');
    }
  }


});