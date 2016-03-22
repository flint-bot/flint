# Quick Start with Cisco Spark and Flint on Cloud9

#### Introduction
This tutorial will get you started with a simple Cisco Spark Bot written in Node JS and hosted on Cloud9. This makes use of two frameworks to make the process a bit easier:

  * `node-flint`
  * `node-sparky`

#### Getting Your Spark Access Token
First you will need your Cisco Spark API Access Token. *You can use your own account or create a new "bot" account. However, if you use your own account, you will need someone else to test the commands as the application is designed to ignore commands that come from itself.*

1. Login to http://developer.ciscospark.com

2. Click your avatar image and copy the characters listed in "My Access Token". You will need this later when setting up Flint.

  ![Cicso spark token](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/ciscospark.com.01.jpg)

#### Cloud9 Setup
Cloud9 is an online Integrated Development Environment (IDE). This allows you to build this Node JS app without having to install anything on your computer or worry about having to pinhole your firewall to allow the Spark API web-hook callbacks to access locally running application.

1. Sign up for a free account on [cloud9](http://c9.io). This is where the code for the bot will run.

2. After creating an account and logging into Cloud9, you will need to create a new workspace. When doing so, you will be presented with a dialog box. Choose all the defaults and define the following:

  * `Workspace Name` - For this tutorial we are using "mybot", but it can be anything.
  * `Description` - This can be anything.
  * `Template` - Choose "Node.js".

  ![Cloud 9 new project](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.01.jpg)

  *Note: If setting up a private workspace, you will need to adjust the Cloud9 workspace security settings in order for the webhooks from the Cisco Spark API to reach the webserver that runs in this app. The directions for doing this are [here](https://github.com/nmarus/flint/tree/master/quickstart#adjust-cloud9-project-security-required-only-for-private-projects).*

3. Press "Create Workspace" and wait for the Cloud9 IDE to load.

4. After the IDE has loaded, you will see that Cloud9 has set us up with a sample project. We don't need any of this, so start by deleting the 2 existing folders in the project tree. This can be done by right clicking on the folder and selecting delete. These are named:

  * `client`
  * `node_modules`

  ![Cloud 9 remove template](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.02.jpg)

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

  ![Cloud 9 package.json](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.03.jpg)

#### Flint Application Setup

1. Open up `server.js` and replace the existing code with the following. Be sure to save after you have made the changes.

 * `baseUrl`: The cloud9 url for your app is `http://<appname>-<username>.c9users.io`
 * `sparkEmail`: Enter the Cisco Spark Email used at the start of this tutorial.
 * `sparkToken`: Enter the Cisco Spark Access Token that you recorded earlier.

    ```js
    var Flint = require('node-flint');

    // define flint setup
    var config = {
      // url to access this app's webservice
      baseUrl: 'http://<app>-<username>.c9users.io',
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

  ![Cloud 9 server.js](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.04.jpg)

2. Install the `node-flint` npm package to your project. This is done from the terminal window at the bottom of the Cloud9 IDE.

    ```bash
    npm install --save node-flint
    ```

  ![Cloud 9 npm install](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.05.jpg)

  ![Cloud 9 npm install output](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.06.jpg)

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
        "node-flint": "^1.0.8"
      }
    }
    ```

  ![Cloud 9 package.json updated](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.07.jpg)

#### Run Flint

1. Run the bot manually from the Cloud9 Terminal:

    ```bash
    DEBUG=flint node server.js
    ```

  ![Cloud 9 run flint](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.08.jpg)

2. Validate the logs. You should see something similar to the following. If you haven’t added the Bot to a room yet, do so now. You can add the Bot by email address to an existing room, create new room with the bot and others, or create a 1:1 chat with it. Once added, wait till the log states a room is registered. This will be within 15 seconds of the bot getting joined to the room. 

    ```
    flint found a room with a node-flint but not registered +42s
    flint started polling a new repeater task queue +6ms
    flint started polling a new scheduler task queue +1ms
    flint has registered a room +2s
    ```

3. Open a chat window with your bot account and run a few test commands:

    ```
    /echo hello world!
    ```

    ```
    I would like a beer!
    ```

4. Monitor the terminal on Cloud9 for events that Flint produces.

5. To stop the Cloud9 application, press `ctrl + c` from the terminal window.

#### Adjust Cloud9 Project Security (required only for private projects)

If you are running this as a "private" project on Cloud9 (vs public), you will need to make sure that the call back URL that is used in the creation of webhooks, is made public. To do so:

1. Select share from the cloud9 menu in the top right hand corner.

  ![Cloud 9 project permissions](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.09.jpg)

2. Make sure the "application" is set to "public"

  ![Cloud 9 application set to public](https://raw.githubusercontent.com/nmarus/flint/master/quickstart/c9.io.10.jpg)

#### References

- Node Package node-flint: http://npmjs.org/node-flint
- Node Package node-sparky: http://npmjs.org/node-sparky
- Cloud9 Sample Project: https://c9.io/nmarus/mybot
