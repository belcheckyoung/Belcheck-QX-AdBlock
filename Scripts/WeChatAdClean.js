/*
 * Quantumult X - WeChat article ad response compatibility module, v1.0.0.
 * Interface/field reference: Choler / NobyDa Wechat.js:
 * https://github.com/NobyDa/Script/blob/master/QuantumultX/File/Wechat.js
 * Independently implemented validation and lossless edits; appid is preserved.
 * Upstream-schema compatibility and synthetic tests only, not device validation.
 */

var ARTICLE_AD_RE = /^https?:\/\/[mM][pP]\.[wW][eE][iI][xX][iI][nN]\.[qQ][qQ]\.[cC][oO][mM]\/mp\/getappmsgad(?:\?[^#]*)?$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function owns(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function skipSpace(text, index) {
  while (index < text.length && /[\x20\t\r\n]/.test(text.charAt(index))) index++;
  return index;
}

// JSON.parse validates first. Locate tokens without reserializing unrelated
// numbers, escaped strings, whitespace, or nested objects.
function stringEnd(text, index) {
  for (var i = index + 1; i < text.length; i++) {
    if (text.charAt(i) === "\\") i++;
    else if (text.charAt(i) === '"') return i + 1;
  }
  throw new Error("Unterminated string");
}

function valueEnd(text, index) {
  var first = text.charAt(index);
  if (first === '"') return stringEnd(text, index);
  if (first === "{" || first === "[") {
    var depth = 0;
    for (var i = index; i < text.length; i++) {
      var character = text.charAt(i);
      if (character === '"') i = stringEnd(text, i) - 1;
      else if (character === "{" || character === "[") depth++;
      else if (character === "}" || character === "]") {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
    throw new Error("Unterminated container");
  }
  var end = index;
  while (end < text.length && !/[,}\x20\t\r\n]/.test(text.charAt(end))) end++;
  return end;
}

function rootRanges(text) {
  var index = skipSpace(text, 0);
  if (text.charAt(index++) !== "{") return null;
  var seen = Object.create(null);
  var ranges = Object.create(null);
  index = skipSpace(text, index);
  while (text.charAt(index) !== "}") {
    if (text.charAt(index) !== '"') return null;
    var keyEnd = stringEnd(text, index);
    var key = JSON.parse(text.slice(index, keyEnd));
    if (owns(seen, key)) return null;
    seen[key] = true;
    index = skipSpace(text, keyEnd);
    if (text.charAt(index++) !== ":") return null;
    var start = skipSpace(text, index);
    var end = valueEnd(text, start);
    if (key === "advertisement_num" || key === "advertisement_info") {
      ranges[key] = { start: start, end: end };
    }
    index = skipSpace(text, end);
    if (text.charAt(index) === "}") break;
    if (text.charAt(index++) !== ",") return null;
    index = skipSpace(text, index);
  }
  return ranges;
}

function rewriteArticleAds() {
  if (typeof $request === "undefined" || typeof $response === "undefined") return {};
  var url = $request.url;
  var body = $response.body;
  if (typeof url !== "string" || !ARTICLE_AD_RE.test(url)) return {};
  if (typeof body !== "string" || !body) return {};
  if (typeof $response.statusCode !== "undefined" && (
    typeof $response.statusCode !== "number" ||
    !isFinite($response.statusCode) ||
    Math.floor($response.statusCode) !== $response.statusCode ||
    $response.statusCode < 200 || $response.statusCode >= 300
  )) return {};

  var root = JSON.parse(body);
  if (!isObject(root)) return {};
  if (owns(root, "ret") && root.ret !== 0) return {};
  if (owns(root, "base_resp") && (
    !isObject(root.base_resp) || !owns(root.base_resp, "ret") || root.base_resp.ret !== 0
  )) return {};
  if (!owns(root, "advertisement_num") || !owns(root, "advertisement_info")) return {};
  var count = root.advertisement_num;
  if (typeof count !== "number" || !isFinite(count) || count < 0 ||
    Math.floor(count) !== count || count > 9007199254740991 ||
    !Array.isArray(root.advertisement_info)) return {};
  if (count === 0 && root.advertisement_info.length === 0) return {};

  var ranges = rootRanges(body);
  if (!ranges || !ranges.advertisement_num || !ranges.advertisement_info) return {};
  var edits = [
    { range: ranges.advertisement_num, replacement: "0" },
    { range: ranges.advertisement_info, replacement: "[]" },
  ];
  edits.sort(function (a, b) { return b.range.start - a.range.start; });
  var result = body;
  edits.forEach(function (edit) {
    result = result.slice(0, edit.range.start) + edit.replacement + result.slice(edit.range.end);
  });
  return { body: result };
}

var result = {};
try {
  result = rewriteArticleAds();
} catch (_) {
  // Unknown, compressed, malformed, or changed responses remain untouched.
}
$done(result);
