const assert = require("assert");
const fs = require("fs");
const path = require("path");

const snippet = fs.readFileSync(
  path.join(__dirname, "..", "Rewrite", "MeituanAppAdMedia.snippet"),
  "utf8"
);
const active = snippet
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

const ruleLine = active.find((line) => line.endsWith(" url reject-img"));
assert.ok(ruleLine, "the snippet must contain one reject-img rule");
assert.strictEqual(
  active.filter((line) => line.includes(" url ")).length,
  1,
  "the snippet must contain only one rewrite rule"
);

const pattern = ruleLine.slice(0, ruleLine.indexOf(" url reject-img"));
const matcher = new RegExp(pattern);

assert.ok(matcher.test("https://p0.meituan.net/adunion/creative.webp"));
assert.ok(matcher.test("https://p1.meituan.net/adunion/creative.png@800w"));
assert.ok(matcher.test("https://p1.meituan.net/adunion/opaque-synthetic-id"));
assert.ok(!matcher.test("https://p2.meituan.net/adunion/creative.webp"));
assert.ok(!matcher.test("https://p1.meituan.net/adunionized/normal.webp"));
assert.ok(!matcher.test("https://evil-p0.meituan.net/adunion/creative.webp"));

[
  "recommendimage",
  "channelpictures",
  "dpmerchantpic",
  "evapicture",
  "ingee",
  "mtgrowthmember",
  "linglong",
  "travelcube",
  "wmproduct",
].forEach((directory) => {
  assert.ok(
    !matcher.test("https://p0.meituan.net/" + directory + "/synthetic.webp"),
    "shared CDN directory must be preserved: " + directory
  );
});

const hostnameLine = active.find((line) => line.startsWith("hostname ="));
assert.strictEqual(hostnameLine, "hostname = p0.meituan.net, p1.meituan.net");

console.log("PASS meituan adunion p0-p1 exact-path preserve-shared-cdn");
