const Ws = require('ws');
const FileSync = require('lowdb/adapters/FileSync');
const request = require('request');
const crypto = require('crypto');
const lowdb = require('lowdb');
const when = require('when');
const uuid = require('uuid');
// const _ = require('lodash');

// promisfy JSON.parse and JSON.stringify
const jsonParse = when.lift(JSON.parse);
const jsonStringify = when.lift(JSON.stringify);

// init local json store
const adapter = new FileSync('devices.json');
const db = lowdb(adapter);
if (!db.has('devices').value()) {
  db.defaults({ devices: [] }).write();
}

class WebSocket {

  constructor(flint) {
    this.flint = flint;
    this.token = null;
    this.id = null;
    this.ws = null;
  }

  static getOpts(token, method, uri) {
    const opts = {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      method: method,
      uri: uri,
      auth: {
        bearer: token,
      },
      json: true,
      time: true,
    };

    return opts;
  }

  refreshToken() {
    // validate token has not changed...
    if (this.flint.config.token !== this.token) {
      // update token
      this.token = this.flint.config.token;
      // update id
      this.id = crypto.createHash('md5').update(this.token).digest('hex');
    }
  }

  getDevice() {
    const opts = WebSocket.getOpts(this.token, 'post', 'https://wdm-a.wbx2.com/wdm/api/v1/devices');
    opts.body = {
      deviceName: 'nodewebscoket-client',
      deviceType: 'DESKTOP',
      localizedModel: 'nodeJS',
      model: 'nodeJS',
      name: 'node-spark-client',
      systemName: 'node-spark-client',
      systemVersion: '0.1',
    };
    return when.promise((resolve, reject) => {
      request(opts, (err, res, body) => {
        if (!err && res.statusCode >= 200 && res.statusCode <= 200) {
          resolve(res.body);
        } else {
          reject(new Error('error creating device'));
        }
      });
    });
  }

  deleteDevice(device) {
    const opts = WebSocket.getOpts(this.token, 'delete', device.url);
    return when.promise((resolve, reject) => {
      request(opts, (err, res, body) => {
        if (!err && res.statusCode >= 200 && res.statusCode <= 200) {
          resolve(true);
        } else {
          reject(err);
        }
      });
    }).then(() => {
      db.get('devices').remove({ id: this.id }).write();
      return when(true);
    });
  }

  connectWebsocket() {
    if (this.ws) {
      this.ws.on('open', () => {
        this.refreshToken();
        this.flint.logger.info('Websocket connection open...');

        const socketAuth = {
          id: uuid.v4(),
          type: 'authorization',
          data: {
            token: `Bearer ${this.token}`,
          },
        };

        jsonStringify(socketAuth)
          .then((socketAuthString) => {
            this.ws.send(socketAuthString);
            return when(true);
          });
      });

      this.ws.on('close', () => {
        this.flint.logger.info('Websocket connection closed...');
      });

      this.ws.on('error', (err) => {
        this.flint.logger.error(err);
      });

      this.ws.on('message', (data) => {
        const message = Buffer(data).toString();
        jsonParse(message)
          .then((messageObj) => {
            this.flint.logger.info(JSON.stringify(messageObj, null, 2));
          })
          .catch(err => this.flint.logger.error(err));
      });
    }
  }

  start() {
    this.refreshToken();

    // query device
    const devices = db.get('devices').find({ id: this.id }).value();

    // if exisiting device...
    if (devices) {
      // then delete
      return this.deleteDevice(devices.device)
        .then(() => this.connect());
    }

    // else get device
    return this.getDevice()
      .then((deviceObj) => {
        db.get('devices').push({ id: this.id, device: deviceObj }).write();
        // update websocket
        this.ws = new Ws(deviceObj.webSocketUrl);
        // connect to websocket
        this.connectWebsocket();
        return when(true);
      });
  }

  stop() {}

  init() {}

}

module.exports = WebSocket;
