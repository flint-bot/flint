const when = require('when');
const _ = require('lodash');

class Listener {

  constructor(flint) {
    // validate required config
    if (!flint.config.webhookUrl) {
      throw new Error('invalid or missing config');
    }

    this.flint = flint;
  }

  start() {
    if (!this.flint.active) {
      this.flint.spark.on('memberships-created', data => this.flint.onMembershipCreated(data));
      this.flint.spark.on('memberships-updated', data => this.flint.onMembershipUpdated(data));
      this.flint.spark.on('memberships-deleted', data => this.flint.onMembershipDeleted(data));
      this.flint.spark.on('messages-created', data => this.flint.onMessageCreated(data));
      this.flint.spark.on('messages-deleted', data => this.flint.onMessageDeleted(data));
      this.flint.spark.on('rooms-created', data => this.flint.onRoomsCreated(data));
      this.flint.spark.on('rooms-updated', data => this.flint.onRoomsUpdated(data));
    }
  }

  stop() {
    if (this.flint.active) {
      this.flint.spark.removeAllListeners('memberships-created');
      this.flint.spark.removeAllListeners('memberships-updated');
      this.flint.spark.removeAllListeners('memberships-deleted');
      this.flint.spark.removeAllListeners('messages-created');
      this.flint.spark.removeAllListeners('messages-deleted');
      this.flint.spark.removeAllListeners('rooms-created');
      this.flint.spark.removeAllListeners('rooms-updated');
    }
  }

  init() {
    const webhookName = `flint:${_.toLower(this.flint.person.emails[0])}`;
    const webhookBody = {
      name: webhookName,
      targetUrl: this.flint.config.webhookUrl,
      resource: 'all',
      event: 'all',
    };

    return this.flint.spark.webhooksGet()
      .then((webhooks) => {
        const foundWebhooks = _.filter(webhooks, { name: webhookName });
        if (foundWebhooks && foundWebhooks instanceof Array && foundWebhooks.length > 0) {
          return when.map(webhooks, webhook => this.flint.spark.webhookRemove(webhook.id))
            .catch((err) => {
              // log error but ignore
              this.flint.logger.error(new Error(`could not remove all webhooks with name: ${webhookName}`));
              return when(true);
            });
        }
        return when(true);
      })
      .then(() => this.flint.spark.webhookAdd(webhookBody));
  }

}

module.exports = Listener;
