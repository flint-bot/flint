module.exports = {
  token: process.env.TOKEN,
  maxPageItems: 100,
  maxConcurrent: 5,
  minTime: 50,
  requeueCodes: [ 429, 500, 501, 502, 503 ],
  requeueMinTime: 500,
  removeWebhooksOnStart: true,
  webhookSecret: process.env.FLYNN_APP_ID,
  pubnubSubscribeKey: process.env.PubnubSubscribeKey,
  webhookUrl:  process.env.WebhookRecipientURL
};
