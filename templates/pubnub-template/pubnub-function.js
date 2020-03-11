// pubnub function that receives webhook from webex teams and inserts into 3 different channels
// function publishes to 3 channels
// as an example for a membership created webhoo, i.e. the bot or someone joining a room the following channels will be populated
// webex-memberships-created
// webex-memberships-all
// webex-all-all
const pubnub = require('pubnub');

export default (request, response) => {

  function publish(channel, message) {
    return pubnub.publish({
      "channel": channel,
      "message": message
    }).then((publishResponse) => {
      console.log(channel + " " + publishResponse);
      return publishResponse;
    }).catch((err) => {
      throw new Error(err);
    });
  }

  // make it an object for ease of access to properties
  const body = JSON.parse(request.body);
  // we wnt the header so we can check for the x-spark-signature header if we use a secret
  const headers = request.headers;

  var message = {
    headers: headers,
    body: body
  }

  // we want header fields as well for example to being able to verify the secret and x-spark-signature with it
  // the flint webhook expects an object in it's code
  // if the follow the nomenclature a.b.c for channels we can use pubnubs wildcard subscription
  // the channels would be for example
  // webex.memberships.created - webex.memberships.all
  // this is a good approach if you want to use pubnub wildcard subscriptions
  // see here https://www.pubnub.com/developers/tech/key-concepts/stream-controller/wildcard-subscribe/
  return Promise.all([
    publish(`webex.${body.resource}.${body.event}`, message),
    publish(`webex.${body.resource}.all`, message),
    publish(`webex`, message)
  ])
    .then(results => {
      response.status = 200;
      return response.send("OK");
    })
    .catch(err => {
      console.log(err);
      response.status = 500;
      return response.send("Can't publish");
    });
};