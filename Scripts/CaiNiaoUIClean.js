/* Belcheck CaiNiao cleanup v0.2.0 — 2026-09-11
 * Based on the user's 2026-09-11-202622 capture, app 8.11.805.
 * Capture replay passed separately; device UI remains to be validated.
 * Earlier endpoint hints: https://github.com/ddgksf2013/Scripts/blob/master/cainiao_json.js
 * No network calls, account logging, rewards changes, or blanket CDN blocking.
 */
(function () {
  'use strict';
  const OPTIONS = {
    hideMiddleBottomTabs: true, // 发现 / 中间推广位（本次是寄件券）/ 消息
    hideHomeShortcuts: true,   // 整组快捷入口及新人推广，不影响搜索/添加包裹数据
    hideMineCards: true,       // 会员/资产/钱包/活动/三卡片整个模块
    hideHomePromotion: true    // 首页商品推广容器
  };
  const PAGE = 'mtop.cainiao.app.e2e.engine.page.fetch';
  const PROFILE = PAGE + '.cn';
  const FEED = 'mtop.cainiao.nbcps.presentation.fetch.cn';
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function endpoint(url) {
    if (typeof url !== 'string') return '';
    const m = /^https?:\/\/(?:[a-z0-9-]+\.)+cainiao\.com(?::(?:80|443))?\/gw\/([^/?#]+)(?:\/|\?|$)/i.exec(url);
    const api = m ? m[1].toLowerCase() : '';
    return [PAGE, PROFILE, FEED].includes(api) ? api : '';
  }
  function requestHeaders(url, original) {
    if (!endpoint(url) || !object(original)) return null;
    const headers = {};
    for (const key of Object.keys(original)) {
      if (key.toLowerCase() !== 'accept-encoding') headers[key] = original[key];
    }
    // The capture contains zstd responses. Ask the server for encodings QX can expose as text.
    // If the server still sends an unreadable response, clean() leaves it untouched.
    headers['Accept-Encoding'] = 'gzip, deflate';
    return headers;
  }
  function clean(url, body, options) {
    const result = {body, changed: false, removed: []};
    const api = endpoint(url);
    if (!api || typeof body !== 'string') return result;
    let root;
    try { root = JSON.parse(body); } catch (_) { return result; }
    if (!object(root) || !object(root.data) || typeof root.api !== 'string' || root.api.toLowerCase() !== api) return result;
    if (!Array.isArray(root.ret) || !root.ret.some(x => typeof x === 'string' && /^SUCCESS(?:::|$)/.test(x))) return result;
    const opt = Object.assign({}, OPTIONS, options || {});
    const data = root.data;
    const modules = data.data;
    function removeModule(key, reason) {
      if (object(modules) && own(modules, key)) {
        delete modules[key]; result.removed.push(reason + ':' + key);
      }
    }
    function mapper(key) {
      const m = object(modules) && modules[key];
      const items = object(m) && object(m.data) && object(m.data.data) && m.data.data.items;
      if (!object(m) || m.key !== key || !Array.isArray(items) || items.length !== 1) return null;
      return object(items[0]) && object(items[0].materialContentMapper) ? items[0].materialContentMapper : null;
    }
    if (api === PAGE && object(modules)) {
      if (opt.hideMiddleBottomTabs) {
        const home = mapper('2240'), mine = mapper('2249');
        // Both protected anchors must exist. Preserve their complete objects, routing keys and positions.
        if (home && mine && home.tabKey === 'homepage' && home.title === '首页' && mine.tabKey === 'personal_center_h5' && mine.title === '我的') {
          const specifications = [
            ['2242', 'hudong', ['发现']],
            ['2247', 'jijian', ['寄件券']],
            ['2248', 'im', ['消息']]
          ];
          for (const [key, tab, titles] of specifications) {
            const value = mapper(key);
            if (value && value.tabKey === tab && titles.includes(value.title)) removeModule(key, 'bottom-navigation');
          }
        }
      }
      const home = modules.data;
      if (opt.hideHomeShortcuts && object(home) && object(home.mainSearch) && home.mainSearch.type === 'home_v9_main_search' && Array.isArray(home.operationList)) {
        const groups = {
          kingkong: ['pick_up', 'send_mail', 'exchange_old_things', 'station_code'],
          icons: ['gjjf', 'packageQa', 'sawPuzzle', 'cnhs', 'appCentreMore']
        };
        const before = home.operationList;
        const after = before.filter(item => {
          if (!object(item) || !object(item.bizData)) return true;
          const known = groups[item.type];
          if (known && Array.isArray(item.bizData.items)) {
            const keys = new Set(item.bizData.items.filter(object).map(x => x.key));
            if (known.filter(k => keys.has(k)).length >= 2) {
              result.removed.push('home-shortcuts:' + item.type); return false;
            }
          }
          if (item.type === 'new_user_award' && typeof item.adUtArgs === 'string' && Array.isArray(item.bizData.userGuide)) {
            result.removed.push('home-promotion:new_user_award'); return false;
          }
          return true;
        });
        if (after.length !== before.length) home.operationList = after;
      }
    }
    if (api === PROFILE && opt.hideMineCards && object(modules)) {
      // Identify the observed personal page before deleting any modules.
      if (object(modules.header) && modules.header.key === 'header' && object(modules.order) && modules.order.key === 'order') {
        for (const key of ['banner', 'activity', 'asset', 'vip', 'wallet', 'packageArea']) {
          if (!object(modules[key]) || modules[key].key !== key) continue;
          if (key === 'packageArea') {
            const children = modules[key].data;
            if (!object(children) || !object(children['packageArea-share']) || !object(children['packageArea-report'])) continue;
          }
          removeModule(key, 'personal-page');
        }
      }
    }
    if (api === FEED && opt.hideHomePromotion && object(data.component) && data.component.type === 'nbcps.presentation.deal' && object(data.component.properties) && object(data.deal) && Array.isArray(data.deal.feeds)) {
      const properties = data.component.properties;
      // Respect the observed string-typed visibility field. Do not invent fields on unknown schemas.
      if (properties.visible === 'true' || properties.visible === 'false') {
        if (properties.visible !== 'false') {
          properties.visible = 'false'; result.removed.push('home-feed:visible=false');
        }
        if (data.deal.feeds.length) {
          data.deal.feeds = []; result.removed.push('home-feed:feeds');
        }
      }
    }
    if (result.removed.length) {
      result.body = JSON.stringify(root); result.changed = true;
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
