# node-flint

### Cisco Spark Bot SDK for Node JS

[![NPM](https://nodei.co/npm/node-flint.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/node-flint/)

## News

**4.2.x Update**

* Persistent Storage for `bot.store()`, `bot.recall()`, and `bot.forget()`
  through new modular storage functionality.
* Added in-memory storage module (default unless storage module is specified)
* Added Redis storage module
* Added boolean property flint.isUserAccount
* Added method `flint.storageDriver()` to define storage backend
* The `flint.hears()` method now can have a weight specified. This allows for
  overlapping and default actions.
* Auto detection of Bot accounts
* If Bot account is detected, the behavior of the `trigger.args` property inside
  the `flint.hears()` method performs additional parsing.

**Potential Breaking Changes in 4.2.x**

* `flint.machine` boolean property renamed to `flint.isBotAccount`

**4.3.x Update**

* `bot.add()` and `bot.remove()` now return an array of successfully
added / removed room membership emails rather than the bot object itself.
* Debug error messages for archived team rooms suppressed.

**4.4.x Update**

* `bot.isDirectTo` property added. This is set to the email of the other conversant in rooms of type 'direct'.
* `trigger.raw` property added to `flint.hears` trigger callback object. This is the raw message without any processing to remove multiple spaces, CR/LF, or leading/trailing spaces.

## Contents

<!-- START doctoc -->
<!-- END doctoc -->
