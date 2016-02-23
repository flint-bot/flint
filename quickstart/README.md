# Quick Start with Flint on Cloud9

#### Introduction
This tutorial will get you started with a simple Cisco Spark Bot written in Node JS and hosted on Cloud9.

#### Getting Your Spark Access Token
First you will need your Cisco Spark API Access Token. You can use your own account or create a new "bot" account. 

1. Login to http://developer.ciscospark.com

2. Click your avatar image and copy the characters listed in "My Access Token". You will need this later when setting up Flint.

  ![Cicso Spark Token](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/ciscospark.com.01.jpg)

#### Cloud9 Setup
Cloud9 is an online Integrated Development Environment (IDE). This allows you to build this Node JS app without having to install anything on your computer or worry about having to pinhole your firewall to allow the Spark API web-hook callbacks to access locally running application.

1. Sign up for a free account on [cloud9](http://c9.io). This is where the code for the bot will run.

2. After creating an account and logging into Cloud9, you will need to create a new workspace. When doing so, you will be presented with a dialog box. Choose all the defaults and define the following:
  * `Workspace Name` - For this tutorial we are using "mybot", but it can be anything.
  * `Description` - This can be anything.
  * `Template` - Choose "Node.js".

  ![Cloud 9 New Project](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.01.jpg)

3. Press "Create Workspace" and wait for the Cloud9 IDE to load.

4. After the IDE has loaded, you will see that Cloud9 has set us up with a sample project. We don't need any of this, so start by deleting the 2 existing folders in the project tree. This can be done by righ clicking on the folder and selecting delete. These are named:
  * `client`
  * `node_modules`

  ![Cloud 9 Remove Template](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.02.jpg)

5. Next, edit the `package.json` file in your project tree. Edit the following:
  * `name`
  * `description`
  * `author`
  * `dependencies`

    The file should look something like the following. Be sure to save after you have made the changes.

    ```json
    {
      "name": "mybot",
      "version": "0.0.0",
      "description": "A Cisco Spark bot using Flint",
      "main": "server.js",
      "repository": "",
      "author": "Nicholas Marus <nmarus@gmail.com>",
      "dependencies": {
      }
    }
    ```
    
  ![Cloud 9 Remove Template](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.03.jpg)

#### Flint Application Setup

1. Open up `server.js` and replace the existing code with the following. Be sure to save after you have made the changes.

 * `hookUrl`: The cloud9 url for your app is `http://<appname>-<username>.c9users.io`
 * `sparkEmail`: Enter the Cisco Spark Email used at the start of this tutorial.
 * `sparkToken`: Enter the Cisco Spark Access Token that you recorded earlier.

     ```js
    var Flint = require('node-flint');

    // define flint setup
    var config = {
      // url to access this app's webservice
      hookUrl: 'http://<app>-<username>.c9users.io',
      // port that local server listens on
      localPort: process.env.PORT,
      // spark account email
      sparkEmail: '<spark email>',
      // spark api token
      sparkToken: '<spark access token>'
    };

    // init flint framework
    var flint = new Flint(config);

    // echo test
    flint.hears('/echo', function(bot, trigger) {
      bot.say(trigger.args.join(' '));
    });

    // add a person or people to room by email
    flint.hears('/add', function(bot, trigger) {
      var email = trigger.args;
      if(email) bot.add(email);
    });

    // remove a person or people from room by email
    flint.hears('/remove', function(bot, trigger) {
      var email = trigger.args;
      if(email) bot.remove(email);
    });

    // anytime someone says beer
    flint.hears(/(^| )beer( |.|$)/i, function(bot, trigger) {
      bot.say('Enjoy a beer, %s!', trigger.person.displayName);
    });
    ```

2. Install the `node-flint` npm package to your project. This is done from the terminal window at the bottom of the Cloud9 IDE.

    ```bash
    npm install --save node-flint
    ```

3. Open up the `package.json` file and verify that the `node-flint` dependency is now there. Additionally, you should now see the “node-modules” folder in your application tree.

    *Note: The version of the `node-flint` package may differ. It's only important that the dependency is listed.*

    ```json
    {
      "name": "mybot",
      "version": "0.0.0",
      "description": "A Cisco Spark bot using Flint",
      "main": "server.js",
      "repository": "",
      "author": "Nicholas Marus <nmarus@gmail.com>",
      "dependencies": {
        "node-flint": "^1.0.4"
      }
    }
    ```


#### Run Flint

1. Run the bot manually from the Cloud9 Terminal:

    ```bash
    DEBUG=* node server.js
    ```

2. Validate the logs. You should see something similar to the following. If you haven’t added the “bot” to a room yet, do so now and wait till the bot posts a message to the room stating it is ready.

    ```
    flint found a room with a node-flint but not registered +42s
    flint started polling a new repeater task queue +6ms
    flint started polling a new scheduler task queue +1ms
    flint has registered a room +2s
    ```

3. Run a few test commands:

    ```
    /echo hello world!
    ```

    ```
    I would like a beer!
    ```

4. Monitor the terminal on Cloud9 for events that Flint produces.

5. To stop the Cloud9 application, press `ctrl + c` from the terminal window.

#### References

- Node Package node-flint: http://npmjs.org/node-flint
- Node Package node-sparky: http://npmjs.org/node-sparky
- Cloud9 Sample Project: https://c9.io/nmarus/mybot
