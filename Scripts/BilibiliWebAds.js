/*
 * Quantumult X - Bilibili Web Ads
 * Capture-derived response filter, 2026-08-24.
 *
 * The homepage recommendation API is cleaned at the object level. The root
 * homepage also receives a small browser-side cleaner because its first feed
 * and carousel are server-rendered before the JSON recommendation request.
 * All unknown structures and failures are passed through unchanged.
 */

var TAG = "[BilibiliWebAdClean]";
var body = typeof $response !== "undefined" && typeof $response.body === "string"
  ? $response.body
  : "";
var url = typeof $request !== "undefined" && typeof $request.url === "string"
  ? $request.url
  : "";

var HOME_RE = /^https?:\/\/www\.bilibili\.com\/(?:\?.*)?$/i;
var FEED_RE = /^https?:\/\/api\.bilibili\.com\/x\/web-interface\/wbi\/index\/top\/feed\/rcmd(?:\?|$)/i;
var INJECT_MARKER = 'id="belcheck-qx-bilibili-web-adblock"';

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasObjectFields(value) {
  return isObject(value) && Object.keys(value).length > 0;
}

function isAdItem(item) {
  if (!isObject(item)) return false;
  if (typeof item.goto === "string" && item.goto.toLowerCase() === "ad") return true;
  if (item.is_ad === true || item.isAd === true || item.is_ad_loc === true) return true;
  return hasObjectFields(item.business_info) || hasObjectFields(item.businessInfo);
}

function cleanFeed(root) {
  if (!isObject(root) || !isObject(root.data) || !Array.isArray(root.data.item)) {
    return 0;
  }

  var kept = root.data.item.filter(function (item) {
    return !isAdItem(item);
  });
  var removed = root.data.item.length - kept.length;
  if (removed > 0) root.data.item = kept;
  return removed;
}

var BROWSER_CLEANER = '<script id="belcheck-qx-bilibili-web-adblock">(function(){' +
  'var p=window.__pinia||{},tokens=[];' +
  'function obj(v){return v!==null&&typeof v==="object"&&!Array.isArray(v)}' +
  'function fields(v){return obj(v)&&Object.keys(v).length>0}' +
  'function ad(v){return obj(v)&&((typeof v.goto==="string"&&v.goto.toLowerCase()==="ad")||v.is_ad===true||v.isAd===true||v.is_ad_loc===true||fields(v.business_info)||fields(v.businessInfo))}' +
  'function token(v){if(v===null||typeof v==="undefined")return;var s=String(v);if(!s||s==="0")return;if(/^BV[0-9A-Za-z]+$/.test(s)||s.length>8)tokens.push(s);var m=s.match(/BV[0-9A-Za-z]+/);if(m)tokens.push(m[0]);var i=s.indexOf("/bfs/");if(i>=0)tokens.push(s.slice(i).split("?")[0])}' +
  'function remember(v){if(!obj(v))return;token(v.bvid);token(v.aid);token(v.id);token(v.url);token(v.uri);token(v.pic);token(v.cover)}' +
  'function clean(a){if(!Array.isArray(a))return a;return a.filter(function(v){if(ad(v)){remember(v);return false}return true})}' +
  'try{' +
    'if(p.feed&&p.feed.data){' +
      'if(p.feed.data.head){p.feed.data.head.recommend=clean(p.feed.data.head.recommend);p.feed.data.head.banner_card=clean(p.feed.data.head.banner_card)}' +
      'p.feed.data.banner_card=clean(p.feed.data.banner_card);' +
      'if(p.feed.data.recommend){p.feed.data.recommend.item=clean(p.feed.data.recommend.item)}' +
    '}' +
    'if(p.carousel)p.carousel.recommendedSwipe=clean(p.carousel.recommendedSwipe)' +
  '}catch(_){return}' +
  'function values(el){var out="",nodes=el.querySelectorAll("a[href],img[src],source[srcset]");for(var i=0;i<nodes.length;i++){out+=" "+(nodes[i].getAttribute("href")||"")+" "+(nodes[i].getAttribute("src")||"")+" "+(nodes[i].getAttribute("srcset")||"")}return out}' +
  'function hit(el){if(el.querySelector(".bili-video-card__info--ad,[data-is-ad=\\"true\\"]"))return true;var text=values(el);for(var i=0;i<tokens.length;i++){if(text.indexOf(tokens[i])>=0)return true}return false}' +
  'function remove(el){if(typeof el.remove==="function")el.remove();else if(el.parentNode)el.parentNode.removeChild(el)}' +
  'function sweep(){var nodes=document.querySelectorAll(".feed-card,.vui_carousel__slide");for(var i=0;i<nodes.length;i++){if(hit(nodes[i]))remove(nodes[i])}}' +
  'sweep();if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sweep,{once:true});' +
  'if(typeof MutationObserver!=="undefined"&&document.documentElement)new MutationObserver(sweep).observe(document.documentElement,{childList:true,subtree:true});' +
'})();</script>';

function injectHomepage(html) {
  if (html.indexOf(INJECT_MARKER) >= 0) return "";
  var position = html.lastIndexOf("</body>");
  if (position < 0) position = html.lastIndexOf("</html>");
  if (position < 0) return "";
  return html.slice(0, position) + BROWSER_CLEANER + html.slice(position);
}

try {
  if (!body) {
    $done({});
  } else if (FEED_RE.test(url)) {
    var json = JSON.parse(body);
    var removed = cleanFeed(json);
    if (removed > 0) {
      console.log(TAG + " removed=" + removed);
      $done({ body: JSON.stringify(json) });
    } else {
      $done({});
    }
  } else if (HOME_RE.test(url)) {
    var html = injectHomepage(body);
    if (html) {
      console.log(TAG + " homepage-cleaner=installed");
      $done({ body: html });
    } else {
      $done({});
    }
  } else {
    $done({});
  }
} catch (_) {
  console.log(TAG + " fail-open");
  $done({});
}
