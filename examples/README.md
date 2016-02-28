# Examples:

A few quick examples around some things you can do with Flint.

* simple.js - Simple setup with a few sample commands to add a user to a room, remove a user from a room, spawn a new room, or implode (kick all users and exit) current room. 
* callme.js - An example on how to use bot.remember() and bot.recall() functions. 
* dm.js - Sends a direct message to another user from any room. *Note: This currently broken in the Spark API on cases where user has not already sent a 1:1 message to the bot using the client. This message will be removed/updated once Cisco has the API bug fixed.*
* props.js - Send and recieve props to others in a room. Keeps track of score per user per room. Uses memory to store stats and is erased on app restart. 
* exchangesync.js - Syncs a room with an Exchange distribution list. This can be done manually or on a schedule. 