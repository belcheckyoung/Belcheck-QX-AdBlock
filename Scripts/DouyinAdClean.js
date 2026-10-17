/*
 * Quantumult X - Douyin Feed Ads
 * Static-analysis candidate; no captured response or device validation.
 *
 * Only removes direct children of the top-level aweme_list array with an
 * explicit is_ads boolean true or a number exactly equal to 1. Remaining
 * entries, live cards, download/watermark fields and pagination retain their
 * original JSON text, including unquoted 64-bit identifiers.
 * Unknown structures, duplicate target keys and all failures are fail-open.
 */

var TAG = "[DouyinAdClean]";
var body = typeof $response !== "undefined" && $response && typeof $response.body === "string"
  ? $response.body
  : "";
var url = typeof $request !== "undefined" && $request && typeof $request.url === "string"
  ? $request.url
  : "";

var FEED_RE = /^https?:\/\/(?:api3-core-c\.amemv\.com|api3-normal-c\.amemv\.com|api\.amemv\.com|aweme\.snssdk\.com)\/aweme\/v[12]\/feed\/?(?:\?[^#]*)?$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function whitespace(index) {
  while (index < body.length && /\s/.test(body[index])) index++;
  return index;
}

function stringEnd(index) {
  for (index++; index < body.length; index++) {
    if (body[index] === "\\") index++;
    else if (body[index] === '"') return index + 1;
  }
  throw new Error("Unterminated string");
}

function valueEnd(index) {
  if (body[index] === '"') return stringEnd(index);
  if (body[index] !== "{" && body[index] !== "[") {
    while (index < body.length && !/[\s,}\]]/.test(body[index])) index++;
    return index;
  }
  var depth = 0;
  for (; index < body.length; index++) {
    var character = body[index];
    if (character === '"') index = stringEnd(index) - 1;
    else if (character === "{" || character === "[") depth++;
    else if ((character === "}" || character === "]") && --depth === 0) return index + 1;
  }
  throw new Error("Unterminated value");
}

// Call only after JSON.parse has validated the complete response. A duplicate
// target key is ambiguous, so do not use either occurrence for filtering.
function uniqueProperty(objectStart, name) {
  var found = null;
  var index = whitespace(objectStart + 1);
  while (body[index] !== "}") {
    var keyEnd = stringEnd(index);
    var key = JSON.parse(body.slice(index, keyEnd));
    index = whitespace(whitespace(keyEnd) + 1);
    var end = valueEnd(index);
    if (key === name) {
      if (found) return null;
      found = { start: index, end: end };
    }
    index = whitespace(end);
    if (body[index] === "}") break;
    index = whitespace(index + 1);
  }
  return found;
}

// Check the raw decimal token rather than a rounded JSON.parse number. This
// accepts exact forms such as 1, 1.0 and 10e-1, but never a near-one decimal.
function isExactOne(token) {
  var match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  if (!match) return false;
  var fraction = match[2] || "";
  var digits = match[1] + fraction;
  var noTrailingZeros = digits.replace(/0+$/, "");
  if (noTrailingZeros.replace(/^0+/, "") !== "1") return false;
  var exponent = Number(match[3] || 0);
  return Number.isSafeInteger(exponent) &&
    exponent - fraction.length + digits.length - noTrailingZeros.length === 0;
}

function isFeedAd(entry) {
  if (body[entry.valueStart] !== "{") return false;
  var marker = uniqueProperty(entry.valueStart, "is_ads");
  if (!marker) return false;
  var token = body.slice(marker.start, marker.end);
  return token === "true" || isExactOne(token);
}

function cleanFeed() {
  if (!body || !FEED_RE.test(url)) return {};
  if (typeof $response.statusCode !== "undefined") {
    var statusCode = Number($response.statusCode);
    if (!Number.isInteger(statusCode) || statusCode < 200 || statusCode >= 300) return {};
  }
  // Parsing validates syntax and root type only. Parsed numeric values are never
  // used to reconstruct the response or to decide whether an item is an ad.
  if (!isObject(JSON.parse(body))) return {};
  var list = uniqueProperty(whitespace(0), "aweme_list");
  if (!list || body[list.start] !== "[") return {};

  var entries = [];
  var index = list.start + 1;
  while (whitespace(index) < list.end - 1) {
    var entryStart = index;
    var start = whitespace(index);
    var end = valueEnd(start);
    index = whitespace(end);
    entries.push({ start: entryStart, end: index, valueStart: start });
    if (body[index] === "]") break;
    index++;
  }

  var kept = [];
  entries.forEach(function (entry) {
    if (!isFeedAd(entry)) kept.push(body.slice(entry.start, entry.end));
  });
  var removed = entries.length - kept.length;
  if (!removed) return {};
  console.log(TAG + " removed=" + removed);
  return { body: body.slice(0, list.start + 1) + kept.join(",") + body.slice(list.end - 1) };
}

var result = {};
try {
  result = cleanFeed();
} catch (_) {
  console.log(TAG + " fail-open");
}
$done(result);
