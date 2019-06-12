
/**
 * Module dependencies.
 */

const resolve = require("path").resolve;
const fs = require("fs");

/**
 * Write file.
 */

exports.write = function(title, html) {
  const test = resolve(__dirname, "../test/" + title + ".html");
  fs.writeFileSync(test, html);
};
