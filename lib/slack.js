/**
 * Module dependencies.
 */

const cheerio = require('cheerio');
const thunkify = require('thunkify-wrap');
const request = thunkify(require('request'));
const write = require('./debug').write;
const req = require('request');
const ask = require('./prompt').prompt_ask;
const { password: isPassword } = require('./valid');

/**
 * Expose `Slack`.
 */

module.exports = Slack;

/**
 * Static variables
 */

var loginFormPath = '/?no_sso=1';
var apiAuthTestEndpoint = '/api/auth.test';
var emojiAddEndpoint = '/api/emoji.add';
var apiTokenRegex = new RegExp('"api_token":"([a-zA-Z0-9-]*)"');

// required to avoid "This browser is not supported" message
var headers = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36',
};

/**
 * Initialize a new `Slack`.
 */
function Slack(opts, debug) {
  if (!(this instanceof Slack)) return new Slack(opts);
  this.opts = opts;
  this.debug = debug;

  /**
   * Do everything.
   */
  this.import = function*() {
    try {
      console.log('Starting import');
      yield this.tokens();
      console.log('Got tokens');
      if (!this.opts.apiToken) {
        yield this.login();
      }
      yield this.checkApiToken();
      console.log('Logged in');
    } catch (error) {
      console.log('Uh oh! ' + error);
      throw error;
    }
    console.log('Getting emoji page');
    let emojiList = '';
    let aliasList = '';
    for (let i = 0; i < Object.keys(this.opts.emojis).length; i++) {
      let emoji = this.opts.emojis[i];
      if (emoji.src) {
        const uploadRes = yield this.upload(emoji.name, emoji.src);
        emojiList += ' :' + emoji.name + ':';
      }
      if (emoji.aliases) {
        for (let n = 0; n < emoji.aliases.length; n++) {
          yield this.alias(emoji.name, emoji.aliases[n]);
          aliasList += ' :' + emoji.aliases[n] + ':';
        }
      }
    }
    console.log('Uploaded emojis:' + emojiList);
    console.log('Uploaded emoji aliases:' + aliasList);
    return 'Success';
  };

  /**
   * Get login page (aka credentials).
   */
  this.tokens = function*() {
    var opts = this.opts;
    opts.jar = opts.jar || { _jar: { store: { idx: {} } } };
    var load = {
      url: opts.url + loginFormPath,
      headers: headers,
      jar: opts.jar,
      method: 'GET',
    };
    var res = yield request(load);
    var $ = cheerio.load(res[0].body);
    if (this.debug) write($('title').text(), $.html());
    opts.formData = {
      signin: $('#signin_form input[name="signin"]').attr('value'),
      redir: $('#signin_form input[name="redir"]').attr('value'),
      crumb: $('#signin_form input[name="crumb"]').attr('value'),
      remember: 'on',
      email: opts.email,
      password: opts.password,
    };
    if (!opts.formData.signin && !opts.formData.redir && !opts.formData.crumb)
      throw new Error('Login error: could not get login form for ' + opts.url);
    return (this.opts = opts);
  };

  /**
   * Log into Slack and populate cookies.
   */
  this.login = function*() {
    var opts = this.opts;
    var load = {
      url: opts.url + loginFormPath,
      headers: headers,
      jar: opts.jar,
      method: 'POST',
      followAllRedirects: true,
      formData: opts.formData,
    };
    var res = yield request(load);
    if (
      res[0].body.indexOf(
        'Sorry, you entered an incorrect email address or password.',
      ) != -1
    ) {
      throw new Error('Login error: incorrect username / password');
    }

    if (res[0].body.indexOf('Enter your authentication code') != -1) {
      var $ = cheerio.load(res[0].body);

      var inputs = $('form input');

      var formData = {};

      inputs.each(function(i, v) {
        formData[v.attribs.name] = v.attribs.value;
      });

      user_2fa_code = yield ask(
        '2FA Code: ',
        isPassword,
        'A password (as defined by this script) needs to have at least one character (not including you).',
      );
      formData['2fa_code'] = user_2fa_code;

      delete formData[undefined];
      delete formData['input'];

      var load_2fa = {
        url: opts.url + '/',
        headers: headers,
        jar: opts.jar,
        method: 'POST',
        followAllRedirects: true,
        formData: formData,
      };
      res = yield request(load_2fa);
    }

    //TODO: it may be necessary in the future to replace this with a user-supplied token
    var match = apiTokenRegex.exec(res[0].body);
    if (!match || !match[1]) {
      throw new Error(
        'Application Error: unable to find api token on login page',
      );
    }
    opts.apiToken = match[1];

    return (this.opts = opts);
  };

  /**
   * Check api token is work
   */
  this.checkApiToken = function*() {
    console.log('Checking api token is work');
    var opts = this.opts;
    return new Promise(function(resolve, reject) {
      req(
        {
          url: opts.url + apiAuthTestEndpoint,
          headers: headers,
          method: 'POST',
          jar: opts.jar,
          formData: {
            token: opts.apiToken,
          },
        },
        function(err, res, body) {
          if (err || !body || !JSON.parse(body).ok) return reject(err);
          resolve(JSON.parse(body));
        },
      );
    });
  };

  /**
   * Upload the emoji src
   */
  this.upload = function*(name, emoji) {
    console.log('Uploading %s with %s', name, emoji);
    return new Promise(
      function(resolve, reject, notify) {
        var opts = this.opts;
        var r = req(
          {
            url: opts.url + emojiAddEndpoint,
            headers: headers,
            method: 'POST',
            jar: opts.jar,
            followAllRedirects: true,
          },
          function(err, res, body) {
            if (err || !body) return reject(err);
            resolve(body);
          },
        );
        var form = r.form();
        form.append('name', name);
        form.append('mode', 'data');
        form.append('image', req(emoji));
        form.append('token', opts.apiToken);
      }.bind(this),
    );
  };

  /**
   * Upload the emoji alias name
   */
  this.alias = function*(name, alias) {
    console.log('Aliasing %s to %s', alias, name);
    return new Promise(
      function(resolve, reject, notify) {
        var opts = this.opts;
        var r = req(
          {
            url: opts.url + emojiAddEndpoint,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36',
            },
            method: 'POST',
            jar: opts.jar,
            followAllRedirects: true,
          },
          function(err, res, body) {
            if (err || !body) return reject(err);
            resolve(body);
          },
        );
        var form = r.form();
        form.append('name', alias);
        form.append('mode', 'alias');
        form.append('alias_for', `:${name}:`);
        form.append('token', opts.apiToken);
      }.bind(this),
    );
  };
}
