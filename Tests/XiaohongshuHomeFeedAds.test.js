const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "Scripts", "XiaohongshuHomeFeedAds.js"),
  "utf8"
);

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8"));
}

function execute(url, body) {
  let output;
  let doneCount = 0;
  const logs = [];

  vm.runInNewContext(source, {
    $request: { url },
    $response: { body },
    $done: (value) => {
      doneCount += 1;
      output = value;
    },
    $notify: () => {
      throw new Error("The script must not send notifications");
    },
    console: { log: (value) => logs.push(String(value)) },
  });

  assert.strictEqual(doneCount, 1, "$done must be called exactly once");
  logs.forEach((line) => {
    assert.ok(!line.includes("http"), "logs must not include URLs");
    assert.ok(!line.includes("ad-one"), "logs must not include item identifiers");
    assert.ok(!line.includes("ads_id"), "logs must not include response fields");
  });
  return output;
}

const homeFeedUrl = "https://rec.xiaohongshu.com/api/sns/v6/homefeed?source=synthetic";
const input = fixture("xiaohongshu-homefeed.json");
const output = execute(homeFeedUrl, JSON.stringify(input));
assert.ok(output.body);

const cleaned = JSON.parse(output.body);
assert.deepStrictEqual(
  cleaned.data.map((item) => item.id),
  ["note-one", "live-one", "note-empty-ad-wrapper"]
);
assert.deepStrictEqual(cleaned.data[0], input.data[0]);
assert.deepStrictEqual(cleaned.data[1], input.data[2]);
assert.deepStrictEqual(cleaned.data[2], input.data[5]);
assert.strictEqual(cleaned.code, input.code);
assert.strictEqual(cleaned.success, input.success);
assert.strictEqual(cleaned.cursor, input.cursor);

const secondPass = execute(homeFeedUrl, output.body);
assert.strictEqual(secondPass.body, undefined, "the rewrite must be idempotent");

const categories = execute(
  "https://rec.xiaohongshu.com/api/sns/v6/homefeed/categories",
  JSON.stringify(input)
);
assert.strictEqual(categories.body, undefined, "sub-routes must not be modified");

const missingData = execute(homeFeedUrl, JSON.stringify({ code: 0, success: true }));
assert.strictEqual(missingData.body, undefined, "unknown structures must be preserved");

const malformed = execute(homeFeedUrl, "{not-json");
assert.strictEqual(malformed.body, undefined, "malformed JSON must fail open");

console.log("PASS xiaohongshu homefeed preserve-notes-live pagination idempotent exact-url fail-open");
