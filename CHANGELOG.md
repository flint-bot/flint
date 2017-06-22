**4.6.x Update**

* `bot.store()`, `bot.recall()`, and `bot.forget` of memory storage module has
  been refactored to return resolved/rejected promises. This means that
  `bot.recall()` will no longer return a null value for a non-existent key and
  will return a promise instead of a value for a existing key. This is to comply
  with requirements for other storage modules that are not synchronous and to
  make the memory storage module interchangeable with these.
* redis storage module modified so that is interchangeable with the new memory
  storage module. This module will be refactored soon to decrease times between
  synchronizations rather than syncing the local memory store with redis
  periodically. However, the function calls to this module will not change so
  code based on this will be safe when this module is refactored.
* The previous redis storage module still exists as redis_old, but is
  deprecated / unsupported. If using the redis module, consider migrating to
  updated redis storage module. This module will be removed in Flint v5.

**Breaking Changes in 4.6.x**

* See update above. `bot.store()`, `bot.recall()`, and `bot.forget` functions have been adjusted. Redis Storage Module refactored. Mem Storage Module refactored. 

**4.5.x Update**

* Removed some error handling that would cause flint to crash when Spark API
  would respond with a 504 error due to API issues.
* Fixed unhandled rejections when despawn happens and bot mem-store is empty.
* Updated handling on of "next" in returned webhook function.
* Changed room being tagged as a "Team" if bot is not member of team.
* Fixed typo in audit process (#15 via @pevandenburie)

**4.4.x Update**

* `bot.isDirectTo` property added. This is set to the email of the other
  conversant in rooms of type 'direct'.
* `trigger.raw` property added to `flint.hears` trigger callback object. This is
  the raw message without any processing to remove multiple spaces, CR/LF, or
  leading/trailing spaces.

**4.3.x Update**

* `bot.add()` and `bot.remove()` now return an array of successfully
  added / removed room membership emails rather than the bot object itself.
* Debug error messages for archived team rooms suppressed.

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

**Breaking Changes in 4.2.x**

* `flint.machine` boolean property renamed to `flint.isBotAccount`
