'use strict';

// define flint setup
var settings = {

  //
  // FLINT SETTINGS
  //

  // Webhooks: (direct)
  //
  // This section should be enabled for most implementations. If socket2me is 
  // being used, this section is ignored.
  //
  // Parameters:
  //
  // baseUrl - internet url for this app
  // externalPort - external port (optional, defaults to localport)

  baseUrl: 'http://myhost.com',
  // externalPort: 80,


  
  // Webhooks: (socket2me)
  //
  // This section is enabled if you are using a socket relay server called 
  // socket2me. This allows webhooks to be used without pinholing your firewall.
  //
  // Parameters:
  //
  // s2mHost - host of the socket2me webhook relay

  // s2mHost: 'http://mysockethost.com',



  // Spark Account Email: 
  //
  // The account that this bot logs into the API as.

  sparkEmail: 'myuser@myhost.com',



  // Spark API: (developer token)
  //
  // This section should be enabled if using a auth token from 
  // developer.ciscospark.com
  
  sparkToken: 'token',



  // Spark API: (oauth settings)
  //
  // This should be enabled if you have created an application under the bot
  // account. Thie allows OAUTH authentication and removed the token expiration
  // with developer tokens.
  
  // clientID: 'id',
  // clientSecret: 'secret',
  // redirectURL: 'http://myhost.com',
  // password: 'mypassword',
  // tokenRefreshInterval: 24*60*60*1000,

  

  // Rate Limiter:
  // 
  // These settings affect how fast Flint sends messages to the Spark API. If 
  // changing from the defaults, watch your console logs for 429 errors. 

  // maxItems: 500,
  // maxConcurrent: 2,
  // minTime: 500,


  
  // Security:
  // 
  // These setting limit "who" the bot responds to. This can be set on a domain 
  // or on auser by user basis.
  
  // userWhiteList: [ 'user1@domain.com', 'user2@domain.com'],
  // domainWhiteList: [ 'domain1.com', 'domain2.com'],

  

  // Bot Config:
  // 
  // These setting are related to the operation of Flint. 
  //
  // Parameters:
  // 
  // announceMessage - Phrase that is said when Bot is added to a room
  // bindAddress - If you need to specify a specific interface to bind to
  // localPort - The TCP port that the flint webservice listens on. 
  
  // announceMessage: 'Flint is on',
  // bindAddress: '0.0.0.0',
  localPort: 80

};

// export module
module.exports = settings;
