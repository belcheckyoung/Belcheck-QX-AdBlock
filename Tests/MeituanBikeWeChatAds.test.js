const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "Scripts", "MeituanBikeWeChatAds.js"), "utf8");

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
    assert.ok(!line.includes("adunit"), "logs must not include ad identifiers");
  });
  return output;
}

const homeUrl = "https://bike.meituan.com/api/v3/recommend/home/v3";
const hermesUrl = "https://bike.meituan.com/api/ads-hermes/resourceList";
const settleUrl = "https://bike.meituan.com/api/v3/recommend/settle/v2";

const homeInput = fixture("home.json");
const homeOutput = execute(homeUrl, JSON.stringify(homeInput));
assert.ok(homeOutput.body);
const home = JSON.parse(homeOutput.body);
assert.deepStrictEqual(home.data.adsHomeBannerAd, [homeInput.data.adsHomeBannerAd[1]]);
assert.deepStrictEqual(home.data.adsHomeBannerDaily, homeInput.data.adsHomeBannerDaily);
assert.deepStrictEqual(home.data.ridingData, homeInput.data.ridingData);

const hermesInput = fixture("hermes.json");
const hermesOutput = execute(hermesUrl, JSON.stringify(hermesInput));
assert.ok(hermesOutput.body);
const hermes = JSON.parse(hermesOutput.body);
assert.deepStrictEqual(
  hermes.data[0].infos.map((item) => item.name),
  ["keep MOBIKE content", "keep other content"]
);
assert.deepStrictEqual(
  hermes.data[1].nested.infos.map((item) => item.name),
  ["keep nested content"]
);

const settleInput = fixture("settle.json");
const settleOutput = execute(`${settleUrl}?synthetic=1`, JSON.stringify(settleInput));
assert.ok(settleOutput.body);
const settle = JSON.parse(settleOutput.body);
assert.deepStrictEqual(
  settle.data.adsResource[0].infos.map((group) => group.map((item) => item.name)),
  [["keep MOBIKE settlement content"], ["keep partner settlement content"]]
);
assert.deepStrictEqual(settle.data.adsResource[1].infos, []);
assert.deepStrictEqual(settle.data.adsResource[2], settleInput.data.adsResource[2]);
assert.deepStrictEqual(settle.data.adsMission, settleInput.data.adsMission);
assert.deepStrictEqual(settle.data.payStatus, settleInput.data.payStatus);
assert.deepStrictEqual(settle.data.receipt, settleInput.data.receipt);

const secondPass = execute(homeUrl, homeOutput.body);
assert.strictEqual(secondPass.body, undefined, "the rewrite must be idempotent");

const settleSecondPass = execute(settleUrl, settleOutput.body);
assert.strictEqual(settleSecondPass.body, undefined, "the settlement rewrite must be idempotent");

const unrelated = execute("https://bike.meituan.com/api/ride/status", "{}");
assert.strictEqual(unrelated.body, undefined, "unrelated routes must not be modified");

const adjacent = execute("https://bike.meituan.com/api/v3/recommend/settle/v20", JSON.stringify(settleInput));
assert.strictEqual(adjacent.body, undefined, "adjacent settlement routes must not be modified");

const malformed = execute(homeUrl, "{not-json");
assert.strictEqual(malformed.body, undefined, "malformed JSON must fail open");

console.log("PASS home hermes settle nested preserve-normal idempotent exact-url fail-open");
