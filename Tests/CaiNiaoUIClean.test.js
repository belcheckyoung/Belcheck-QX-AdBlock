'use strict';
// Every value below is synthetic; no captured response is published.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {clean, requestHeaders} = require('../Scripts/CaiNiaoUIClean.js');
const PAGE = 'mtop.cainiao.app.e2e.engine.page.fetch';
const PROFILE = PAGE + '.cn';
const FEED = 'mtop.cainiao.nbcps.presentation.fetch.cn';
const url = api => 'https://cn-acs.m.cainiao.com/gw/' + api + '/1.0';
const response = (api, data) => ({api, ret: ['SUCCESS::ok'], data});
const run = root => clean(url(root.api), JSON.stringify(root));
const copy = x => JSON.parse(JSON.stringify(x));
function tab(key, tabKey, title, position) {
  return {key, position, data: {data: {items: [{materialContentMapper: {tabKey, title, route: 'synthetic'}}]}}};
}
const nav = response(PAGE, {data: {
  '2240': tab('2240', 'homepage', '首页', '0'),
  '2242': tab('2242', 'hudong', '发现', '1'),
  '2247': tab('2247', 'jijian', '寄件券', '2'),
  '2248': tab('2248', 'im', '消息', '3'),
  '2249': tab('2249', 'personal_center_h5', '我的', '4'),
  unknown: {keep: true}
}});
const result = JSON.parse(run(nav).body);
const expected = copy(nav);
for (const key of ['2242', '2247', '2248']) delete expected.data.data[key];
assert.deepEqual(result, expected);
const incomplete = copy(nav); delete incomplete.data.data['2240'];
assert.equal(run(incomplete).changed, false);
const variant = copy(nav);
variant.data.data['2247'].data.data.items[0].materialContentMapper.tabKey = 'unrecognized';
assert.deepEqual(JSON.parse(run(variant).body).data.data['2247'], variant.data.data['2247']);
const home = response(PAGE, {data: {data: {
  mainSearch: {type: 'home_v9_main_search', placeholder: 'synthetic'},
  operationList: [
    {type: 'kingkong', bizData: {items: [{key: 'pick_up'}, {key: 'send_mail'}]}},
    {type: 'icons', bizData: {items: [{key: 'gjjf'}, {key: 'cnhs'}]}},
    {type: 'new_user_award', adUtArgs: '', bizData: {userGuide: []}},
    {type: 'unrecognized', bizData: {items: []}}
  ]
}}});
const homeExpected = copy(home);
homeExpected.data.data.data.operationList = [home.data.data.data.operationList[3]];
assert.deepEqual(JSON.parse(run(home).body), homeExpected);
const cards = {};
for (const key of ['header', 'content', 'order', 'banner', 'activity', 'asset', 'vip', 'wallet']) cards[key] = {key, data: {keep: true}};
cards.packageArea = {key: 'packageArea', data: {'packageArea-share': {}, 'packageArea-report': {}}};
const profile = response(PROFILE, {data: cards});
assert.deepEqual(JSON.parse(run(profile).body).data.data, {header: cards.header, content: cards.content, order: cards.order});
const unfamiliar = copy(profile); unfamiliar.data.data.header.key = 'new';
assert.equal(run(unfamiliar).changed, false);
const feed = response(FEED, {component: {type: 'nbcps.presentation.deal', properties: {visible: 'true', keep: true}}, deal: {feeds: [{type: 'synthetic'}], keep: true}, header: {keep: true}});
const feedExpected = copy(feed); feedExpected.data.component.properties.visible = 'false'; feedExpected.data.deal.feeds = [];
assert.deepEqual(JSON.parse(run(feed).body), feedExpected);
for (const root of [nav, home, profile, feed]) {
  const out = run(root);
  assert(out.changed);
  assert.equal(clean(url(root.api), out.body).body, out.body);
  assert.equal(clean(url(root.api), out.body).changed, false);
  const failed = copy(root); failed.ret = ['FAIL::retry'];
  assert.equal(run(failed).body, JSON.stringify(failed));
  assert.equal(clean('https://example.com/', JSON.stringify(root)).changed, false);
  assert.equal(clean(url(root.api), JSON.stringify(root), {hideMiddleBottomTabs:false, hideHomeShortcuts:false, hideMineCards:false, hideHomePromotion:false}).changed, false);
}
for (const body of ['{', 'null', '[]', '{}']) assert.equal(clean(url(PAGE), body).body, body);
const headers = {'accept-encoding': 'zstd', 'X-Synthetic': 'keep'};
assert.deepEqual(requestHeaders(url(PAGE), headers), {'Accept-Encoding': 'gzip, deflate', 'X-Synthetic': 'keep'});
assert.equal(headers['accept-encoding'], 'zstd');
assert.equal(requestHeaders('https://example.com/', headers), null);
const source = fs.readFileSync(path.join(__dirname, '../Scripts/CaiNiaoUIClean.js'), 'utf8');
for (const phase of ['request', 'response']) {
  const calls = [];
  const context = {$request: {url: url(PROFILE), headers}, $done: x => calls.push(x)};
  if (phase === 'response') context.$response = {body: JSON.stringify(profile)};
  vm.runInNewContext(source, context, {timeout: 1000});
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0]), [phase === 'request' ? 'headers' : 'body']);
}
const snippet = fs.readFileSync(path.join(__dirname, '../Rewrite/CaiNiaoUIClean.snippet'), 'utf8');
const rules = snippet.split('\n').filter(x => x.startsWith('^')).map(x => x.split(' url '));
assert.equal(rules.length, 3);
for (const [pattern, action] of rules.slice(0, 2)) {
  for (const api of [PAGE, PROFILE, FEED]) assert(new RegExp(pattern).test(url(api)));
  assert(!new RegExp(pattern).test(url('mtop.cainiao.package.list')));
  assert(/script-(request-header|response-body) https:\/\/raw\.githubusercontent\.com\/belcheckyoung\/Belcheck-QX-AdBlock\/(?:main|[a-f0-9]{40})\/Scripts\/CaiNiaoUIClean\.js$/.test(action));
}
for (const scheme of ['http', 'https']) assert(new RegExp(rules[2][0]).test(scheme + '://p3-be-pack-sign.pglstatp-toutiao.com/ad.union.api/synthetic'));
assert(!new RegExp(rules[2][0]).test('https://p3-be-pack-sign.pglstatp-toutiao.com/ordinary/synthetic'));
assert(snippet.includes('hostname = cn-acs.m.cainiao.com, e2e-mtop.cainiao.com, nbcps-mtop.cainiao.com,'));
console.log('CaiNiaoUIClean: synthetic structure, preservation, runtime and subscription checks passed');
