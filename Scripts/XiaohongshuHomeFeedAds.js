/*
 * Quantumult X - Xiaohongshu Home Feed Ads
 * Capture-derived response filter, 2026-08-22.
 *
 * Removes only direct children of the homefeed data array that carry explicit
 * ad markers. Notes, live cards, pagination fields and all unrelated responses
 * are preserved. All failures are fail-open.
 */

var TAG = "[XHSHomeFeedAdClean]";
var body = typeof $response !== "undefined" && typeof $response.body === "string"
  ? $response.body
  : "";
var url = typeof $request !== "undefined" && typeof $request.url === "string"
  ? $request.url
  : "";

var HOME_FEED_RE = /^https?:\/\/rec\.xiaohongshu\.com\/api\/sns\/v6\/homefeed(?:\?|$)/i;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function lower(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isHomeFeedAd(item) {
  if (!isObject(item)) return false;
  if (item.is_ads === true) return true;
  if (lower(item.model_type) === "advertisement") return true;

  var info = item.ads_info;
  return isObject(info) && (
    Object.prototype.hasOwnProperty.call(info, "ads_id") ||
    Object.prototype.hasOwnProperty.call(info, "ads_type")
  );
}

function cleanHomeFeed(root) {
  if (!isObject(root) || !Array.isArray(root.data)) return 0;

  var kept = root.data.filter(function (item) {
    return !isHomeFeedAd(item);
  });
  var removed = root.data.length - kept.length;
  if (removed > 0) root.data = kept;
  return removed;
}

try {
  if (!body || !HOME_FEED_RE.test(url)) {
    $done({});
  } else {
    var json = JSON.parse(body);
    var removed = cleanHomeFeed(json);

    if (removed > 0) {
      console.log(TAG + " removed=" + removed);
      $done({ body: JSON.stringify(json) });
    } else {
      $done({});
    }
  }
} catch (_) {
  console.log(TAG + " fail-open");
  $done({});
}
