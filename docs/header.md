# node-flint (v4)

### Bot SDK for Node JS

## News

**10/25/19 Support for Adaptive Cards:**

* Cisco recently introduced support for [Adaptive Cards](https://developer.webex.com/docs/api/guides/cards/) in the Webex Teams.   Bots can send cards, using the new `attachment` attribute of the message object. Cards are useful as an alternative to text messages and files in order to display or collect complex bits of information. Cards can be sent by passing an object to the bot.say() method that includes a valid attachment.   To process user input to cards, apps must implement a `flint.on('attachmentaction', ..)` function.   For more details see the [adaptive-card-example](./adaptive-card-example.md)

**6/21/19 Deploying behind a firewall:**

* Cisco has recently introduced support in the Webex Javascript SDK which allows applications to register to receive the message, membership, and room events via a socket instead of via wehbhoks.   This allows applications to be deployed behind firewalls and removes the requirement that webex bots and integrations must expose a public IP address to receive events.   To take advantage of this in your flint applications simply remove the `webhookUrl` field from the configuration object passed to the flint constructor.   If this field is not set, flint will register to listen for these events instead of creating webhooks.

**6/21/18 IMPORTANT:**

* On August 31st, 2018 all bots with the sparkbot.io domain name will be
  renamed with a webex.bot domain. Today in flint, the code compares the bot's
  email with the trigger email to filter out messages from itself. If this code
  is running on August 31st the bot will start responding to its own messages.
  Please update to Flint v4.7.x as soon as possible to avoid interruption. 

**3/19/18 IMPORTANT:**

* Note that Flint v4 is still using the node-sparky library version 3.x.
  However the repo for node-sparky is now on version 4 which has some major
  differences. This misalignment between Flint and Sparky version
  will be fixed with the release of Flint v5. In the
  short term if you are accessing the spark object directly from Flint via
  `flint.spark` be sure to use the documentation for [node-sparky 3.x](https://github.com/flint-bot/sparky/tree/v3).   

**See [CHANGELOG.md](/CHANGELOG.md) for details on changes to versions of Flint.**

## Contents

<!-- START doctoc -->
<!-- END doctoc -->
