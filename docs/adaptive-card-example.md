#### Adaptive Card Template Using Express
```js
var Flint = require('node-flint');
var webhook = require('node-flint/webhook');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json());

// flint options
var config = {
  webhookUrl: 'http://myserver.com/flint',
  token: 'Tm90aGluZyB0byBzZWUgaGVyZS4uLiBNb3ZlIGFsb25nLi4u',
  port: 80
};

// init flint
var flint = new Flint(config);
flint.start();

flint.on("initialized", async function () {
  flint.debug("Flint initialized successfully! [Press CTRL-C to quit]");
});



// send an example card in response to any input
flint.hears(/.*/, function(bot) {
  bot.say({
    // Fallback text for clients that don't render cards
    markdown: "[Tell us about yourself](https://www.example.com/form/book-vacation). We just need a few more details to get you booked for the trip of a lifetime!",
    attachments: cardBody
  });
});

// Process a submitted card
flint.on('attachmentAction', function (bot, attachmentAction) {
  bot.say(`Got an attachmentAction:\n${JSON.stringify(attachmentAction, null, 2)}`);
});

// define express path for incoming webhooks
app.post('/', webhook(flint));

// start express server
var server = app.listen(config.port, function () {
  flint.debug('Flint listening on port %s', config.port);
});

// gracefully shutdown (ctrl-c)
process.on('SIGINT', function() {
  flint.debug('stoppping...');
  server.close();
  flint.stop().then(function() {
    process.exit();
  });
});

// define the contents of an adaptive card
let cardBody = [
  {
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
      "type": "AdaptiveCard",
      "version": "1.0",
      "body": [
        {
          "type": "ColumnSet",
          "columns": [
            {
              "type": "Column",
              "width": 2,
              "items": [
                {
                  "type": "TextBlock",
                  "text": "Tell us about yourself",
                  "weight": "bolder",
                  "size": "medium"
                },
                {
                  "type": "TextBlock",
                  "text": "We just need a few more details to get you booked for the trip of a lifetime!",
                  "isSubtle": true,
                  "wrap": true
                },
                {
                  "type": "TextBlock",
                  "text": "Don't worry, we'll never share or sell your information.",
                  "isSubtle": true,
                  "wrap": true,
                  "size": "small"
                },
                {
                  "type": "TextBlock",
                  "text": "Your name",
                  "wrap": true
                },
                {
                  "type": "Input.Text",
                  "id": "Name",
                  "placeholder": "John Andersen"
                },
                {
                  "type": "TextBlock",
                  "text": "Your website",
                  "wrap": true
                },
                {
                  "type": "Input.Text",
                  "id" : "Url",
                  "placeholder": "https://example.com"
                },
                {
                  "type": "TextBlock",
                  "text": "Your email",
                  "wrap": true
                },
                {
                  "type": "Input.Text",
                  "id": "Email",
                  "placeholder": "john.andersen@example.com",
                  "style": "email"
                },
                {
                  "type": "TextBlock",
                  "text": "Phone Number"
                },
                {
                  "type": "Input.Text",
                  "id": "Tel",
                  "placeholder": "+1 408 526 7209",
                  "style": "tel"
                }
              ]
            },
            {
              "type": "Column",
              "width": 1,
              "items": [
                {
                  "type": "Image",
                  "url": "https://upload.wikimedia.org/wikipedia/commons/b/b2/Diver_Silhouette%2C_Great_Barrier_Reef.jpg",
                  "size": "auto"
                }
              ]
            }
          ]
        }
      ],
      "actions": [
        {
          "type": "Action.Submit",
          "title": "Submit"
        }
      ]
    }
  }
];
```
