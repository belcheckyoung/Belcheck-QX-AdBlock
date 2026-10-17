const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Every response below is constructed locally. No captured or private data.
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "Scripts", "DouyinAdClean.js"), "utf8");
const feedHosts = [
  "api3-core-c.amemv.com",
  "api3-normal-c.amemv.com",
  "api.amemv.com",
  "aweme.snssdk.com",
];
const feedUrl = "https://api3-core-c.amemv.com/aweme/v1/feed/?source=synthetic";
const adBody = '{"aweme_list":[{"is_ads":true}]}';
let testCount = 0;

function test(name, callback) {
  callback();
  testCount += 1;
}

function execute(url, body, options = {}) {
  let output;
  let doneCount = 0;
  const logs = [];
  const context = {
    $request: { url },
    $response: { body },
    $done: (value) => { doneCount += 1; output = value; },
    $notify: () => { throw new Error("The script must not send notifications"); },
    $task: { fetch: () => { throw new Error("The script must not make requests"); } },
    console: { log: (value) => logs.push(String(value)) },
  };
  if (Object.prototype.hasOwnProperty.call(options, "statusCode")) {
    context.$response.statusCode = options.statusCode;
  }
  if (options.missingRequest) delete context.$request;
  if (options.missingResponse) delete context.$response;
  if (options.nullRequest) context.$request = null;
  if (options.nullResponse) context.$response = null;
  vm.runInNewContext(source, context, { timeout: 1000 });
  assert.strictEqual(doneCount, 1, "$done must be called exactly once");
  logs.forEach((line) => {
    assert.ok(/^\[DouyinAdClean\] (?:removed=\d+|fail-open)$/.test(line), "logs must contain only counts or fail-open");
  });
  return Object.assign({}, output);
}

function passThrough(body, url = feedUrl, options) {
  assert.deepStrictEqual(execute(url, body, options), {});
}

test("remove only explicit boolean true or numeric one", () => {
  const body = '{"aweme_list":[{"id":"ad-a","is_ads":true},{"id":"ad-b","is_ads":1},{"id":"false","is_ads":false},{"id":"zero","is_ads":0},{"id":"string","is_ads":"1"},{"id":"truthy","is_ads":"true"},{"id":"other","is_ads":2},{"id":"normal"}]}';
  assert.strictEqual(execute(feedUrl, body).body, '{"aweme_list":[{"id":"false","is_ads":false},{"id":"zero","is_ads":0},{"id":"string","is_ads":"1"},{"id":"truthy","is_ads":"true"},{"id":"other","is_ads":2},{"id":"normal"}]}');
});

test("normal feed without ads returns no changes", () => {
  passThrough('{"aweme_list":[{"id":"normal","is_ads":false},{"id":"live","room_id":"123"}]}');
  passThrough('{"aweme_list":[]}');
});

test("only the direct aweme_list is filtered", () => {
  const body = '{"data":{"aweme_list":[{"is_ads":true}]},"aweme_list":[{"id":"normal","metadata":{"is_ads":true}},{"is_ads":true}],"is_ads":true}';
  assert.strictEqual(execute(feedUrl, body).body, '{"data":{"aweme_list":[{"is_ads":true}]},"aweme_list":[{"id":"normal","metadata":{"is_ads":true}}],"is_ads":true}');
});

test("live, downloads, watermarks, pagination and raw text are preserved", () => {
  const body = ' { "cursor" : 1e2, "aweme_list" : [ { "room_id": "9007199254740993", "live": true, "video": {"download_addr":"synthetic-watermark","allow_download":false}, "decimal": 0.12345678901234567890123456789 }, {"is_ads":true} ], "has_more" : 1, "next_cursor" : "00123" }\n';
  assert.strictEqual(execute(feedUrl, body).body, ' { "cursor" : 1e2, "aweme_list" : [ { "room_id": "9007199254740993", "live": true, "video": {"download_addr":"synthetic-watermark","allow_download":false}, "decimal": 0.12345678901234567890123456789 }], "has_more" : 1, "next_cursor" : "00123" }\n');
});

test("unquoted signed and unsigned 64-bit IDs retain their exact tokens", () => {
  const body = '{"cursor":18446744073709551615,"aweme_list":[{"id":9223372036854775807,"negative_id":-9223372036854775808},{"is_ads":true,"id":9223372036854775806}],"n":-0}';
  assert.strictEqual(execute(feedUrl, body).body, '{"cursor":18446744073709551615,"aweme_list":[{"id":9223372036854775807,"negative_id":-9223372036854775808}],"n":-0}');
});

test("quoted 64-bit IDs and arbitrary numeric notation are preserved", () => {
  const body = '{"aweme_list":[{"id":"18446744073709551615","n":1e400,"tiny":1e-400,"decimal":1.00000000000000000001},{"is_ads":1}]}';
  assert.strictEqual(execute(feedUrl, body).body, '{"aweme_list":[{"id":"18446744073709551615","n":1e400,"tiny":1e-400,"decimal":1.00000000000000000001}]}');
});

test("near-one numbers must not become ads after floating-point rounding", () => {
  for (const marker of ["1.00000000000000000001", "0.99999999999999999999", "100000000000000000001e-20", "1e400", "1e-400", "-1", "0"]) {
    const normal = '{"is_ads":' + marker + ',"id":9223372036854775807}';
    assert.strictEqual(execute(feedUrl, '{"aweme_list":[' + normal + ',{"is_ads":true}]}').body, '{"aweme_list":[' + normal + ']}');
  }
});

test("exact decimal forms of numeric one are recognized without rounding", () => {
  for (const marker of ["1", "1.0", "1.000", "1e0", "1E+000", "10e-1", "0.1e1", "0.001e3", "1000.000e-3"]) {
    assert.strictEqual(execute(feedUrl, '{"aweme_list":[{"is_ads":' + marker + '}]}').body, '{"aweme_list":[]}');
  }
});

test("duplicate target array keys fail open", () => {
  passThrough('{"aweme_list":[],"aweme_list":[{"is_ads":true}]}');
  passThrough('{"aweme_list":[],"\\u0061weme_list":[{"is_ads":true}]}');
});

test("duplicate marker keys preserve the ambiguous item", () => {
  const ambiguous = '{"id":"keep","is_ads":false,"is_ads":true}';
  assert.strictEqual(execute(feedUrl, '{"aweme_list":[' + ambiguous + ',{"is_ads":true}]}').body, '{"aweme_list":[' + ambiguous + ']}');
  passThrough('{"aweme_list":[{"is_ads":true,"\\u0069s_ads":true}]}');
});

test("escaped field names work and unrelated duplicate fields keep their text", () => {
  const body = '{"duplicate":1,"duplicate":2,"\\u0061weme_list":[{"id":"keep","duplicate":1,"duplicate":2},{"\\u0069s_ads":true}]}';
  assert.strictEqual(execute(feedUrl, body).body, '{"duplicate":1,"duplicate":2,"\\u0061weme_list":[{"id":"keep","duplicate":1,"duplicate":2}]}');
});

test("strings containing JSON delimiters, escaped quotes and unicode survive", () => {
  const normal = JSON.stringify({ text: '合成, ] } " \\ \n', nested: [{ text: "[a,b]" }] });
  assert.strictEqual(execute(feedUrl, '{"aweme_list":[' + normal + ',{"is_ads":true}]}').body, '{"aweme_list":[' + normal + ']}');
});

test("non-object entries are preserved", () => {
  assert.strictEqual(execute(feedUrl, '{"aweme_list":[null,1,true,"is_ads",[1],{"is_ads":true}]}').body, '{"aweme_list":[null,1,true,"is_ads",[1]]}');
});

test("first, middle, last and all-ad removal produce valid JSON", () => {
  for (const entries of [
    [{ is_ads: true }, { id: "keep" }],
    [{ id: "left" }, { is_ads: 1 }, { id: "right" }],
    [{ id: "keep" }, { is_ads: true }],
    [{ is_ads: true }, { is_ads: 1 }],
  ]) {
    const output = execute(feedUrl, JSON.stringify({ aweme_list: entries, has_more: 1 }));
    assert.deepStrictEqual(JSON.parse(output.body), { aweme_list: entries.filter((item) => item.is_ads !== true && item.is_ads !== 1), has_more: 1 });
  }
});

test("second pass and independent repeated runs are stable", () => {
  const body = '{"aweme_list":[{"id":9223372036854775807},{"is_ads":true}]}';
  const first = execute(feedUrl, body);
  assert.deepStrictEqual(execute(feedUrl, body), first);
  passThrough(first.body);
  assert.strictEqual(execute(feedUrl, adBody).body, '{"aweme_list":[]}');
});

test("malformed JSON fails open", () => {
  for (const body of ["not JSON", '{"aweme_list":[{"is_ads":true},]}', '{"aweme_list":[{"is_ads":true}]', '\uFEFF{"aweme_list":[{"is_ads":true}]}']) passThrough(body);
});

test("null, binary or missing body fails open", () => {
  for (const body of [null, undefined, "", 1, new Uint8Array([0, 1])]) passThrough(body);
});

test("missing or null QX context objects fail open", () => {
  for (const option of ["missingRequest", "missingResponse", "nullRequest", "nullResponse"]) passThrough(adBody, feedUrl, { [option]: true });
});

test("unknown roots and list structures fail open", () => {
  for (const body of ["null", "[]", '"text"', "1", "{}", '{"aweme_list":null}', '{"aweme_list":{}}', '{"data":{"aweme_list":[{"is_ads":true}]}}']) passThrough(body);
});

test("explicit non-2xx HTTP status fails open and absent status is supported", () => {
  for (const statusCode of [0, 199, 300, 404, 500, null, "invalid", 200.5]) passThrough(adBody, feedUrl, { statusCode });
  for (const statusCode of [200, 206, 299, "200"]) assert.ok(execute(feedUrl, adBody, { statusCode }).body);
  assert.ok(execute(feedUrl, adBody).body);
});

const allowedUrls = [];
for (const host of feedHosts) {
  for (const protocol of ["http", "https"]) {
    for (const version of [1, 2]) {
      for (const suffix of ["", "/", "?source=synthetic", "/?source=synthetic"]) {
        allowedUrls.push(protocol + "://" + host + "/aweme/v" + version + "/feed" + suffix);
      }
    }
  }
}
const deniedUrls = [
  "HTTPS://api3-core-c.amemv.com/aweme/v1/feed/",
  "https://API3-CORE-C.AMEMV.COM/aweme/v1/feed/",
  "https://api3-core-c.amemv.com/AWEME/V1/FEED/",
  "https://api5-core-c.amemv.com/aweme/v1/feed/",
  "https://api3-core-lf.amemv.com/aweme/v1/feed/",
  "https://another.amemv.com/aweme/v1/feed/",
  "https://amemv.com/aweme/v1/feed/",
  "https://api3-core-c.amemv.com.invalid/aweme/v1/feed/",
  "https://invalid.example/api3-core-c.amemv.com/aweme/v1/feed/",
  "https://api3-core-c.amemv.com@invalid.example/aweme/v1/feed/",
  "https://invalid.example@api3-core-c.amemv.com/aweme/v1/feed/",
  "https://api3-core-c.amemv.com:443/aweme/v1/feed/",
  "https://api3-core-c.amemv.com:80/aweme/v1/feed/",
  "https://api3-core-c.amemv.com./aweme/v1/feed/",
  "https://api3-core-c.amemv.com/aweme/v0/feed/",
  "https://api3-core-c.amemv.com/aweme/v3/feed/",
  "https://api3-core-c.amemv.com/aweme/v11/feed/",
  "https://api3-core-c.amemv.com/aweme/v1/feedExtra",
  "https://api3-core-c.amemv.com/aweme/v1/feed/extra",
  "https://api3-core-c.amemv.com/aweme/v1/feed//",
  "https://api3-core-c.amemv.com/aweme/v1/aweme/detail/",
  "https://api3-core-c.amemv.com/aweme/v1/splash/",
  "https://api3-core-c.amemv.com/other?next=/aweme/v1/feed/",
  "https://api3-core-c.amemv.com/aweme/v1/feed#fragment",
  "ftp://api3-core-c.amemv.com/aweme/v1/feed/",
  "",
];

test("script accepts the exact feed URL matrix", () => {
  allowedUrls.forEach((url) => assert.ok(execute(url, adBody).body, url));
});

test("script rejects host, port and path boundary lookalikes", () => {
  deniedUrls.forEach((url) => passThrough(adBody, url));
});

function rewriteRegex(pattern) {
  const insensitive = pattern.startsWith("(?i)");
  return new RegExp(insensitive ? pattern.slice(4) : pattern, insensitive ? "i" : "");
}

const snippet = fs.readFileSync(path.join(root, "Rewrite", "DouyinAdClean.snippet"), "utf8");
const activeLines = snippet.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^(?:#|;|\/\/)/.test(line));
const rules = activeLines.filter((line) => line.includes(" url ")).map((line) => {
  const parts = line.split(/\s+url\s+/);
  return { line, regex: rewriteRegex(parts[0]), action: parts[1] };
});
const feedRules = rules.filter((rule) => rule.action.startsWith("script-response-body "));

test("snippet uses one feed script with a public main or immutable-commit URL", () => {
  assert.strictEqual(feedRules.length, 1);
  assert.ok(/^script-response-body https:\/\/raw\.githubusercontent\.com\/belcheckyoung\/Belcheck-QX-AdBlock\/(?:main|[a-f0-9]{40})\/Scripts\/DouyinAdClean\.js$/.test(feedRules[0].action));
  assert.ok(!rules.some((rule) => /request-header|script-request/.test(rule.action)), "do not alter request negotiation");
});

test("snippet and script have the same feed host and path boundaries", () => {
  for (const url of allowedUrls.concat(deniedUrls)) {
    assert.strictEqual(feedRules[0].regex.test(url), Boolean(execute(url, adBody).body), url);
  }
});

test("MITM hostname entries contain each exact feed host without wildcards", () => {
  const hostnameLines = activeLines.filter((line) => /^hostname\s*=/.test(line));
  assert.strictEqual(hostnameLines.length, 1);
  const hosts = hostnameLines[0].split("=")[1].split(",").map((host) => host.trim().toLowerCase()).filter((host) => host && host !== "%append%");
  feedHosts.forEach((host) => assert.ok(hosts.includes(host), host));
  assert.ok(hosts.every((host) => !/[?*]/.test(host)), "MITM scope must not use wildcard hosts");
  assert.strictEqual(hosts.length, new Set(hosts).size, "MITM hosts must not be duplicated");
  assert.deepStrictEqual(hosts.slice().sort(), feedHosts.concat("ad.zijieapi.com").sort(), "MITM scope must stay within the five exact hosts");
});

const rejectRules = rules.filter((rule) => rule.action === "reject");
const adRule = rejectRules.find((rule) => rule.regex.test("https://ad.zijieapi.com/api/ad/v1/slot"));
const splashRule = rejectRules.find((rule) => rule.regex.test("https://api3-core-c.amemv.com/api/ad/v1/splash/stock"));

test("snippet contains only the three intended active rules", () => {
  assert.strictEqual(rules.length, 3);
  assert.strictEqual(rejectRules.length, 2);
  assert.ok(adRule);
  assert.ok(splashRule);
  assert.notStrictEqual(adRule, splashRule);
});

test("ad.zijieapi reject covers exactly the three declared ad paths", () => {
  const adPaths = ["slot", "long/video", "recall_ads/banner"];
  for (const protocol of ["http", "https"]) {
    for (const adPath of adPaths) {
      for (const suffix of ["", "/", "?source=synthetic", "/?source=synthetic"]) {
        const url = protocol + "://ad.zijieapi.com/api/ad/v1/" + adPath + suffix;
        assert.ok(adRule.regex.test(url), url);
        assert.ok(!splashRule.regex.test(url), url);
        assert.ok(!feedRules[0].regex.test(url), url);
        passThrough(adBody, url);
      }
    }
  }
});

test("ad.zijieapi reject leaves other hosts and path lookalikes untouched", () => {
  const urls = [
    "https://ad.zijieapi.com.invalid/api/ad/v1/slot",
    "https://other.zijieapi.com/api/ad/v1/slot",
    "https://AD.ZIJIEAPI.COM/api/ad/v1/slot",
    "https://ad.zijieapi.com:443/api/ad/v1/slot",
    "https://ad.zijieapi.com@invalid.example/api/ad/v1/slot",
    "https://invalid.example@ad.zijieapi.com/api/ad/v1/slot",
    "https://ad.zijieapi.com/api/ad/v1/slotExtra",
    "https://ad.zijieapi.com/api/ad/v1/slot/extra",
    "https://ad.zijieapi.com/api/ad/v1/long/video/extra",
    "https://ad.zijieapi.com/api/ad/v1/recall_ads/bannerExtra",
    "https://ad.zijieapi.com/api/ad/v1/recall_ads",
    "https://ad.zijieapi.com/api/ad/v2/slot",
    "https://ad.zijieapi.com/API/AD/V1/SLOT",
    "https://ad.zijieapi.com/other?next=/api/ad/v1/slot",
    "https://ad.zijieapi.com/api/ad/v1/slot#fragment",
    "ftp://ad.zijieapi.com/api/ad/v1/slot",
    feedUrl,
  ];
  urls.forEach((url) => assert.ok(!adRule.regex.test(url), url));
});

test("splash reject covers exactly the five declared paths on four API hosts", () => {
  const splashPaths = [
    "v1/splash/stock",
    "v16/splash/preload",
    "splash/stock/realtime/v14",
    "splash/stock/realtime/v15",
    "splash/aweme/v15",
  ];
  for (const host of feedHosts) {
    for (const protocol of ["http", "https"]) {
      for (const splashPath of splashPaths) {
        for (const suffix of ["", "/", "?source=synthetic", "/?source=synthetic"]) {
          const url = protocol + "://" + host + "/api/ad/" + splashPath + suffix;
          assert.ok(splashRule.regex.test(url), url);
          assert.ok(!adRule.regex.test(url), url);
          assert.ok(!feedRules[0].regex.test(url), url);
          passThrough(adBody, url);
        }
      }
    }
  }
});

test("splash reject leaves other hosts, versions and subroutes untouched", () => {
  const urls = [
    "https://api5-core-c.amemv.com/api/ad/v1/splash/stock",
    "https://api3-core-lf.amemv.com/api/ad/v1/splash/stock",
    "https://api3-core-c.amemv.com.invalid/api/ad/v1/splash/stock",
    "https://API3-CORE-C.AMEMV.COM/api/ad/v1/splash/stock",
    "https://api3-core-c.amemv.com:443/api/ad/v1/splash/stock",
    "https://ad.zijieapi.com/api/ad/v1/splash/stock",
    "https://api3-core-c.amemv.com/api/ad/v1/splash/stockExtra",
    "https://api3-core-c.amemv.com/api/ad/v1/splash/stock/extra",
    "https://api3-core-c.amemv.com/api/ad/v16/splash/preloadExtra",
    "https://api3-core-c.amemv.com/api/ad/splash/stock/realtime/v13",
    "https://api3-core-c.amemv.com/api/ad/splash/stock/realtime/v16",
    "https://api3-core-c.amemv.com/api/ad/splash/stock/realtime/v140",
    "https://api3-core-c.amemv.com/api/ad/splash/aweme/v14",
    "https://api3-core-c.amemv.com/api/ad/splash/aweme/v15/extra",
    "https://api3-core-c.amemv.com/API/AD/V1/SPLASH/STOCK",
    "https://api3-core-c.amemv.com/other?next=/api/ad/v1/splash/stock",
    "https://api3-core-c.amemv.com/api/ad/v1/splash/stock#fragment",
    feedUrl,
  ];
  urls.forEach((url) => assert.ok(!splashRule.regex.test(url), url));
});

console.log("PASS douyin " + testCount + " synthetic tests: exact feed URL, raw-text preservation, 64-bit IDs, idempotence, fail-open, public snippet scope");
