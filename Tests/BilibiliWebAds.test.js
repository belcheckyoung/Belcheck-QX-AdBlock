const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "Scripts", "BilibiliWebAds.js"),
  "utf8"
);

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
    assert.ok(!line.includes("https://"), "logs must not include URLs");
    assert.ok(!line.includes("BVAD"), "logs must not include content identifiers");
    assert.ok(!line.includes("access_key"), "logs must not include credentials");
  });
  return output;
}

const feedUrl =
  "https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd?synthetic=1";
const feed = {
  code: 0,
  message: "0",
  ttl: 1,
  data: {
    item: [
      { id: 101, bvid: "BVNORMAL1", goto: "av", business_info: null },
      { id: 0, bvid: "", goto: "ad", business_info: { creative_id: 201 } },
      {
        id: 102,
        bvid: "BVADPROMOTED",
        goto: "av",
        business_info: { is_ad_loc: true },
      },
      { id: 103, goto: "live", business_info: null },
    ],
    user_feature: { synthetic: true },
    mid: 0,
  },
};

const feedOutput = execute(feedUrl, JSON.stringify(feed));
assert.ok(feedOutput.body);
const cleanedFeed = JSON.parse(feedOutput.body);
assert.deepStrictEqual(
  cleanedFeed.data.item.map((item) => item.id),
  [101, 103]
);
assert.deepStrictEqual(cleanedFeed.data.item[0], feed.data.item[0]);
assert.deepStrictEqual(cleanedFeed.data.item[1], feed.data.item[3]);
assert.deepStrictEqual(cleanedFeed.data.user_feature, feed.data.user_feature);
assert.strictEqual(cleanedFeed.data.mid, feed.data.mid);

const secondFeedPass = execute(feedUrl, feedOutput.body);
assert.strictEqual(secondFeedPass.body, undefined, "feed rewrite must be idempotent");

const nearbyFeed = execute(
  "https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd/archive",
  JSON.stringify(feed)
);
assert.strictEqual(nearbyFeed.body, undefined, "sub-routes must not be modified");

const malformed = execute(feedUrl, "{not-json");
assert.strictEqual(malformed.body, undefined, "malformed JSON must fail open");

const unknown = execute(feedUrl, JSON.stringify({ code: 0, data: {} }));
assert.strictEqual(unknown.body, undefined, "unknown structures must be preserved");

const homepage = "<!doctype html><html><body><main>synthetic</main></body></html>";
const homeOutput = execute("https://www.bilibili.com/", homepage);
assert.ok(homeOutput.body.includes('id="belcheck-qx-bilibili-web-adblock"'));
assert.ok(homeOutput.body.includes("<main>synthetic</main>"));
assert.strictEqual(
  homeOutput.body.indexOf('id="belcheck-qx-bilibili-web-adblock"'),
  homeOutput.body.lastIndexOf('id="belcheck-qx-bilibili-web-adblock"')
);

const secondHomePass = execute("https://www.bilibili.com/", homeOutput.body);
assert.strictEqual(secondHomePass.body, undefined, "HTML injection must be idempotent");

const videoPage = execute("https://www.bilibili.com/video/BVNORMAL1", homepage);
assert.strictEqual(videoPage.body, undefined, "video pages must not be modified");

const browserCode = homeOutput.body.match(
  /<script id="belcheck-qx-bilibili-web-adblock">([\s\S]*?)<\/script>/
)[1];
const feedNode = makeNode(["https://www.bilibili.com/video/BVADSSR"]);
const carouselNode = makeNode([
  "https://i2.hdslb.com/bfs/sycp_brand/creative_img/synthetic.jpg",
]);

function makeNode(values) {
  return {
    removed: false,
    querySelector: () => null,
    querySelectorAll: () =>
      values.map((value) => ({
        getAttribute: (name) => (name === "href" || name === "src" ? value : ""),
      })),
    remove() {
      this.removed = true;
    },
  };
}

const browserState = {
  feed: {
    data: {
      head: {
        recommend: [
          { bvid: "BVKEEPSSR", goto: "av" },
          { bvid: "BVADSSR", goto: "av", is_ad_loc: true },
        ],
        banner_card: [],
      },
      banner_card: [],
      recommend: { item: [] },
    },
  },
  carousel: {
    recommendedSwipe: [
      { id: 301, pic: "https://i2.hdslb.com/bfs/banner/keep.jpg" },
      {
        id: 0,
        is_ad_loc: true,
        pic: "https://i2.hdslb.com/bfs/sycp_brand/creative_img/synthetic.jpg",
      },
    ],
  },
};

function Observer(callback) {
  this.callback = callback;
  this.observe = () => {};
}

vm.runInNewContext(browserCode, {
  window: { __pinia: browserState },
  document: {
    readyState: "complete",
    documentElement: {},
    querySelectorAll: () => [feedNode, carouselNode],
    addEventListener: () => {},
  },
  MutationObserver: Observer,
});

assert.deepStrictEqual(
  browserState.feed.data.head.recommend.map((item) => item.bvid),
  ["BVKEEPSSR"]
);
assert.strictEqual(browserState.carousel.recommendedSwipe.length, 1);
assert.strictEqual(feedNode.removed, true, "SSR promoted feed card must be removed");
assert.strictEqual(carouselNode.removed, true, "commercial carousel must be removed");

console.log(
  "PASS bilibili-web feed-object SSR-state carousel-material exact-root idempotent fail-open"
);
