'use strict';

// define flint setup
var settings = {
  
  // Interface IP to bind to
  // bindAddress: '0.0.0.0',
  
  // Port that local server listens on
  localPort: 80,
  
  // Port that is used in webhooks
  // externalPort: 80,
  
  // URL to access this app's webservice
  baseUrl: 'http://myhost.com',
  
  // Spark Account email
  sparkEmail: 'myuser@myhost.com',
  
  // Spark API using developer auth token
  sparkToken: 'token',
  
  // Spark API using OAuth
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
  
  // Logging
  maxLogSize: 1000
  
};

// export module
module.exports = settings;