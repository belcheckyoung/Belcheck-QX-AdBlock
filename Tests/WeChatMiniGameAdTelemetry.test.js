const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const filterText = fs.readFileSync(
  path.join(root, "Filters", "WeChatMiniProgramAds.list"),
  "utf8"
);
const snippetText = fs.readFileSync(
  path.join(root, "Rewrite", "WeChatMiniGameAdTelemetry.snippet"),
  "utf8"
);

const activeFilterRules = filterText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

assert.deepStrictEqual(activeFilterRules, [
  "host, wxsmw.wxs.qq.com, reject",
  "host, wximg.wxs.qq.com, reject",
  "host, img.ssad.qq.com, reject",
  "host, smw.ssad.qq.com, reject",
]);
assert(!filterText.includes("host-suffix,"));
assert(!/sz(?:ext|minor)?short\.weixin\.qq\.com/.test(filterText));

const rewriteLines = snippetText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.includes(" url-and-header "));

assert.strictEqual(rewriteLines.length, 3);

const targets = [
  "https://api.gravity-engine.com/event_center/api/v1/event/collect/?synthetic=1",
  "https://api.datanexus.qq.com/data-nexus-cgi/miniprogram",
  "https://report-online.sh.wxgateway.com/SdkReport",
];
const targetHeader =
  "POST /synthetic HTTP/1.1\r\n" +
  "Referer: https://servicewechat.com/wx6f959f42eaa905b4/79/page-frame.html\r\n";
const otherMiniGameHeader = targetHeader.replace(
  "wx6f959f42eaa905b4",
  "wx0000000000000000"
);

rewriteLines.forEach((line, index) => {
  const marker = " url-and-header ";
  const markerIndex = line.indexOf(marker);
  const matchers = line.slice(0, markerIndex);
  const separatorIndex = matchers.indexOf(" ");
  const urlPattern = matchers.slice(0, separatorIndex);
  const headerPattern = matchers.slice(separatorIndex + 1);
  const action = line.slice(markerIndex + marker.length);

  assert(new RegExp(urlPattern).test(targets[index]));
  assert(new RegExp(headerPattern).test(targetHeader));
  assert(!new RegExp(headerPattern).test(otherMiniGameHeader));
  assert(["reject-dict", "reject-200"].includes(action));
});

assert(
  snippetText.includes(
    "hostname = %APPEND% api.gravity-engine.com, api.datanexus.qq.com, report-online.sh.wxgateway.com"
  )
);

console.log("PASS WeChat mini-game ad telemetry rules");
