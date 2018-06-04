# node-flint (v5)

### Webex Teams (formerly Spark) Bot SDK for Node JS

## News

**x/x/x IMPORTANT:**

* Flint v5 is a huge refactor from v4. Before upgrading your existing bots to
use v5, please make sure to review all docs and examples to understand the new
class methods and library structure.

* Flint no longer supports tokens from non Bot Accounts. This has become
necessary due to the various difference between a bot and person token.
Additionally Cisco does not support nor endorse using a person token for bots.
Applications that require this functionality should be defined as a "App"
integration. You can read more about the differences between bots and apps
[here](https://developer.webex.com/bots.html#bots-vs-integrations). If you
are looking for a framework that uses a "person" token and integrates easier
into "App" integrations, check out either
[node-sparky](https://github.com/flint-bot/sparky) or the Cisco
[spark-js-sdk](https://github.com/ciscospark/spark-js-sdk).

**See [CHANGELOG.md](/CHANGELOG.md) for details on changes to versions of Flint.**

## Contents

<!-- START doctoc -->
<!-- END doctoc -->
