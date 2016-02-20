var Bottleneck = require("bottleneck");
var validator = require('validator');
var debug = require('debug')('flint-ews');
var Flint = require('node-flint');
var async = require('async');
var ews = require('node-ews');
var _ = require('lodash');

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

// exchange web services settings
var ewsConfig = {
  username: 'user@domain.com',
  password: 'secret',
  host: 'ews.domain.com',
  domain: 'domain.com'
};

// setup authentication
ews.auth(ewsConfig.username, ewsConfig.password, ewsConfig.host);

// recursion depth
var depth = 3;

// max dl sizes
var listMax = 100;
var execMax = 500;
var listHours = 6;

// rate limiter
var limiter = new Bottleneck(8, 50); // 8 parallel calls with no more than one every 50ms

// recursively query a DL, returns an array of all emails found.
function ewsDlNested(email, callback) {
  if(!depth) var depth = 3;
  
  // query 1 layer of a DL by email, returns members of DL. returns error if email is not a DL
  function ewsDl(email, callback) {
    // storage array for email adresses
    var list = [];
  
    // exchange ews query
    var ewsFunction = 'ExpandDL';
    var ewsArgs = {
      'Mailbox': {
        'EmailAddress':email
      }
    };
  
    // query ews
    ews.run(ewsFunction, ewsArgs, function(err, result) {
      if(err) {
        callback(err, null);
      } else {
        // TODO: Fix this shitty json parser... Who wrote this?!?!?
        // parse results to array
        if(result['Envelope']['Body'][0]['ExpandDLResponse'][0]['ResponseMessages'][0]['ExpandDLResponseMessage'][0]['DLExpansion']) {
          var requestResult = result['Envelope']['Body'][0]['ExpandDLResponse'][0]['ResponseMessages'][0]['ExpandDLResponseMessage'][0]['DLExpansion'][0]['Mailbox'];
          _.map(requestResult, 'EmailAddress').forEach(function(e) {
            list.push(e[0]);
          });
          callback(null, list);
        } else {
          callback(true, null);
        }
  
      }
    });
  }

  // recursive traversal
  function traverse(email, n, done) {
    var nn = n;

    // ewsDl(email, function(err, list) {});
    limiter.submit(ewsDl, email, function(err, list) {
      if(err) {
        done([email]);
      } else {
        if(nn < depth) {
          nn++;
          var result = [];
          async.each(list, function(e, cb) {

            // recursion
            traverse(e, nn, function(r) {
              result = result.concat(r);
              cb();
            });

          }, function() {
            done(result);
          });
        } else {
          debug('DL found past the recursive limit: %s', email);
          done([]);
        }
      }
    });

  }

  traverse(email, 0, function(result) {
    result = _.filter(result, function(e) {
      // filter results
      return (_.toLower(e.replace(/.*@/, '')) === ewsConfig.domain);
    });
    callback(null, result);
  });

}

module.exports = function(flint) {
    
  // register command
  flint.hears('/dl', function(bot, trigger) {

    var command = trigger.args[0] ? trigger.args.shift() : null;
    var email = command && command !== 'help' && trigger.args[0] ? trigger.args.shift() : null;

    
    // if email defined and not valid
    if(email && !validator.isEmail(email)) {
      bot.say('That is not a valid email, %s.', trigger.person.displayName);
      return;
    } 

    switch(command) {

      case 'add':
        if(!email) {
          // if email is invalid
          bot.say('%s, you must supply a valid email address. Type /dl for help.', trigger.person.displayName);
        } else {
          ewsDlNested(email, function(err, list) {
            if(err) {
              bot.say('%s, the distribution list is invalid.', trigger.person.displayName);
            } else {
              debug('queried a distribution list for %s with %s members', trigger.person.displayName, list.length);
              if(list.length > execMax) {
                bot.say('That distribution list has %s members. It is longer than the maximum of %s allowed by system, %s', list.length, execMax, trigger.person.displayName);
              } else {
                // add distribution list members
                list.forEach(function(email){
                  bot.add(email);
                });
              }
            }
          });
        }
        break;

      case 'remove':
        if(!email) {
          // if email is invalid
          bot.say('%s, you must supply a valid email address. Type /dl for help.', trigger.person.displayName);
        } else {
          ewsDlNested(email, function(err, list) {
            if(err) {
              bot.say('%s, the distribution list is invalid.', trigger.person.displayName);
            } else {
              debug('queried a distribution list for %s with %s members', trigger.person.displayName, list.length);
              if(list.length > execMax) {
                bot.say('That distribution list has %s members. It is longer than the maximum of %s allowed by system', list.length, execMax);
              } else {
                // remove person that is calling function, and bot from list if they are present
                list = _.difference(list, [ trigger.message.personEmail, bot._person.emails[0] ]);
                list.forEach(function(email){
                  bot.remove(email);
                });
              }
            }
          });
        }
        break;
        
      case 'list':
        if(!email) {
          // if email is invalid
          bot.say('%s, you must supply a valid email address. Type /dl for help.', trigger.person.displayName);
        } else {
          ewsDlNested(email, function(err, list) {
            if(err) {
              bot.say('%s, the distribution list is invalid.', trigger.person.displayName);
            } else {
              debug('queried a distribution list for %s with %s members', trigger.person.displayName, list.length);
              // list distribution list members
              if(list.length > listMax) {
                bot.say('The distribution list %s has %s members. The first %s are:\n\n%s\n', email, list.length, listMax, list.slice(0, listMax - 1).join('\n'));
              } else {
                bot.say('The distribution list %s has %s members. The members are:\n\n%s\n', email, list.length, list.join('\n'));
              }
            }
          });
        }
        break;
        
      case 'compare':
        if(!email) {
          // if email is invalid
          bot.say('%s, you must supply a valid email address. Type /dl for help.', trigger.person.displayName);
        } else {
          ewsDlNested(email, function(err, list) {
            if(err) {
              bot.say('%s, the distribution list is invalid.', trigger.person.displayName);
            } else {
              debug('queried a distribution list for %s with %s members', trigger.person.displayName, list.length);
              if(list.length > listMax) {
                bot.say('That distribution list has %s members. It is longer than the maximum of %s allowed by system to be displayed to the screen.', list.length, listMax);
                return;
              } else {
                // compare members from a list to those in the room
                bot.getPeople(function(err, emails) {
                  if(err) {
                    bot.say('I\'m sorry, there was an error getting the list of people in this room.');
                    debug('encountered error getting people in room');
                    return;
                  } else {
                    // remove person that is calling function, and bot from list of DL members if they are present
                    list = _.difference(list, [ trigger.message.personEmail, bot._person.emails[0] ]);
                    // remove person that is calling function, and bot from list of people in room if they are present
                    emails = _.difference(emails, [ trigger.message.personEmail, bot._person.emails[0] ]);
                    // compare
                    var toBeAdded = _.difference(list, emails);
                    // compare
                    var toBeRemoved = _.difference(emails, list);
                    // say results to room
                    if(toBeAdded && toBeAdded.length > 0) {
                      bot.say('The people who would be added to this room include:\n\n%s\n\n', toBeAdded.join('\n'));
                    } else {
                      bot.say('There is no one that would be added to this room.');
                    }
                    if(toBeRemoved && toBeRemoved.length > 0) {
                      bot.say('The people who would be removed from this room include:\n\n%s\n\n', toBeRemoved.join('\n'));
                    } else {
                      bot.say('There is no one that would be removed from this room.');
                    }
                  }
                });
              }
            }
          });
        }
        break;
        
      case 'prune':
        if(!email) {
          // if email is invalid
          bot.say('%s, you must supply a valid email address. Type /dl for help.', trigger.person.displayName);
        } else {
          ewsDlNested(email, function(err, list) {
            if(err) {
              bot.say('%s, the distribution list is invalid.', trigger.person.displayName);
            } else {
              debug('queried a distribution list for %s with %s members', trigger.person.displayName, list.length);
              if(list.length > execMax) {
                bot.say('That distribution list has %s members. It is longer than the maximum of %s allowed by system, %s', list.length, execMax, trigger.person.displayName);
              } else {
                // one time sync of room to dl members
                bot.getPeople(function(err, emails) {
                  if(err) {
                    bot.say('I\'m sorry, there was an error getting the list of people in this room.');
                    debug('encountered error getting people in room');
                    return;
                  } else {
                    // remove person that is calling function, and bot from list of DL members if they are present
                    list = _.difference(list, [ trigger.message.personEmail, bot._person.emails[0] ]);
                    // remove person that is calling function, and bot from list of people in room if they are present
                    emails = _.difference(emails, [ trigger.message.personEmail, bot._person.emails[0] ]);
                    // compare
                    var toBeAdded = _.difference(list, emails);
                    // compare
                    var toBeRemoved = _.difference(emails, list);
                    // add people to room
                    toBeAdded.forEach(function(e) {
                      bot.add(e);
                    });
                    // remove people from room
                    toBeRemoved.forEach(function(e) {
                      bot.remove(e);
                    });
                  }
                });
              }
            }
          });
        }
        break;
        
      case 'room':
        if(!email) {
          // if email is invalid
          bot.say('%s, you must supply a valid email address. Type /dl for help.', trigger.person.displayName);
        } else {
          ewsDlNested(email, function(err, list) {
            if(err) {
              bot.say('%s, the distribution list is invalid.', trigger.person.displayName);
            } else {
              debug('queried a distribution list for %s with %s members', trigger.person.displayName, list.length);
              if(list.length > execMax) {
                bot.say('That distribution list has %s members. It is longer than the maximum of %s allowed by system.', list.length, execMax);
              } else {
                // add members to a new room
                list.push(trigger.message.personEmail);
                bot.room(trigger.person.displayName + '\'s Room', list);
              }
            }
          });
        }
        break;
        
      case 'sync':
        // if sync has been enabled in room
        if(bot.recall('dl', 'sync')) {
          // disable sync
          bot.say('Synchronization of distribution list %s has been disabled for this room.', bot.recall('dl', 'dlEmail'));
          // reset repeater jobs
          bot.repeaterReset();
          bot.forget('dl');
        } else if(!email) {
          debug('sync');
          // if email is invalid
          bot.say('%s, you must supply a valid email address. Type /dl for help.', trigger.person.displayName);
        } else {
          
          ewsDlNested(email, function(err, list) {
            if(err) {
              bot.say('%s, the distribution list is invalid.', trigger.person.displayName);
            } else {
              debug('queried a distribution list for %s with %s members', trigger.person.displayName, list.length);
              // validate sync
              if(list.length > execMax) {
                bot.say('That distribution list has %s members. It is longer than the maximum of %s allowed by system, %s', list.length, execMax, trigger.person.displayName);
              } else {
                
                bot.remember('dl', 'sync', true);
                bot.remember('dl', 'dlEmail', email);
                bot.remember('dl', 'dlUser', trigger.message.personEmail);
                
                bot.getPeople(function(err, emails) {
                  if(err) {
                    bot.say('I\'m sorry, there was an error getting the list of people in this room.');
                    debug('encountered error getting people in room');
                    return;
                  } else {
                    list = _.difference(list, [ trigger.message.personEmail, bot._person.emails[0] ]);
                    // remove person that is calling function, and bot from list of people in room if they are present
                    emails = _.difference(emails, [ trigger.message.personEmail, bot._person.emails[0] ]);
                    // compare
                    var toBeAdded = _.difference(list, emails);
                    // compare
                    var toBeRemoved = _.difference(emails, list);
                    // perform add and remove tasks for deltas
                    toBeAdded.forEach(function(e) {
                      bot.add(e);
                    });
                    toBeRemoved.forEach(function(e) {
                      bot.remove(e);
                    });
                  }
                });
                
                bot.repeat(function(bot) {
                  ewsDlNested(bot.recall('dl', 'dlEmail'), function(err, list) {
                    if(err) {
                      return;
                    } else {
                      bot.getPeople(function(err, emails) {
                        if(err) {
                          debug('encountered error getting people in room');
                          return;
                        } else {
                          // remove person that is calling function, and bot from list of DL members if they are present
                          list = _.difference(list, [ bot.recall('dl', 'dlUser'), bot._person.emails[0] ]);
                          // remove person that is calling function, and bot from list of people in room if they are present
                          emails = _.difference(emails, [ bot.recall('dl', 'dlUser'), bot._person.emails[0] ]);
                          // compare
                          var toBeAdded = _.difference(list, emails);
                          // compare
                          var toBeRemoved = _.difference(emails, list);
                          // perform add and remove tasks for deltas
                          toBeAdded.forEach(function(e) {
                            bot.add(e);
                          });
                          toBeRemoved.forEach(function(e) {
                            bot.remove(e);
                          });
                        }
                      });
                    }
                  });
                }, listHours * 3600);
              }
            }
          });
            
        }
        break;
        
      case 'help':
        var help = trigger.args[0] ? trigger.args.shift() : null;
        // help
        switch(help) {
          case 'add':
            bot.say('/dl add <list email>\nAdds a distribution list\'s members to room. If the distribution list includes nested lists, ADD will parse those users as well.\n\nThis command is limited to %s users and a distribution list depth of %s levels deep.', execMax, depth);
            break;
    
          case 'remove':
            // remove distribution list members from room
            bot.say('/dl remove <list email>\nRemoves a distribution list\'s members from room. If the distribution list includes nested lists, REMOVE will parse those users as well.\n\nThis command is limited to %s users and a distribution list depth of %s levels deep.', execMax, depth);
            break;
            
          case 'list':
            // list distribution list members
            bot.say('LIST: Displays the members of a distribution list. If the distribution list includes nested lists, LIST will parse those users as well.\n\nThis command will only display the first %s users found in a list.', listMax);
            break;
            
          case 'compare':
            // compare members from a list to those in the room
            bot.say('/dl compare <list email>\nDisplay the members of a distribution that are either not in the room or not on the distribution list. COMPARE is suggested to be ran before SYNC or PRUNE.\n\nThis command is limited to %s users and to a distribution list search of %s levels deep.', execMax, depth);
            break;
            
          case 'prune':
            // one time sync of room to dl members
            bot.say('/dl prune <list email>\nAdds or removes people from room in order to match the distribution list specified. PRUNE will not remove the person who entered the command nor the the bot performing the command.\n\nThis command is limited to %s users and a distribution list depth of %s levels deep.', execMax, depth);
            break;
            
          case 'room':
            // create new room with members of DL list and person entering command
            bot.say('/dl room <list email>\nCreates a new room with yourself and the members of the distribution list.\n\nThis command is limited to %s users and a distribution list depth of %s levels deep.', execMax, depth);
            break;
            
          case 'sync':
            // sync room with the distribution list ever X hours
            bot.say('/dl sync <list email>\nPerforms a "/dl prune" (adds or removes people from room in order to match the distribution list specified) every %s hours.\n\nSYNC will not remove the person who entered the command nor the the bot performing the command.\n\nTo disable SYNC, either remove the bot from the room or run SYNC with no distribution list email specified.', listHours);
            break;
            
          default:
            // unknown command for help
            bot.say('Usage: /dl help [ add, remove, list, compare, prune, room, sync ]');
            break;
        }
        break;
        
      default:
        // unknown command or help
        bot.say('Usage: /dl [ add, remove, list, compare, prune, room, sync ] <list email>\n' + 
        'For detailed help, enter /dl help <command>');
        break;
    }
    
  });
    
};