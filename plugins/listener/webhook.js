class Listener {

  constructor(flint) {
    this.flint = flint;
  }

  start() {
    if (!this.flint.active) {
      this.flint.spark.on('memberships-created', (data, bodyObj) => this.flint.onMembershipCreated(data, bodyObj));
      this.flint.spark.on('memberships-updated', (data, bodyObj) => this.flint.onMembershipUpdated(data, bodyObj));
      this.flint.spark.on('memberships-deleted', (data, bodyObj) => this.flint.onMembershipDeleted(data, bodyObj));
      this.flint.spark.on('messages-created', (data, bodyObj) => this.flint.onMessageCreated(data, bodyObj));
      this.flint.spark.on('messages-deleted', (data, bodyObj) => this.flint.onMessageDeleted(data, bodyObj));
      this.flint.spark.on('rooms-created', (data, bodyObj) => this.flint.onRoomsCreated(data, bodyObj));
      this.flint.spark.on('rooms-updated', (data, bodyObj) => this.flint.onRoomsUpdated(data, bodyObj));
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

}

module.exports = Listener;
