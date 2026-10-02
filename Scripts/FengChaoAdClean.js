/* Fengchao mini-program ad cleanup. No account data or captured payloads. */
(function () {
  'use strict';
  const DEFAULTS = {
    hideMemberNavigation: true,
    hideMemberPromotion: true,
    disableAdFallback: true
  };
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  function endpoint(url) {
    if (typeof url !== 'string') return null;
    const match = /^https?:\/\/([^/?#]+)(\/[^?#]*)(?:[?#]|$)/i.exec(url);
    if (!match) return null;
    const host = match[1].toLowerCase();
    const path = match[2];
    if (host === 'dsp.fcbox.com' && /^\/adSearch\/(?:get|getMulti)\/?$/.test(path)) return 'dsp';
    if (host !== 'webchatapp.fcbox.com') return null;
    const routes = {
      '/commerce/mobile/appConfig/getPositions': 'positions',
      '/fcboxactivityweb/api/v2/clientPage/getUserClientPageInfo': 'navigation',
      '/post/suggestion/query': 'promotion'
    };
    return routes[path.replace(/\/$/, '')] || null;
  }

  function requestHeaders(url, headers) {
    if (!endpoint(url) || !object(headers)) return null;
    const result = {};
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() !== 'accept-encoding') result[key] = headers[key];
    }
    result['Accept-Encoding'] = 'gzip, deflate';
    return result;
  }

  function clean(url, body, options) {
    const result = {changed: false, body, removed: []};
    const api = endpoint(url);
    if (!api || typeof body !== 'string') return result;
    let root;
    try { root = JSON.parse(body); } catch (_) { return result; }
    if (!object(root) || root.success === false) return result;
    const expectedCode = {dsp: '370100000', positions: '200100000', navigation: '0', promotion: '030100000'};
    if (String(root.code) !== expectedCode[api]) return result;
    if (api !== 'dsp' && root.success !== true) return result;
    const opt = Object.assign({}, DEFAULTS, options || {});
    const note = reason => result.removed.push(reason);

    if (api === 'dsp') {
      // Both single and multi-slot APIs returned data:null naturally in the capture.
      if (!own(root, 'data') || !(root.data === null || object(root.data) || Array.isArray(root.data))) return result;
      if (root.data !== null) { root.data = null; note('dsp-creatives'); }
      if (own(root, 'extendsData') && root.extendsData !== null) {
        root.extendsData = null; note('dsp-extensions');
      }
      if (opt.disableAdFallback && object(root.extendsMap)) {
        // These flags were strings in the capture. Their frontend effects need device verification.
        for (const key of ['wxAdsFlag', 'fcDspFlag', 'interstitialErrSwitch']) {
          const value = root.extendsMap[key];
          if (value === 'true') { root.extendsMap[key] = 'false'; note('flag:' + key); }
          else if (value === true) { root.extendsMap[key] = false; note('flag:' + key); }
        }
      }
    } else if (api === 'positions') {
      if (!Array.isArray(root.data)) return result;
      const filtered = root.data.filter(item => {
        if (!object(item)) return true;
        const ad = item.configKey === 'wechatMiniAppOrderListPageThird' ||
          (typeof item.adPosition === 'string' && /^adunit-[a-z0-9]+$/i.test(item.adPosition));
        if (ad) note('programmatic-position');
        return !ad;
      });
      if (filtered.length !== root.data.length) root.data = filtered;
    } else if (api === 'navigation' && opt.hideMemberNavigation) {
      if (!object(root.data) || typeof root.data.homePageConfig !== 'string') return result;
      let config;
      try { config = JSON.parse(root.data.homePageConfig); } catch (_) { return result; }
      if (!object(config) || !object(config.bottomNavigation)) return result;
      const nav = config.bottomNavigation;
      if (nav.tabText !== '会员直降' || typeof nav.link !== 'string' ||
          !/^\/uniDoraPick\/pages\/vip-center\/vip(?:[?#]|$)/.test(nav.link)) return result;
      if (nav.showMiddleTab === true) {
        nav.showMiddleTab = false;
        root.data.homePageConfig = JSON.stringify(config);
        note('membership-navigation');
      }
    } else if (api === 'promotion' && opt.hideMemberPromotion) {
      if (!object(root.data) || !object(root.data.top)) return result;
      const top = root.data.top;
      if (top.recommendFunctionCode === 'memberCentre' &&
          typeof top.activityName === 'string' && top.activityName.indexOf('会员') !== -1) {
        // Remove the complete promotion slot, including its half-screen purchase control.
        // The slot's overdue-package visibility metadata disappears too; verify overdue picking.
        root.data.top = null;
        note('membership-promotion-container');
      }
    }
    if (result.removed.length) {
      result.changed = true;
      result.body = JSON.stringify(root);
    }
    return result;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {clean, requestHeaders, endpoint};
  if (typeof $done === 'function') {
    let output = {};
    try {
      if (typeof $request !== 'undefined') {
        if (typeof $response === 'undefined') {
          const headers = requestHeaders($request.url, $request.headers);
          if (headers) output = {headers};
        } else {
          const result = clean($request.url, $response.body);
          if (result.changed) output = {body: result.body};
        }
      }
    } catch (_) { output = {}; }
    $done(output);
  }
})();
