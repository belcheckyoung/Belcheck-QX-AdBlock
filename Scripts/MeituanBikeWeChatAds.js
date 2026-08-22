/*
 * Quantumult X - Meituan Bike WeChat Ads
 * Capture-derived response filter, 2026-08-22.
 *
 * Removes WeChat-native ads and non-MOBIKE Hermes ad-strategy entries from two
 * Meituan Bike APIs. Normal riding data and MOBIKE-operated content are
 * preserved. All failures are fail-open: the original response is returned
 * unchanged.
 */

var TAG = "[MTBikeAdClean]";
var body = typeof $response !== "undefined" && typeof $response.body === "string"
  ? $response.body
  : "";
var url = typeof $request !== "undefined" && typeof $request.url === "string"
  ? $request.url
  : "";

var HOME_RE = /^https?:\/\/bike\.meituan\.com\/api\/v3\/recommend\/home\/v3(?:\?|$)/i;
var HERMES_RE = /^https?:\/\/bike\.meituan\.com\/api\/ads-hermes\/resourceList(?:\?|$)/i;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function upper(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function isHomeWechatAd(item) {
  if (!isObject(item)) return false;
  var slotId = typeof item.slotId === "string" ? item.slotId.trim() : "";
  return upper(item.source) === "TENG_XUN_WEI_XIN" || /^adunit-/i.test(slotId);
}

function cleanHome(root) {
  var data = isObject(root) && isObject(root.data) ? root.data : null;
  if (!data || !Object.prototype.hasOwnProperty.call(data, "adsHomeBannerAd")) return 0;

  var value = data.adsHomeBannerAd;
  if (Array.isArray(value)) {
    var kept = value.filter(function (item) {
      return !isHomeWechatAd(item);
    });
    var removed = value.length - kept.length;
    if (removed > 0) data.adsHomeBannerAd = kept;
    return removed;
  }

  if (isHomeWechatAd(value)) {
    data.adsHomeBannerAd = [];
    return 1;
  }
  return 0;
}

function isHermesWechatAd(item) {
  if (!isObject(item)) return false;

  var source = upper(item.source);
  if (source === "MOBIKE") return false;

  var strategy = upper(item.strategyType);
  var slotId = typeof item.slotId === "string" ? item.slotId.trim() : "";
  var name = typeof item.name === "string" ? item.name : "";
  var docName = isObject(item.recordInfo) && typeof item.recordInfo.docName === "string"
    ? item.recordInfo.docName
    : "";
  var wechatText = source + " " + name + " " + docName;

  return source === "TENG_XUN_WEI_XIN" ||
    strategy === "ADS_STRATEGY" ||
    (/^adunit-/i.test(slotId) && /(微信|WEI[ _-]?XIN|TENG[ _-]?XUN)/i.test(wechatText));
}

function cleanHermesInfos(root) {
  var removed = 0;
  var stack = [root];

  while (stack.length > 0) {
    var node = stack.pop();

    if (Array.isArray(node)) {
      node.forEach(function (value) {
        if (value && typeof value === "object") stack.push(value);
      });
      continue;
    }
    if (!isObject(node)) continue;

    Object.keys(node).forEach(function (key) {
      var value = node[key];
      if (key === "infos" && Array.isArray(value)) {
        var kept = value.filter(function (item) {
          return !isHermesWechatAd(item);
        });
        removed += value.length - kept.length;
        node[key] = kept;
        kept.forEach(function (item) {
          if (item && typeof item === "object") stack.push(item);
        });
      } else if (value && typeof value === "object") {
        stack.push(value);
      }
    });
  }
  return removed;
}

try {
  var isHome = HOME_RE.test(url);
  var isHermes = HERMES_RE.test(url);

  if (!body || (!isHome && !isHermes)) {
    $done({});
  } else {
    var json = JSON.parse(body);
    var route = isHome ? "home" : "hermes";
    var removed = isHome ? cleanHome(json) : cleanHermesInfos(json);

    if (removed > 0) {
      console.log(TAG + " " + route + " removed=" + removed);
      $done({ body: JSON.stringify(json) });
    } else {
      $done({});
    }
  }
} catch (_) {
  console.log(TAG + " fail-open");
  $done({});
}
