const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "Scripts", "WeChatAdClean.js"), "utf8");
const endpoint = "https://mp.weixin.qq.com/mp/getappmsgad";

// All fixtures below are synthetic; no captures, account data or article IDs.
const input = {
  ret: 0,
  base_resp: { ret: 0, err_msg: "synthetic-success" },
  advertisement_num: 2,
  advertisement_info: [{ id: "synthetic-ad-one" }, { id: "synthetic-ad-two" }],
  appid: "synthetic-app",
  article: { title: "private-article-sentinel", content: "Synthetic article" },
  comments: [{ content: "private-comment-sentinel", advertisement_num: 7 }],
  data: { advertisement_num: 3, advertisement_info: ["keep-nested-marker"] },
  unknown: { keep: [null, false, 0, "synthetic-value"] },
};
const inputBody = JSON.stringify(input);
const expected = { ...input, advertisement_num: 0, advertisement_info: [] };

function execute(url, body, responseFields = {}) {
  let output;
  let doneCount = 0;
  let notifications = 0;
  let networkCalls = 0;
  const logs = [];
  const log = (...args) => logs.push(args.map((value) =>
    typeof value === "string" ? value : JSON.stringify(value)
  ).join(" "));
  const network = () => {
    networkCalls += 1;
    throw new Error("The response rewrite must not make network requests");
  };

  vm.runInNewContext(source, {
    $request: { url },
    $response: { body, ...responseFields },
    $done: (value) => {
      doneCount += 1;
      output = value;
    },
    $notify: () => { notifications += 1; },
    $task: { fetch: network },
    $httpClient: { get: network, post: network, put: network, delete: network },
    fetch: network,
    XMLHttpRequest: network,
    console: { log, info: log, warn: log, error: log, debug: log },
  }, { timeout: 1000 });

  assert.strictEqual(doneCount, 1, "$done must be called exactly once");
  assert.strictEqual(notifications, 0, "the script must not notify");
  assert.strictEqual(networkCalls, 0, "the script must not make network requests");
  assert.ok(output && typeof output === "object" && !Array.isArray(output));
  for (const line of logs) {
    assert.ok(!/https?:|private-|synthetic-|appid|advertisement_info/.test(line),
      "logs must not expose URLs, response data or identifiers");
  }
  return JSON.parse(JSON.stringify(output));
}

function unchanged(body, label, url, responseFields) {
  const requestUrl = arguments.length < 3 ? endpoint : url;
  assert.deepStrictEqual(execute(requestUrl, body, responseFields), {}, label);
}

const validUrls = [
  endpoint,
  `${endpoint}?source=synthetic`,
  `${endpoint}?`,
  "http://mp.weixin.qq.com/mp/getappmsgad?source=synthetic",
  "https://MP.WeiXin.QQ.COM/mp/getappmsgad",
];
for (const url of validUrls) {
  const output = execute(url, inputBody);
  assert.deepStrictEqual(Object.keys(output), ["body"]);
  assert.deepStrictEqual(JSON.parse(output.body), expected,
    "only the two root advertising fields may change");
  unchanged(output.body, "a second pass must be a no-op", url);
}

for (const [count, ads] of [[1, []], [0, ["synthetic-ad"]], [9, [null]]]) {
  const output = execute(endpoint, JSON.stringify({ advertisement_num: count, advertisement_info: ads }));
  assert.deepStrictEqual(JSON.parse(output.body), { advertisement_num: 0, advertisement_info: [] },
    "either a positive count or a nonempty array is sufficient");
}

for (const statusCode of [200, 204, 299]) {
  assert.deepStrictEqual(JSON.parse(execute(endpoint, inputBody, { statusCode }).body), expected);
}
for (const statusCode of [0, 199, 300, 404, 500, "200", null, false, NaN, Infinity]) {
  unchanged(inputBody, "non-success or unknown status must fail open", endpoint, { statusCode });
}

const invalidUrls = [
  `${endpoint}/`, `${endpoint}/child`, `${endpoint}ext`, `${endpoint}.json`,
  `${endpoint}#fragment`, `${endpoint}?source=synthetic#fragment`,
  "https://mp.weixin.qq.com/MP/getappmsgad",
  "https://mp.weixin.qq.com/mp/GETAPPMSGAD",
  "https://mp.weixin.qq.com:443/mp/getappmsgad",
  "http://mp.weixin.qq.com:80/mp/getappmsgad",
  "https://mp.weixin.qq.com:8443/mp/getappmsgad",
  "https://user@mp.weixin.qq.com/mp/getappmsgad",
  "https://mp.weixin.qq.com.example.invalid/mp/getappmsgad",
  "https://example.invalid/mp.weixin.qq.com/mp/getappmsgad",
  "https://mpxweixinxqqxcom/mp/getappmsgad",
  "https://mp.weixin.qq.com./mp/getappmsgad",
  "https://mp.weixin.qq.com/mp/getappmsgext",
  "https://short.weixin.qq.com/mmtls/12345678",
  "https://wxsnsad.tc.qq.com/ad",
  "https://h5.gdt.qq.com/ad",
  "ftp://mp.weixin.qq.com/mp/getappmsgad",
  ` ${endpoint}`, "", undefined, null, 123,
];
for (const url of invalidUrls) unchanged(inputBody, "unrelated or ambiguous URL must fail open", url);

const invalidBodies = [
  "", " ", "{not-json", "null", "[]", "true", "1", '"synthetic-text"',
  undefined, null, 0, false, {}, [],
  "{}",
  '{"advertisement_num":0,"advertisement_info":[]}',
  '{"advertisement_num":1}',
  '{"advertisement_info":["synthetic-ad"]}',
  '{"data":{"advertisement_num":1,"advertisement_info":["synthetic-ad"]}}',
  '{"advertisement_num":"1","advertisement_info":[]}',
  '{"advertisement_num":true,"advertisement_info":[]}',
  '{"advertisement_num":null,"advertisement_info":[]}',
  '{"advertisement_num":-1,"advertisement_info":["synthetic-ad"]}',
  '{"advertisement_num":1.5,"advertisement_info":["synthetic-ad"]}',
  '{"advertisement_num":1e400,"advertisement_info":[]}',
  '{"advertisement_num":9007199254740993,"advertisement_info":[]}',
  '{"advertisement_num":1,"advertisement_info":{}}',
  '{"advertisement_num":1,"advertisement_info":null}',
  '{"advertisement_num":1,"advertisement_info":"synthetic-ad"}',
];
for (const body of invalidBodies) unchanged(body, "malformed, unknown or already-empty body must fail open");

for (const ret of [1, -1, "0", null, false, {}, []]) {
  unchanged(JSON.stringify({ ...input, ret }), "nonzero or unknown root ret must fail open");
  unchanged(JSON.stringify({ ...input, base_resp: { ret } }),
    "nonzero or unknown base_resp.ret must fail open");
}

for (const body of [
  '{"advertisement_num":1,"advertisement_num":2,"advertisement_info":[]}',
  '{"advertisement_num":1,"advertisement_info":[],"keep":1,"keep":2}',
  String.raw`{"advertisement_num":1,"advertisement_info":[],"keep":1,"k\u0065ep":2}`,
  String.raw`{"advertisement_num":1,"advertisement_\u006eum":2,"advertisement_info":[]}`,
]) unchanged(body, "duplicate root keys, including escaped duplicates, must fail open");

const rawBody = String.raw`{
  "appid": "synthetic-app",
  "unknown_integer": 9007199254740993,
  "unknown_decimal": 0.123456789012345678901234567890,
  "nested": {"keep": 1, "keep": 2, "advertisement_num": 8, "advertisement_info": ["keep"]},
  "text": "braces } ] { [ and quote \" and fake \"advertisement_num\":9,\"advertisement_info\":[1]",
  "advertisement_num" : 2,
  "advertisement_info" : [{"text": "escaped quote \" and closing ] }"}, [null, {"keep": true}]],
  "comments": ["private-comment-sentinel"]
}`;
const expectedRaw = String.raw`{
  "appid": "synthetic-app",
  "unknown_integer": 9007199254740993,
  "unknown_decimal": 0.123456789012345678901234567890,
  "nested": {"keep": 1, "keep": 2, "advertisement_num": 8, "advertisement_info": ["keep"]},
  "text": "braces } ] { [ and quote \" and fake \"advertisement_num\":9,\"advertisement_info\":[1]",
  "advertisement_num" : 0,
  "advertisement_info" : [],
  "comments": ["private-comment-sentinel"]
}`;
const rawOutput = execute(endpoint, rawBody);
assert.strictEqual(rawOutput.body, expectedRaw,
  "unknown numeric tokens, whitespace, nested duplicates and quoted fake fields must remain byte-for-byte");
unchanged(rawOutput.body, "raw-preserving rewrite must be idempotent");

const escapedKeys = String.raw`{"advertisement_\u006eum":1,"advertisement_\u0069nfo":["synthetic-ad"],"keep":true}`;
assert.strictEqual(execute(endpoint, escapedKeys).body,
  String.raw`{"advertisement_\u006eum":0,"advertisement_\u0069nfo":[],"keep":true}`,
  "decoded target keys must retain their original spelling");

const snippet = fs.readFileSync(path.join(root, "Rewrite", "WeChatAdClean.snippet"), "utf8");
const activeLines = snippet.split(/\r?\n/).map((line) => line.trim())
  .filter((line) => line && !/^(?:#|;|\/\/)/.test(line));
const rewriteLines = activeLines.filter((line) => /\surl\s/.test(line));
const hostLines = activeLines.filter((line) => /^hostname\s*=/i.test(line));
assert.strictEqual(activeLines.length, 2, "snippet may enable only its one rewrite and exact MITM hostname");
assert.strictEqual(rewriteLines.length, 1);
assert.strictEqual(hostLines.length, 1);
assert.match(hostLines[0], /^hostname\s*=\s*mp\.weixin\.qq\.com$/,
  "MITM hostname must not include WeChat-wide wildcards or candidate domains");
const [pattern, action, scriptType, scriptUrl, ...extra] = rewriteLines[0].split(/\s+/);
assert.strictEqual(action, "url");
assert.strictEqual(scriptType, "script-response-body");
assert.deepStrictEqual(extra, []);
assert.match(scriptUrl,
  /^https:\/\/raw\.githubusercontent\.com\/belcheckyoung\/Belcheck-QX-AdBlock\/(?:main|[a-f0-9]{40})\/Scripts\/WeChatAdClean\.js$/);
const snippetPattern = new RegExp(pattern);
for (const url of validUrls) assert.ok(snippetPattern.test(url), "snippet must match intended endpoint");
for (const url of invalidUrls.filter((url) => typeof url === "string")) {
  assert.ok(!snippetPattern.test(url), "snippet must reject adjacent routes, ports, MMTLS and unverified hosts");
}

console.log("PASS wechat exact-url root-only preserve-raw-data fail-open idempotent snippet-boundaries");
