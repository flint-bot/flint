#bothub-template
(work in progress...)

### Files
* .nvmrc - Node JS Version
* Procfile - App Config
* app.js - Remote App Runner
* config.js - PaaS Config
* flint.js - Flint Logic
* package.json - npm dependencies
* test.js - Local App Runner

### Create and Configure

1. Create App on bothub.io PaaS
    ```bash
    tsuru app-create <name> nodejs
    ```
2. Install required packages
    ```bash
    npm install
    ```
3. Install and any save additional packages
    ```bash
    npm install lodash --save
    ```
4. Edit/Create flint.js
    ```javascript
    var _ = require('lodash');

    module.exports = function(flint) {
      flint.hears('hello', function(bot, trigger) {
        bot.say('Hello %s!', _.toUpper(trigger.personDisplayName));
      });
    };
    ```
5. Define Spark API Token
    ```bash
    tsuru env-set -a <name> TOKEN=<token>
    ```

### Test

1. Install Packages (defined in package.json)
    ```bash
    npm install
    ```
2. Run Locally (using socket.bothub.io webhook forwarding)
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
