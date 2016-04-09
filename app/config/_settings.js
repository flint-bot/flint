'use strict';

// define flint setup
var settings = {

  // webhooks (socket2me)
  //
  // s2mHost -h ost of the socket2me webhook relay
  //
  // s2mHost: 'mysockethost.com',

  // webhooks (direct)
  //
  // baseUrl - internet url for this app
  // externalPort - external port (optional, defaults to localport)
  //
  baseUrl: 'http://myhost.com',
  // externalPort: 80,

  // Spark Account email
  sparkEmail: 'myuser@myhost.com',

  // Spark API (developer token)
  //
  sparkToken: 'token',

  // Spark API (oauth settings)
  //
  // clientID: 'id',
  // clientSecret: 'secret',
  // redirectURL: 'http://myhost.com',
  // password: 'mypassword',
  // tokenRefreshInterval: 24*60*60*1000,

  // Rate limiter
  // maxItems: 500,
  // maxConcurrent: 2,
  // minTime: 500,

  // Security
  // userWhiteList: [ 'user1@domain.com', 'user2@domain.com'],
  // domainWhiteList: [ 'domain1.com', 'domain2.com'],

  // Bot Config
  // announceMessage: 'Flint is on',

  // Interface IP to bind to
  // bindAddress: '0.0.0.0',

  // Port that local server listens on
  localPort: 80

};

// export module
module.exports = settings;
