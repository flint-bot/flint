#bothub-template
(work in progress...)


### Prerequisites
* Account username and password for bothub.io account
* Tsuru.io client installed


### Template Files
* .nvmrc - Node JS Version
* Procfile - Executable Config
* app.js - Remote App Runner
* config.js - BotHub.io PaaS Config
* flint.js - Flint Bot Application
* package.json - npm dependencies
* test.js - Local App Runner


### Create and Configure

1. Login
    ```bash
    tsuru target-add default controller01.bothub.io:8080 -s
    tsuru login <username>
    ```

2. Create App
    ```bash
    tsuru app-create <name> nodejs
    ```

3. Install required packages
    ```bash
    npm install
    ```

4. Install and any save additional packages
    ```bash
    npm install lodash --save
    ```

5. Edit/Create flint.js
    ```js
    var _ = require('lodash');

    module.exports = function(flint) {
      flint.hears('hello', function(bot, trigger) {
        bot.say('Hello %s!', _.toUpper(trigger.personDisplayName));
      });
    };
    ```

6. Define Spark API Token
    ```bash
    tsuru env-set -a <name> TOKEN=<token>
    ```


### Test

1. Install Packages (defined in package.json)
    ```bash
    npm install
    ```

2. Run Locally (using BotHub.io remote webhook forwarding)
    ```bash
    node test.js
    ```


### Deploy

1. Remove node_modules artifacts directory
    ```bash
    rm -rf node_modules
    ```

2. Upload and Start App
    ```bash
    tsuru app-deploy -a <name> .
    ```
