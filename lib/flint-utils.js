'use strict';

var Utils = {

  // generate random base 36 string of specified length
  genRand: function(len) {
    // set default length
    if(!len) len = 8;

    // generate random alphanumberic
    function gen() {
      return Math.random().toString(36).slice(2);
    }

    // expand random
    function expand(r) {
      return gen() + r;
    }

    // initial random
    var r = gen();

    // expand r until r is >= len
    while(r.length < len) {
      r = expand(r);
    } 

    // return random string
    return r.slice(0,len);
  },

};

module.exports = Utils;