const assert = require("assert");
const fs = require("fs");
const path = require("path");

const configPath = path.join(
  __dirname,
  "..",
  "Config",
  "Belcheck-QX-Public.conf"
);
const config = fs.readFileSync(configPath, "utf8");
const lines = config.split(/\r?\n/);

const requiredSections = [
  "general",
  "task_local",
  "rewrite_local",
  "rewrite_remote",
  "server_local",
  "server_remote",
  "dns",
  "policy",
  "filter_local",
  "filter_remote",
  "http_backend",
  "mitm",
];

for (const section of requiredSections) {
  const matches = lines.filter(
    (line) => line.trim().toLowerCase() === `[${section}]`
  );
  assert.strictEqual(matches.length, 1, `[${section}] must appear exactly once`);
}

let section = "";
const activeServerLines = [];
for (const [index, line] of lines.entries()) {
  const trimmed = line.trim();
  const match = trimmed.match(/^\[([A-Za-z0-9_-]+)\]$/);
  if (match) {
    section = match[1].toLowerCase();
    continue;
  }
  if (
    (section === "server_local" || section === "server_remote") &&
    trimmed &&
    !trimmed.startsWith("#") &&
    !trimmed.startsWith(";") &&
    !trimmed.startsWith("//")
  ) {
    activeServerLines.push(index + 1);
  }
}
assert.deepStrictEqual(activeServerLines, [], "public server sections must be empty");

const forbidden = [
  [/^\s*(?:http|https|shadowsocks|vmess|vless|trojan|socks5|wireguard)\s*=/im, "proxy node"],
  [/\b(?:ss|ssr|vmess|vless|trojan|socks5|wireguard):\/\/\S+/i, "proxy URI"],
  [/^\s*(?:p12|passphrase)\s*=/im, "CA material"],
  [/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/i, "UUID-like credential"],
  [/https?:\/\/\S*[?&](?:token|auth|key|uuid|sid|session|subscribe|subscription)=\S+/i, "credentialed URL"],
  [/^\s*[A-Za-z0-9+/]{300,}={0,2}\s*$/m, "long encoded blob"],
];
for (const [pattern, label] of forbidden) {
  assert.ok(!pattern.test(config), `public config must not contain ${label}`);
}

assert.ok(!/^url-latency-benchmark=/m.test(config));
assert.ok(!/(?:^|,)\s*proxy\s*(?:,|$)/im.test(config));
assert.ok(!config.includes("自动选择"));
assert.ok(
  config.includes("static=国外流量, direct"),
  "foreign traffic must safely fall back to direct"
);

assert.ok(config.includes("tag=Spotify音乐VIP"));
assert.ok(config.includes("tag=墨鱼专属VIP"));
assert.ok(config.includes("tag=去广告, force-policy=广告拦截"));
assert.ok(config.includes("[mitm]"));
assert.ok(config.includes("hostname=api.weibo.cn"));

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
  if (trimmed.startsWith("http")) {
    assert.ok(trimmed.startsWith("https://"), "remote resources must use HTTPS");
  }
}

console.log(
  "PASS public-config sections direct-fallback membership-preserved secret-free"
);
