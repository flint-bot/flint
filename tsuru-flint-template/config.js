module.exports = {
  token: '<token>',
  maxPageItems: 100,
  maxConcurrent: 5,
  minTime: 50,
  requeueCodes: [ 429, 500, 501, 502, 503 ],
  requeueMinTime: 500,
  removeWebhooksOnStart: true,
  webhookSecret: '<secret>'
};
