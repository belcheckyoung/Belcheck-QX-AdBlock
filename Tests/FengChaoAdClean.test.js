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
const PAGE_CONFIG = WEB + '/fcboxactivityweb/api/v2/clientPage/';
const HEADER = PAGE_CONFIG + 'topImg';
const BATCH = PAGE_CONFIG + 'batchQueryClientPageConfigs';
const MODULES = PAGE_CONFIG + 'modulesAggregated';
const PICK_MARKETING = PAGE_CONFIG + 'homePickUpCardMarketingAggregated';
const VIP = '/uniDoraPick/pages/vip-center/vip';
const routes = [DSP + 'get', DSP + 'getMulti', POSITIONS, HOME, SUGGESTION, HEADER, BATCH, MODULES, PICK_MARKETING];
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

// New homepage resources retain their nested JSON-string contracts and ordinary settings.
function configResponse(config) {
  return {
    success: true, code: '0', msg: 'synthetic ok',
    data: {homePageConfig: encoded(config), ordinaryMetadata: {keep: true}},
    keepRoot: 'synthetic'
  };
}
function withConfig(input, config) {
  const result = clone(input); result.data.homePageConfig = encoded(config); return result;
}
const directMemberLinks = [VIP, VIP + '?synthetic=1', VIP + '#synthetic'];
const wrappedMemberLinks = [
  '/pages/h5Page/h5Page?h5PageUrl=' + encodeURIComponent('https://edms.fcbox.com/staticResource/wechat/program/wechat_pick/pick-card.html?synthetic=1#/vipMarketing'),
  '/pages/h5Page/h5Page?ordinary=synthetic&h5PageUrl=' + encodeURIComponent('https://edms.fcbox.com/staticResource/wechat/program/wechat_pick/pick-card.html?synthetic=a+b#/vipMarketing?synthetic=1')
];
const headConfig = {
  showFridayFlag: false,
  ordinaryHomeFeature: {enabled: true, text: 'synthetic'},
  headImg: {imgUrl: 'https://example.invalid/member-header.png', link: VIP, iconName: 'synthetic member promotion'}
};
const header = configResponse(headConfig);
for (const link of [...directMemberLinks, ...wrappedMemberLinks]) {
  const variant = clone(headConfig); variant.headImg.link = link;
  const input = configResponse(variant);
  equalRewrite(HEADER, input, withConfig(input, Object.assign(clone(variant), {headImg: null})));
  unchanged(HEADER, encoded(input), {hideHomeMarketing: false});
}
const ordinaryHeadLinks = [
  '/pages/SendPackage/boxSend/index', VIP + 'Other', VIP + '/details',
  'https://example.invalid' + VIP,
  '/pages/h5Page/h5PageOther?h5PageUrl=' + encodeURIComponent('https://edms.fcbox.com/staticResource/wechat/program/wechat_pick/pick-card.html#/vipMarketing'),
  '/pages/h5Page/h5Page?h5PageUrl=' + encodeURIComponent('https://edms.fcbox.com.example.invalid/staticResource/wechat/program/wechat_pick/pick-card.html#/vipMarketing'),
  '/pages/h5Page/h5Page?h5PageUrl=' + encodeURIComponent('https://example.invalid/staticResource/wechat/program/wechat_pick/pick-card.html#/vipMarketing'),
  '/pages/h5Page/h5Page?h5PageUrl=' + encodeURIComponent('https://edms.fcbox.com/staticResource/wechat/program/wechat_pick/ordinary.html#/vipMarketing'),
  '/pages/h5Page/h5Page?h5PageUrl=' + encodeURIComponent('https://edms.fcbox.com/staticResource/wechat/program/wechat_pick/pick-card.html#/ordinary'),
  '/pages/h5Page/h5Page?h5PageUrl=' + encodeURIComponent('https://edms.fcbox.com/staticResource/wechat/program/wechat_pick/pick-card.html#/vipMarketingOther'),
  '/pages/h5Page/h5Page?url=' + encodeURIComponent('https://edms.fcbox.com/staticResource/wechat/program/wechat_pick/pick-card.html#/vipMarketing'),
  '/pages/h5Page/h5Page?h5PageUrl=' + encodeURIComponent('https://edms.fcbox.com/bw/pick-card.html#/vipMarketing'),
  '/pages/h5Page/h5Page?h5PageUrl=' + encodeURIComponent(encodeURIComponent('https://edms.fcbox.com/staticResource/wechat/program/wechat_pick/pick-card.html#/vipMarketing')),
  wrappedMemberLinks[0] + '&h5PageUrl=' + encodeURIComponent('https://edms.fcbox.com/staticResource/wechat/program/wechat_pick/pick-card.html#/vipMarketing'),
  wrappedMemberLinks[0] + '#ordinary',
  '/pages/h5Page/h5Page?h5PageUrl=%ZZ',
  '', null, {}
];
for (const link of ordinaryHeadLinks) {
  const config = clone(headConfig); config.headImg.link = link;
  unchanged(HEADER, encoded(configResponse(config)));
}
for (const imgUrl of ['', null, 1, {}]) {
  const config = clone(headConfig); config.headImg.imgUrl = imgUrl;
  unchanged(HEADER, encoded(configResponse(config)));
}
for (const headImg of [null, [], 'unknown']) {
  const config = clone(headConfig); config.headImg = headImg;
  unchanged(HEADER, encoded(configResponse(config)));
}

// A keyed batch contains a member card alongside normal shipping tools.
const batch = {
  success: true, code: 0, msg: 'synthetic ok',
  data: {
    type32: {homePageConfig: encoded({imgUrl: 'https://example.invalid/send-member.png', jumpUrl: VIP + '?synthetic=send'}), keep: 'member-card'},
    type6: {homePageConfig: encoded({sendIcons: [{iconName:'synthetic pickup', link:'/pages/SendPackage/doorSend/index'}]}), keep: 'ordinary-send-tools'},
    syntheticFutureType: {homePageConfig: '{', keep: 'unknown'}
  },
  keepRoot: true
};
const batchExpected = clone(batch); delete batchExpected.data.type32;
equalRewrite(BATCH, batch, batchExpected);
unchanged(BATCH, encoded(batch), {hideHomeMarketing: false});
for (const jumpUrl of ordinaryHeadLinks) {
  const variant = clone(batch);
  variant.data.type32.homePageConfig = encoded({imgUrl:'https://example.invalid/member.png', jumpUrl});
  unchanged(BATCH, encoded(variant));
}
for (const imgUrl of ['', null, 1, {}]) {
  const variant = clone(batch); variant.data.type32.homePageConfig = encoded({imgUrl, jumpUrl:VIP});
  unchanged(BATCH, encoded(variant));
}
for (const type32 of [null, [], 'unknown', {homePageConfig:'{'}, {homePageConfig:encoded([])}, {homePageConfig:{imgUrl:'https://example.invalid/member.png', jumpUrl:VIP}}]) {
  const variant = clone(batch); variant.data.type32 = type32; unchanged(BATCH, encoded(variant));
}

// An explicitly named advertising module is removed without dropping service modules.
const moduleConfig = {
  moduleList: [
    {moduleType:'m1', name:'synthetic life service', title:'synthetic services', contents:[{items:[{link:'/wash/pages/home/index', keep:true}]}]},
    {moduleType:'m2', name:'banner模块', title:'广告', keep:'ad'},
    {moduleType:'m1', name:'banner模块', title:'广告', keep:'ordinary-different-type'},
    {moduleType:'m2', name:'banner模块', title:'普通服务', keep:'ordinary-different-title'},
    {moduleType:'m2', name:'其他模块', title:'广告', keep:'unknown-different-name'},
    {moduleType:'m3', name:'synthetic membership navigation', title:'synthetic savings', contents:[{items:[{link:VIP, keep:true}]}]},
    null, 'unknown'
  ],
  userTierInfo: {userLevelName:'synthetic', growthValue:7},
  ordinarySetting: {keep:true}
};
const modules = configResponse(moduleConfig);
const moduleExpected = clone(moduleConfig); moduleExpected.moduleList.splice(1, 1);
equalRewrite(MODULES, modules, withConfig(modules, moduleExpected));
unchanged(MODULES, encoded(modules), {hideHomeMarketing: false});
const ordinaryModules = clone(moduleConfig); ordinaryModules.moduleList.splice(1,1);
unchanged(MODULES, encoded(configResponse(ordinaryModules)));
for (const moduleList of [null, {}, 'unknown', []]) {
  const config = clone(moduleConfig); config.moduleList = moduleList;
  unchanged(MODULES, encoded(configResponse(config)));
}

// Pick-card marketing has a second string-encoded object; visibility flags are typed booleans.
const pickConfig = {
  moduleList: {ordinaryPickSetting:{keep:true}},
  pickMarketingSet: {
    activityTypeName: '会员营销模块', btnLink: VIP + '?synthetic=button', bannerLink: VIP + '#synthetic',
    showBtn: true, showBadge: true, showBanner: true,
    bannerImage:'https://example.invalid/member-pick.png', btnText:'synthetic join',
    ordinarySetting:{keep:true}
  },
  ordinaryModuleConfig: {keep:true}
};
const pickItems = [
  {name:'synthetic member offer', moduleJson:encoded(pickConfig), ordinaryMetadata:{keep:true}},
  {name:'synthetic ordinary pick', moduleJson:encoded({moduleList:{ordinary:true}})},
  {name:'synthetic malformed future', moduleJson:'{'}, null, 'unknown'
];
const pick = configResponse(pickItems);
const pickExpectedConfig = clone(pickConfig);
for (const key of ['showBtn','showBadge','showBanner']) pickExpectedConfig.pickMarketingSet[key] = false;
const pickExpectedItems = clone(pickItems); pickExpectedItems[0].moduleJson = encoded(pickExpectedConfig);
equalRewrite(PICK_MARKETING, pick, withConfig(pick, pickExpectedItems));
unchanged(PICK_MARKETING, encoded(pick), {hideMemberPromotion:false});
for (const changed of [
  {activityTypeName:'ordinary pick service'}, {btnLink:VIP + 'Other'}, {bannerLink:VIP + '/details'},
  {btnLink:'https://example.invalid' + VIP}, {bannerLink:'/pages/SendPackage/boxSend/index'},
  {btnLink:null}, {bannerLink:{}}, {activityTypeName:null}
]) {
  const config = clone(pickConfig); Object.assign(config.pickMarketingSet, changed);
  unchanged(PICK_MARKETING, encoded(configResponse([{moduleJson:encoded(config)}])));
}
const partiallyTyped = clone(pickConfig);
partiallyTyped.pickMarketingSet.showBtn = true;
partiallyTyped.pickMarketingSet.showBadge = 'true';
delete partiallyTyped.pickMarketingSet.showBanner;
const partiallyTypedExpected = clone(partiallyTyped); partiallyTypedExpected.pickMarketingSet.showBtn = false;
const partialPick = configResponse([{moduleJson:encoded(partiallyTyped)}]);
equalRewrite(PICK_MARKETING, partialPick, configResponse([{moduleJson:encoded(partiallyTypedExpected)}]));
const untouchedTypes = clone(pickConfig);
untouchedTypes.pickMarketingSet.showBtn = 'true'; untouchedTypes.pickMarketingSet.showBadge = 1;
untouchedTypes.pickMarketingSet.showBanner = false;
unchanged(PICK_MARKETING, encoded(configResponse([{moduleJson:encoded(untouchedTypes)}])));
const missingVisibility = clone(pickConfig);
for (const key of ['showBtn','showBadge','showBanner']) delete missingVisibility.pickMarketingSet[key];
unchanged(PICK_MARKETING, encoded(configResponse([{moduleJson:encoded(missingVisibility)}])));
unchanged(PICK_MARKETING, encoded(configResponse([])));
for (const moduleJson of ['{', encoded(null), encoded([]), pickConfig, null]) {
  unchanged(PICK_MARKETING, encoded(configResponse([{moduleJson}])));
}
for (const pickMarketingSet of [null, [], 'unknown']) {
  const config = clone(pickConfig); config.pickMarketingSet = pickMarketingSet;
  unchanged(PICK_MARKETING, encoded(configResponse([{moduleJson:encoded(config)}])));
}

// Malformed outer strings and unsuccessful envelopes remain byte-identical on each new route.
for (const [url, input] of [[HEADER,header], [BATCH,batch], [MODULES,modules], [PICK_MARKETING,pick]]) {
  for (const change of [{success:false}, {success:undefined}, {code:'failure'}, {data:[]}, {data:null}]) {
    unchanged(url, encoded(Object.assign(clone(input), change)));
  }
  if (url !== BATCH) {
    for (const homePageConfig of ['{', encoded(null), encoded('unknown'), {}, null]) {
      const variant = clone(input); variant.data.homePageConfig = homePageConfig;
      unchanged(url, encoded(variant));
    }
  }
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
  HEADER + 'Other', HEADER + '/extra', BATCH + 'Other', BATCH + '/extra',
  MODULES + 'Other', MODULES + '/extra', PICK_MARKETING + 'Other', PICK_MARKETING + '/extra',
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
for (const [url, input, expected] of [
  [HEADER, header, withConfig(header, Object.assign(clone(headConfig), {headImg:null}))],
  [BATCH, batch, batchExpected], [MODULES, modules, withConfig(modules, moduleExpected)],
  [PICK_MARKETING, pick, withConfig(pick, pickExpectedItems)]
]) {
  const output = execute({$request:{url,headers}, $response:{body:encoded(input)}});
  assert.deepEqual(Object.keys(output), ['body']);
  assert.deepEqual(JSON.parse(output.body), expected);
}
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
