/**
 * Module dependencies.
 */

const {
  subdomain: isSubdomain,
  password: isPassword,
  email: isEmail
} = require("./valid");
const isUri = require("valid-url").isUri;
const resolve = require("path").resolve;
const exists = require("fs").existsSync;
const prompt = require("co-prompt");
const chalk = require("chalk");

/**
 * Start.
 */

exports.start = function*(subdomain, apiToken, email, password, pack) {
  var load, valid;
  if (!subdomain) {
    subdomain = yield ask(
      "Slack subdomain: ",
      isSubdomain,
      "Uh oh! The subdomain should be at least one letter!"
    );
  }
  if (!apiToken) {
    if (!email) {
      email = yield ask(
        "Email address login: ",
        isEmail,
        "Are you sure that is an email address? :)"
      );
    }
    if (!password) {
      password = yield ask(
        "Password: ",
        isPassword,
        "A password (as defined by this script) needs to have at least one character (not including you)."
      );
    }
  }
  if (!pack) {
    pack = yield ask(
      "Path or URL of Emoji yaml file: ",
      isPath,
      "Does the path to the yaml file look right? :)"
    );
  }
  load = {
    url: url(subdomain),
    apiToken: apiToken,
    email: email,
    password: password,
    pack: pack
  };
  return load;
};

/**
 * Prompt with validation.
 */

function* ask(message, valid, error) {
  var res;
  do {
    if (message.toLowerCase().indexOf("password") >= 0)
      res = yield prompt.password(message);
    else res = yield prompt(message);
    if (!valid(res)) err(error);
  } while (!valid(res));
  return res;
}

exports.prompt_ask = ask;

/**
 * is path
 */

function isPath(path) {
  return isUri(path) || exists(resolve(process.cwd(), path));
}

/**
 * Show error message.
 */

function err(message) {
  console.log(chalk.red(message));
}

/**
 * Url.
 */

function url(subdomain) {
  return "https://" + subdomain + ".slack.com";
}
