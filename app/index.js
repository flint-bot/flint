var Flint = require('node-flint');
var path = require('path');
var fs = require('fs');

var settings = require('./config/flint.conf');
var plugins = '/plugins';

// init flint framework
var flint = new Flint(settings);

// register plugins
flint.on('started', function() {
  // register plugins
  fs.readdirSync(path.join(__dirname, plugins)).forEach(function(p) {
    var newPlugin = path.join(__dirname, plugins, p);
    if(path.parse(newPlugin).ext === '.js') {
      require(newPlugin)(flint);
    }
  });
});
