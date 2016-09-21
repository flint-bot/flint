# node-flint

### Cisco Spark Bot SDK for Node JS

[![NPM](https://nodei.co/npm/node-flint.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/node-flint/)

**New Features in 4.2.x**

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

## Contents

<!-- START doctoc -->
<!-- END doctoc -->
