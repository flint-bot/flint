# node-flint (v4)

### Bot SDK for Node JS

## News

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
