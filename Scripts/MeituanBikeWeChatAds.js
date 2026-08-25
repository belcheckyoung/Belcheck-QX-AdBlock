/*
 * Quantumult X - Meituan Bike WeChat Ads
 * Capture-derived response filter, updated 2026-08-25.
 *
 * Removes WeChat-native ads and non-MOBIKE Hermes ad-strategy entries from
 * three exact Meituan Bike APIs, including nested ad groups and empty ad shells
 * on the settlement page. Normal riding data and MOBIKE-operated content are
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
var SETTLE_RE = /^https?:\/\/bike\.meituan\.com\/api\/v3\/recommend\/settle\/v2(?:\?|$)/i;

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

function cleanInfosArray(value) {
  var cleaned = [];
  var removed = 0;

  value.forEach(function (item) {
    if (isHermesWechatAd(item)) {
      removed += 1;
      return;
    }

    if (Array.isArray(item)) {
      var nested = cleanInfosArray(item);
      removed += nested.removed;
      if (nested.value.length > 0) cleaned.push(nested.value);
      return;
    }

    cleaned.push(item);
  });

  return { value: cleaned, removed: removed };
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
        var result = cleanInfosArray(value);
        removed += result.removed;
        if (result.removed > 0) node[key] = result.value;
        var next = result.removed > 0 ? result.value : value;
        next.forEach(function (item) {
          if (item && typeof item === "object") stack.push(item);
        });
      } else if (value && typeof value === "object") {
        stack.push(value);
      }
    });
  }
  return removed;
}

function hasInfosContent(value) {
  if (Array.isArray(value)) {
    return value.some(function (item) {
      return hasInfosContent(item);
    });
  }
  return value !== null && typeof value !== "undefined";
}

function cleanSettle(root) {
  var data = isObject(root) && isObject(root.data) ? root.data : null;
  if (!data || !Array.isArray(data.adsResource)) return 0;

  var removed = cleanHermesInfos(data.adsResource);
  if (removed > 0) {
    data.adsResource = data.adsResource.filter(function (resource) {
      if (!isObject(resource) || !Array.isArray(resource.infos)) return true;
      return hasInfosContent(resource.infos);
    });
  }
  return removed;
}

try {
  var isHome = HOME_RE.test(url);
  var isHermes = HERMES_RE.test(url);
  var isSettle = SETTLE_RE.test(url);

  if (!body || (!isHome && !isHermes && !isSettle)) {
    $done({});
  } else {
    var json = JSON.parse(body);
    var route = isHome ? "home" : (isHermes ? "hermes" : "settle");
    var removed = isHome
      ? cleanHome(json)
      : (isHermes ? cleanHermesInfos(json) : cleanSettle(json));

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
