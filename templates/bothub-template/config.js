module.exports = {
  token: process.env.TOKEN,
  maxPageItems: 100,
  maxConcurrent: 5,
  minTime: 50,
  requeueCodes: [ 429, 500, 501, 502, 503 ],
  requeueMinTime: 500,
  removeWebhooksOnStart: true,
  webhookSecret: process.env.TSURU_APP_TOKEN,
  webhookUrl: 'http://' + process.env.TSURU_APPNAME + '.engine.bothub.io/flint'
};
