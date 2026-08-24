#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

python3 - <<'PY'
import os
import re
import stat
import subprocess
import sys

allowed = {
    ".github/workflows/test.yml",
    ".gitignore",
    "CHANGELOG.md",
    "Filters/WeChatMiniProgramAds.list",
    "README.md",
    "Rewrite/MeituanAppAdMedia.snippet",
    "Rewrite/MeituanBikeWeChatAds.snippet",
    "Rewrite/XiaohongshuHomeFeedAds.snippet",
    "SECURITY.md",
    "Scripts/MeituanBikeWeChatAds.js",
    "Scripts/XiaohongshuHomeFeedAds.js",
    "Tests/MeituanAppAdMedia.test.js",
    "Tests/MeituanBikeWeChatAds.test.js",
    "Tests/XiaohongshuHomeFeedAds.test.js",
    "Tests/fixtures/README.md",
    "Tests/fixtures/hermes.json",
    "Tests/fixtures/home.json",
    "Tests/fixtures/settle.json",
    "Tests/fixtures/xiaohongshu-homefeed.json",
    "Tests/run.js",
    "package.json",
    "Tools/secret-scan.sh",
}

# Reachable experiment branches may contain these separately reviewed files
# even though the stable main branch does not publish them. They remain fully
# content-scanned below and are not allowed into the current working tree.
history_only_allowed = {
    "Rewrite/TencentVideoHTTPAnalyzerCompat.snippet",
    "Scripts/TencentVideoHTTPAnalyzerCompat.js",
    "Tests/TencentVideoHTTPAnalyzerCompat.test.js",
}

tracked = set(subprocess.check_output(["git", "ls-files"], text=True).splitlines())
unexpected = sorted(tracked - allowed)
missing = sorted(allowed - tracked)
if unexpected or missing:
    for name in unexpected:
        print(f"allowlist-extra: {name}")
    for name in missing:
        print(f"allowlist-missing: {name}")
    sys.exit(1)

for name in sorted(tracked):
    mode = os.lstat(name).st_mode
    if stat.S_ISLNK(mode):
        print(f"symlink: {name}")
        sys.exit(1)
    if os.path.getsize(name) > 262144:
        print(f"oversized: {name}")
        sys.exit(1)
    if b"\x00" in open(name, "rb").read(4096):
        print(f"binary: {name}")
        sys.exit(1)

patterns = [
    ("qx-node-line", re.compile(r"^\s*(?:http|https|shadowsocks|vmess|vless|trojan|socks5(?:-tls)?|hysteria2?|tuic|anytls|wireguard)\s*=", re.I)),
    ("proxy-uri", re.compile(r"\b(?:ss|ssr|vmess|vless|trojan|socks5|hysteria2?|tuic|anytls|wireguard)://\S+", re.I)),
    ("qx-mitm-p12", re.compile(r"^\s*p12\s*=\s*\S+", re.I)),
    ("qx-mitm-passphrase", re.compile(r"^\s*passphrase\s*=\s*\S+", re.I)),
    ("pem-private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("generic-secret", re.compile(r"\b(?:password|passwd|access[_-]?token|api[_-]?key|client[_-]?secret|private[_-]?key|authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*\S+", re.I)),
    ("subscription-query", re.compile(r"https?://\S*[?&](?:token|auth|key|uuid|sid|session|subscribe|subscription)=\S+", re.I)),
    ("uuid-like", re.compile(r"\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b", re.I)),
    ("long-base64", re.compile(r"^[A-Za-z0-9+/]{300,}={0,2}$")),
    ("capture-auth-header", re.compile(r"^(?:Authorization|Proxy-Authorization|Cookie|Set-Cookie):", re.I)),
    ("capture-pii", re.compile(r"\b(?:latitude|longitude|locationTime|accuracy|openid|unionid|session[_-]?key|wxa_session|order[_-]?id|device[_-]?id)\b", re.I)),
]

skip_content_scan = {"Tools/secret-scan.sh"}
findings = set()


def scan_text(name, text, origin):
    qx_server_section = None
    for number, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        section = re.match(r"^\[([A-Za-z0-9_-]+)\]$", stripped)
        if section:
            current = section.group(1).lower()
            qx_server_section = current if current in {"server_local", "server_remote"} else None
        elif (
            qx_server_section
            and stripped
            and not stripped.startswith(("#", ";", "//", "```"))
        ):
            findings.add(("qx-active-server-section", origin, name, number))

        for rule_id, pattern in patterns:
            if pattern.search(line):
                findings.add((rule_id, origin, name, number))


for name in sorted(tracked - skip_content_scan):
    text = open(name, "r", encoding="utf-8").read()
    scan_text(name, text, "working-tree")

# Scan every reachable Git blob as well as the working tree. This prevents a
# later deletion from hiding a secret that remains downloadable from history.
seen_blobs = set()
commits = subprocess.check_output(["git", "rev-list", "--all"], text=True).splitlines()
for commit in commits:
    entries = subprocess.check_output(["git", "ls-tree", "-r", "-z", commit])
    for raw_entry in entries.split(b"\0"):
        if not raw_entry:
            continue
        metadata, raw_name = raw_entry.split(b"\t", 1)
        mode, object_type, object_id = metadata.decode("ascii").split()
        name = raw_name.decode("utf-8", errors="replace")

        if name not in allowed | history_only_allowed:
            print(f"history-allowlist-extra: object={object_id[:12]} [REDACTED]")
            sys.exit(1)
        if object_type != "blob" or mode == "120000":
            print(f"history-unsafe-object: {name} object={object_id[:12]}")
            sys.exit(1)
        if object_id in seen_blobs:
            continue
        seen_blobs.add(object_id)

        data = subprocess.check_output(["git", "cat-file", "blob", object_id])
        if len(data) > 262144:
            print(f"history-oversized: {name} object={object_id[:12]}")
            sys.exit(1)
        if b"\x00" in data[:4096]:
            print(f"history-binary: {name} object={object_id[:12]}")
            sys.exit(1)
        if name not in skip_content_scan:
            scan_text(
                name,
                data.decode("utf-8", errors="replace"),
                f"history-{object_id[:12]}",
            )

if findings:
    for rule_id, origin, name, number in sorted(findings):
        print(f"{rule_id}: {origin}:{name}:{number} [REDACTED]")
    sys.exit(1)

print(
    f"PASS secret-scan tracked={len(tracked)} "
    f"commits={len(commits)} historical_blobs={len(seen_blobs)}"
)
PY
