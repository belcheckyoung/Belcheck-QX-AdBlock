'use strict';
// All fixture values are invented. This test never reads or publishes capture files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {clean, requestHeaders, endpoint} = require('../Scripts/FengChaoAdClean.js');
const DSP = 'https://dsp.fcbox.com/adSearch/';
const WEB = 'https://webchatapp.fcbox.com';
const POSITIONS = WEB + '/commerce/mobile/appConfig/getPositions';
const HOME = WEB + '/fcboxactivityweb/api/v2/clientPage/getUserClientPageInfo';
const SUGGESTION = WEB + '/post/suggestion/query';
const routes = [DSP + 'get', DSP + 'getMulti', POSITIONS, HOME, SUGGESTION];
const clone = x => JSON.parse(JSON.stringify(x));
const encoded = x => JSON.stringify(x);
const run = (url, data, options) => clean(url, encoded(data), options);
const read = result => JSON.parse(result.body);
let checks = 0;
function unchanged(url, body, options) {
  const result = clean(url, body, options);
  assert.equal(result.changed, false);
  assert.equal(result.body, body);
  assert.deepEqual(result.removed, []);
  checks++;
}
function equalRewrite(url, input, expected, options) {
  const original = encoded(input);
  const result = clean(url, original, options);
  assert.equal(result.changed, true);
  assert(Array.isArray(result.removed) && result.removed.length > 0);
  assert.deepEqual(read(result), expected);
  assert.equal(encoded(input), original, 'caller fixture must remain unchanged');
  unchanged(url, result.body, options);
  checks++;
  return result;
}

// A shared advertising API is cleaned for every slot, including an unseen splash slot.
for (const slot of ['synthetic-banner', 'synthetic-splash', 'synthetic-interstitial', 'synthetic-new-slot']) {
  for (const route of [DSP + 'get', DSP + 'getMulti']) {
    const input = {
      code: '370100000', msg: 'synthetic ok', data: [{id: slot, url: 'https://example.invalid/ad.png'}],
      extendsData: {synthetic: true},
      extendsMap: {wxAdsFlag: 'true', fcDspFlag: true, interstitialErrSwitch: 'true', unknownSwitch: 'true'},
      keepRoot: {ordinary: true}
    };
    const expected = clone(input);
    expected.data = null; expected.extendsData = null;
    expected.extendsMap.wxAdsFlag = 'false'; expected.extendsMap.fcDspFlag = false;
    expected.extendsMap.interstitialErrSwitch = 'false';
    equalRewrite(route + '?adSlotId=' + slot + '&synthetic=1', input, expected);
    const optionsExpected = clone(input); optionsExpected.data = null; optionsExpected.extendsData = null;
    equalRewrite(route, input, optionsExpected, {disableAdFallback: false});
  }
}
for (const data of [{id: 'synthetic'}, null]) {
  const input = {code: '370100000', data, extendsMap: {wxAdsFlag: true, preserve: 'synthetic'}};
  const expected = clone(input); expected.data = null; expected.extendsMap.wxAdsFlag = false;
  equalRewrite(DSP + 'get', input, expected);
}
const noFlags = {code: '370100000', data: [{id: 'synthetic'}], keep: 7};
equalRewrite(DSP + 'getMulti', noFlags, {code: '370100000', data: null, keep: 7});
const numericFlags = {code: '370100000', data: [{id: 'synthetic'}], extendsMap: {wxAdsFlag: 1, fcDspFlag: null, interstitialErrSwitch: {keep: true}}};
const numericFlagsExpected = clone(numericFlags); numericFlagsExpected.data = null;
equalRewrite(DSP + 'get', numericFlags, numericFlagsExpected);
unchanged(DSP + 'get', encoded({code: '370100000', data: null}));
for (const input of [
  {code: 'failure', data: [{id: 'synthetic'}]},
  {code: '370100000'},
  {code: '370100000', data: 'unknown shape', extendsMap: {wxAdsFlag: 'true'}},
  {code: '370100000', data: 12, extendsMap: {wxAdsFlag: 'true'}}
]) unchanged(DSP + 'get', encoded(input));

// Filter only confirmed ad configurations; preserve order and unfamiliar entries.
const positions = {
  success: true, code: '200100000', msg: 'synthetic ok',
  data: [
    {configKey: 'ordinary-pick-service', adPosition: '', keep: 'first'},
    {configKey: 'wechatMiniAppOrderListPageThird', adPosition: '', keep: 'ad'},
    {configKey: 'synthetic-ad-config', adPosition: 'adunit-synthetic', keep: 'ad'},
    {configKey: 'unrecognizedFutureFeature', adPosition: 'ordinary-position', keep: 'last'}
  ],
  preserve: {ordinary: true}
};
const positionsExpected = clone(positions); positionsExpected.data = [positions.data[0], positions.data[3]];
equalRewrite(POSITIONS, positions, positionsExpected);
const unknownPositions = clone(positions); unknownPositions.data = [positions.data[3], {configKey: 'wechatMiniAppOrderListPageThirdExtra', adPosition: 'prefix-adunit-synthetic'}];
unchanged(POSITIONS, encoded(unknownPositions));
for (const change of [{success:false}, {code:'failure'}, {data:{}}, {data:null}]) {
  unchanged(POSITIONS, encoded(Object.assign(clone(positions), change)));
}

// The homepage configuration is a JSON string, not an object to be dropped wholesale.
const navigation = {
  bottomNavigation: {
    tabText: '会员直降', link: '/uniDoraPick/pages/vip-center/vip', showMiddleTab: true,
    jumpType: 'synthetic', tabUrl: 'https://example.invalid/icon.png', colorChange: false
  },
  ordinaryHomeFeature: {keep: true}
};
const home = {
  success: true, code: '0', msg: 'synthetic ok',
  data: {homePageConfig: encoded(navigation), otherConfig: encoded({keep:true})},
  keepRoot: true
};
const homeExpected = clone(home); const navigationExpected = clone(navigation);
navigationExpected.bottomNavigation.showMiddleTab = false;
homeExpected.data.homePageConfig = encoded(navigationExpected);
equalRewrite(HOME, home, homeExpected);
unchanged(HOME, encoded(home), {hideMemberNavigation: false});
for (const [key, value] of [['tabText','其他服务'], ['link','/ordinary/pick'], ['showMiddleTab',false]]) {
  const variant = clone(home); const config = clone(navigation); config.bottomNavigation[key] = value;
  variant.data.homePageConfig = encoded(config); unchanged(HOME, encoded(variant));
}
for (const badConfig of ['{', encoded({ordinary: true}), navigation, null]) {
  const variant = clone(home); variant.data.homePageConfig = badConfig; unchanged(HOME, encoded(variant));
}
for (const change of [{success:false}, {code:'failure'}, {data:[]}, {data:null}]) {
  unchanged(HOME, encoded(Object.assign(clone(home), change)));
}

// Membership promotion is removed without altering recommendations or account data.
const suggestion = {
  success: true, code: '030100000', msg: 'synthetic ok',
  data: {
    top: {recommendFunctionCode: 'memberCentre', activityName: '合成会员推广', pic: 'https://example.invalid/banner.png'},
    ordinarySuggestion: {keep: true}, side: [{recommendFunctionCode:'pickService', keep:true}]
  },
  keepRoot: 'synthetic'
};
const suggestionExpected = clone(suggestion); suggestionExpected.data.top = null;
equalRewrite(SUGGESTION, suggestion, suggestionExpected);
unchanged(SUGGESTION, encoded(suggestion), {hideMemberPromotion: false});
for (const change of [{recommendFunctionCode:'pickService'}, {activityName:'普通取件功能'}]) {
  const variant = clone(suggestion); Object.assign(variant.data.top, change); unchanged(SUGGESTION, encoded(variant));
}
for (const change of [{success:false}, {code:'failure'}, {data:[]}, {data:null}]) {
  unchanged(SUGGESTION, encoded(Object.assign(clone(suggestion), change)));
}

const dspBody = encoded(noFlags);
// URL matching must not bleed into lookalike domains, route prefixes, or business APIs.
const unrelated = [
  'https://example.invalid/adSearch/get', 'https://dsp.fcbox.com.example.invalid/adSearch/get',
  'https://dspXfcboxXcom/adSearch/get', 'https://dsp.fcbox.com/adSearch/getOther',
  'https://dsp.fcbox.com/adSearch/get/extra', 'https://dsp.fcbox.com/ordinary/get',
  'https://webchatapp.fcbox.com.example.invalid/post/suggestion/query',
  WEB + '/post/suggestion/queryOther', WEB + '/post/suggestion/query/extra',
  WEB + '/commerce/mobile/appConfig/getPositionsOther',
  WEB + '/fcboxactivityweb/api/v2/clientPage/getUserClientPageInfoExtra',
  WEB + '/post/order/list', WEB + '/post/order/pay', WEB + '/post/pick/code',
  'not a URL'
];
for (const route of routes) {
  assert(endpoint(route), route + ' should be recognized');
  assert(endpoint(route + '?synthetic=1'), 'query must not prevent a match');
  for (const body of ['{', 'null', '[]', '{}', '', 'ordinary plain text']) unchanged(route, body);
}
for (const route of unrelated) {
  assert(!endpoint(route), route + ' must not be recognized');
  unchanged(route, dspBody);
  assert.equal(requestHeaders(route, {'X-Synthetic':'keep'}), null);
}
const headers = {'accept-encoding':'br', 'ACCEPT-ENCODING':'zstd', 'Accept-Encoding':'identity', 'X-Synthetic':'keep', 'X-Another':'synthetic'};
for (const route of routes) {
  const input = clone(headers);
  assert.deepEqual(requestHeaders(route, input), {'Accept-Encoding':'gzip, deflate', 'X-Synthetic':'keep', 'X-Another':'synthetic'});
  assert.deepEqual(input, headers, 'requestHeaders must copy the original headers');
}

// Exercise the actual Quantumult X wrapper, including errors, rather than only helpers.
const source = fs.readFileSync(path.join(__dirname, '../Scripts/FengChaoAdClean.js'), 'utf8');
function execute(context) {
  const calls = [];
  vm.runInNewContext(source, Object.assign({$done: result => calls.push(result)}, context), {timeout: 1000});
  assert.equal(calls.length, 1, '$done must be called exactly once');
  checks++;
  return calls[0];
}
const requestResult = execute({$request: {url: HOME, headers}});
assert.deepEqual(JSON.parse(JSON.stringify(requestResult)), {headers: requestHeaders(HOME, headers)});
const responseResult = execute({$request: {url: SUGGESTION, headers}, $response: {body: encoded(suggestion)}});
assert.deepEqual(Object.keys(responseResult), ['body']);
assert.deepEqual(JSON.parse(responseResult.body), suggestionExpected);
for (const url of [SUGGESTION, 'https://example.invalid/ordinary']) {
  const responseResult = execute({$request:{url,headers}, $response:{body:'{'}});
  assert(!responseResult || !responseResult.body || responseResult.body === '{', 'errors must keep original response');
}
const throwingRequest = {headers};
Object.defineProperty(throwingRequest, 'url', {get(){throw new Error('synthetic request exception');}});
execute({$request:throwingRequest});
const throwingResponse = {};
Object.defineProperty(throwingResponse, 'body', {get(){throw new Error('synthetic response exception');}});
execute({$request:{url:SUGGESTION,headers}, $response:throwingResponse});

// Subscription rules must cover the same ordinary HTTP/HTTPS endpoint variants.
const snippet = fs.readFileSync(path.join(__dirname, '../Rewrite/FengChaoAdClean.snippet'), 'utf8');
const rules = snippet.split('\n').filter(line => line.startsWith('^')).map(line => line.split(' url '));
assert.equal(rules.length, 6);
// Match encoded and decoded URLs without literal Unicode in the resource grammar.
// This is a compatibility regression guard, not a native Quantumult X parser test.
for (const [pattern] of rules) assert(!/[^\x00-\x7f]/.test(pattern), 'active rewrite patterns must be ASCII');
const scriptRules = rules.filter(([, action]) => action.startsWith('script-'));
assert.equal(scriptRules.length, 2);
assert(scriptRules.some(([, action]) => action.startsWith('script-request-header ')));
assert(scriptRules.some(([, action]) => action.startsWith('script-response-body ')));
for (const [pattern, action] of scriptRules) {
  const regex = new RegExp(pattern);
  assert(/script-(?:request-header|response-body) https:\/\/raw\.githubusercontent\.com\/belcheckyoung\/Belcheck-QX-AdBlock\/(?:main|[a-f0-9]{40})\/Scripts\/FengChaoAdClean\.js$/.test(action));
  for (const route of routes) {
    for (const variant of [route, route + '/', route + '?synthetic=1', route + '/?synthetic=1', route.replace(/^https:/, 'http:')]) {
      assert(endpoint(variant), variant + ' must reach the helper');
      assert(regex.test(variant), variant + ' must reach the script rule');
      checks++;
    }
  }
  for (const route of unrelated) assert(!regex.test(route), route + ' must not match script subscription');
}
function ruleFor(action, sample) {
  const candidates = rules.filter(([pattern, value]) => value === action && new RegExp(pattern).test(sample));
  assert.equal(candidates.length, 1, 'one precise rule must handle ' + sample);
  return new RegExp(candidates[0][0]);
}
const tracker = ruleFor('reject-200', DSP.replace('/adSearch/', '/adTracker/') + 'stat?synthetic=1');
for (const route of [DSP + 'get', 'https://dsp.fcbox.com/adTracker/statOther', 'https://dsp.fcbox.com/adTracker/stat/detail', 'https://dsp.fcbox.com/adTracker/ordinary']) assert(!tracker.test(route));
const media = ruleFor('reject-img', 'https://ad-dsp-1251779293.file.myqcloud.com/synthetic/ad.png');
assert(!media.test('https://ad-dsp-1251779293.file.myqcloud.com.example.invalid/synthetic/ad.png'));
const memberImageBase = 'https://consumerapp-1251779293.file.myqcloud.com/patch/202512/';
const memberImage = ruleFor('reject-img', memberImageBase + '%E5%8F%96%E4%BB%B6_4mdfd5fjvxf.png');
assert(memberImage.test(memberImageBase + '取件_4mdfd5fjvxf.png?synthetic=1'));
assert(memberImage.test(memberImageBase + '%e5%8f%96%e4%bb%b6_4mdfd5fjvxf.png'));
for (const route of [memberImageBase + 'ordinary.png', memberImageBase + '取件_other.png', memberImageBase + '取件_4mdfd5fjvxf.png.extra']) assert(!memberImage.test(route));
for (const route of [memberImageBase.replace('/202512/', '/202601/') + '取件_4mdfd5fjvxf.png', memberImageBase + 'extra/取件_4mdfd5fjvxf.png']) assert(!memberImage.test(route));
const rtmBase = 'https://rtm.fcbox.com/rtsWeb/api/resource/ad/';
const rtm = ruleFor('reject-dict', rtmBase + 'queryAd?synthetic=1');
for (const route of [rtmBase + 'queryAdOther', rtmBase + 'queryAd/detail', 'https://rtm.fcbox.com/rtsWeb/api/order/query', 'https://rtm.fcbox.com/rtsWeb/api/resource/query', 'https://rtm.fcbox.com/ordinary', 'https://rtm.fcbox.com.example.invalid/rtsWeb/api/resource/ad/queryAd']) assert(!rtm.test(route));
for (const route of [WEB + '/post/order/list', WEB + '/post/order/pay', WEB + '/post/pick/code', WEB + '/post/send/create']) {
  for (const [pattern] of rules) assert(!new RegExp(pattern).test(route), 'business route must remain untouched: ' + route);
}
assert(snippet.includes('hostname = dsp.fcbox.com, webchatapp.fcbox.com, rtm.fcbox.com, ad-dsp-1251779293.file.myqcloud.com, consumerapp-1251779293.file.myqcloud.com'));
assert(!snippet.includes('%APPEND%'));
console.log('FengChaoAdClean: ' + checks + ' synthetic preservation, matching, idempotence, wrapper and subscription checks passed');
