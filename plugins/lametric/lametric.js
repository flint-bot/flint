'use strict';

// plugin settings
var config = require('../config/lametric.conf');

var request = require('request');
var debug = require('debug')('lametric');

function lametricSend(text, cb) {

  var headers = {
    'Accept': 'application/json',
    'X-Access-Token': config.token,
    'Cache-Control': 'no-cache'
  };

  var body = {
    frames: [{ index: 0, text: text, icon: 'i2701' }]
  };

  var requestOptions = {  
    url: config.url,
    headers: headers,
    body: body,
    method: 'post',
    json: true
  };

  request(requestOptions, function(err, res, body) {
    cb ? cb(err) : null;
  });
}

module.exports = function(flint) {

  flint.on('message', function(message, bot) {
    debug('"%s" said "%s" in room "%s"', message.personEmail, message.text, bot.myroom.title);
    // send lametric all emssages from room
    // lametricSend(message.text);
  });
  
  flint.on('file', function(file, bot) {
    debug('recieved file "%s"', file.name);
    lametricSend('File Uploaded: ' + file.name);
  });

  flint.hears('/lametric', function(bot, trigger) {
    var say = trigger.message.text.split(' ');
    say = say.slice(1);
    say = say.join(' ');
    lametricSend(say);
  });

};