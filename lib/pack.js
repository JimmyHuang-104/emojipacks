
/**
 * Module dependencies.
 */

const thunkify = require("thunkify-wrap");
const get = thunkify(require("request").get);
const resolve = require("path").resolve;
const exists = require("fs").existsSync;
const isUri = require("valid-url").isUri;
const yaml = require("js-yaml");
const fs = require('fs');

/**
 * Get pack.
 *
 * @param {string}
 *
 * @return {array}
 */

exports.get = function *(path) {
  var yml = yield getYaml(path);
  return yaml.safeLoad(yml);
};

/**
 * Get the yaml.
 *
 * @param {String} path
 *
 * @return {array}
 */

function *getYaml(path) {
  if (isUri(path)) {
    var res = yield get(path);
    return res[0].body;
  }
  if (exists(resolve(process.cwd(), path))) return fs.readFileSync(path, 'utf-8');
  return;
}
