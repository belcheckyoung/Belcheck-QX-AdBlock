'use strict';

// Synthetic messages only. Never add captured responses, account data or tokens.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

const source = fs.readFileSync(path.join(__dirname, '../Scripts/BilibiliAppAds.js'), 'utf8');
const BINARY = 'https://app.bilibili.com/bilibili.app.viewunite.v1.View/AIRelateAsync';
const SPLASH = 'https://app.bilibili.com/x/v2/splash/list';
const FEED = 'https://app.bilibili.com/x/v2/feed/index';
const TYPE = 'type.googleapis.com/bilibili.ad.v1.SourceContentDto';
const cat = (...parts) => Buffer.concat(parts.flat());
const utf8 = value => Buffer.from(value, 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const cases = [];
const test = (name, run) => cases.push({name, run});

function varint(value) {
  const bytes = [];
  let n = BigInt(value);
  do {
    const byte = Number(n & 127n);
    n >>= 7n;
    bytes.push(byte | (n ? 128 : 0));
  } while (n);
  return Buffer.from(bytes);
}
const scalar = (field, value) => cat(varint(field * 8), varint(value));
const bytes = (field, value) => cat(varint(field * 8 + 2), varint(value.length), value);
const fixed32 = (field, value) => cat(varint(field * 8 + 5), Buffer.from(value));
const fixed64 = (field, value) => cat(varint(field * 8 + 1), Buffer.from(value));
const unknown = cat(
  // Noncanonical but valid varints must survive byte-for-byte.
  varint(70 * 8), Buffer.from([0x81, 0x00]),
  bytes(71, utf8('synthetic unknown')),
  fixed32(72, [0x10, 0x20, 0x30, 0x40]),
  fixed64(73, [1, 2, 3, 4, 5, 6, 7, 8])
);
const any = (value, type = TYPE) => cat(bytes(1, utf8(type)), bytes(2, value), scalar(31, 27));
const adValue = cat(scalar(1, 8), bytes(9, utf8('synthetic advertisement')), unknown);
const content = (type, value = adValue, typeUrl = TYPE) => cat(
  scalar(1, type), bytes(6, cat(bytes(2, any(value, typeUrl)), unknown)), unknown
);
function relate(cards, extra = unknown) {
  return bytes(2, cat(bytes(1, cat(bytes(22, cat(cards.map(card => bytes(1, card)), unknown)), unknown)), extra));
}
function sourceEntry(value, type = TYPE) {
  return bytes(5, cat(bytes(1, any(value, type)), unknown));
}
const sourceRoot = entries => bytes(1, cat(entries, unknown));

function frame(payload, compression = 0) {
  const data = compression === 1 ? zlib.gzipSync(payload) : payload;
  const header = Buffer.alloc(5);
  header[0] = compression;
  header.writeUInt32BE(data.length, 1);
  return cat(header, data);
}
const trailer = frame(utf8('grpc-status: 0\r\nsynthetic: preserved\r\n'), 128);
function unframe(buffer) {
  const result = [];
  for (let offset = 0; offset < buffer.length;) {
    assert.ok(buffer.length - offset >= 5, 'output frame header is complete');
    const flag = buffer[offset];
    const size = buffer.readUInt32BE(offset + 1);
    const end = offset + 5 + size;
    assert.ok(end <= buffer.length, 'output frame length matches compressed payload');
    const raw = buffer.subarray(offset, end);
    const encoded = buffer.subarray(offset + 5, end);
    result.push({flag, raw, payload: flag === 1 ? zlib.gunzipSync(encoded) : encoded});
    offset = end;
  }
  return result;
}
function execute(url, response) {
  const calls = [];
  const context = {
    $request: {url}, $response: response,
    $done: result => calls.push(result),
    ArrayBuffer, Uint8Array,
    console: {log() {}, error() {}, warn() {}}
  };
  // Deliberately omit Node's Buffer, require and process from the script VM.
  vm.runInNewContext(source, context, {timeout: 3000, filename: 'BilibiliAppAds.js'});
  assert.equal(calls.length, 1, 'Quantumult X callback must run exactly once');
  assert.ok(calls[0] && typeof calls[0] === 'object', 'callback result is an object');
  return calls[0];
}
function invokeBinary(data, url = BINARY) {
  const bodyBytes = Uint8Array.from(data).buffer;
  const before = Buffer.from(bodyBytes).toString('hex');
  const result = execute(url, {bodyBytes});
  assert.equal(Buffer.from(bodyBytes).toString('hex'), before, 'input buffer must remain untouched');
  if (!Object.keys(result).length) return {result, bytes: data, changed: false};
  assert.deepEqual(Object.keys(result), ['bodyBytes']);
  assert.ok(result.bodyBytes instanceof ArrayBuffer, 'binary result must be an ArrayBuffer');
  return {result, bytes: Buffer.from(result.bodyBytes), changed: true};
}
function invokeJSON(root, url = SPLASH) {
  const original = typeof root === 'string' ? root : JSON.stringify(root);
  const result = execute(url, {body: original});
  if (!Object.keys(result).length) return {result, body: original, value: root, changed: false};
  assert.deepEqual(Object.keys(result), ['body']);
  assert.equal(typeof result.body, 'string');
  return {result, body: result.body, value: JSON.parse(result.body), changed: true};
}
const expectUnchanged = result => assert.equal(result.changed, false, 'unknown or invalid response must fail open');
function expectBinary(input, expected, compression = 0, url = BINARY) {
  const output = invokeBinary(input, url);
  assert.equal(output.changed, true, 'confirmed advertising must be removed');
  const frames = unframe(output.bytes);
  assert.equal(frames[0].flag, compression, 'preserve original compression type');
  assert.deepEqual(frames[0].payload, expected, 'preserve all unrelated protobuf bytes');
  assert.deepEqual(frames.at(-1).raw, trailer, 'preserve trailer bytes exactly');
  expectUnchanged(invokeBinary(output.bytes, url));
  return frames;
}

const normal = [content(1), content(6), content(8)];
const type5Unknown = content(5, adValue, 'type.googleapis.com/synthetic.Unknown');
const type5NoAd = content(5, cat(scalar(1, 8), unknown));
const type5EmptyAd = content(5, cat(bytes(9, Buffer.alloc(0)), unknown));
const retained = [...normal, type5Unknown, type5NoAd, type5EmptyAd];

for (const compression of [0, 1]) test('protobuf card filtering with compression ' + compression, () => {
  const input = cat(unknown, relate([retained[0], content(5), ...retained.slice(1), content(5)]), scalar(88, 4));
  const expected = cat(unknown, relate(retained), scalar(88, 4));
  expectBinary(cat(frame(input, compression), trailer), expected, compression);
});

test('source Any removes only field 9 and preserves neighboring fields', () => {
  const value = cat(bytes(2, utf8('synthetic keep')), bytes(9, utf8('ad one')), unknown, bytes(9, utf8('ad two')));
  const cleaned = cat(bytes(2, utf8('synthetic keep')), unknown);
  const other = sourceEntry(adValue, 'type.googleapis.com/synthetic.Unknown');
  const input = cat(sourceRoot([sourceEntry(value), other]), relate(normal), unknown);
  const expected = cat(sourceRoot([sourceEntry(cleaned), other]), relate(normal), unknown);
  expectBinary(cat(frame(input), trailer), expected);
});

test('source containing only field 9 leaves an empty Any value', () => {
  const input = sourceRoot([sourceEntry(bytes(9, utf8('synthetic ad')))]);
  const expected = sourceRoot([sourceEntry(Buffer.alloc(0))]);
  expectBinary(cat(frame(input, 1), trailer), expected, 1);
});

test('all matching nested repeated containers are processed', () => {
  const input = cat(sourceRoot([sourceEntry(adValue), sourceEntry(adValue)]), relate([content(5)]), relate([normal[0], content(5)]));
  const cleaned = cat(scalar(1, 8), unknown);
  const expected = cat(sourceRoot([sourceEntry(cleaned), sourceEntry(cleaned)]), relate([]), relate([normal[0]]));
  expectBinary(cat(frame(input), trailer), expected);
});

test('multiple data frames retain independent compression and trailers', () => {
  const payload = relate([normal[0], content(5)]);
  const input = cat(frame(payload), frame(payload, 1), trailer);
  const output = invokeBinary(input);
  assert.equal(output.changed, true);
  const frames = unframe(output.bytes);
  assert.deepEqual(frames.map(x => x.flag), [0, 1, 128]);
  assert.deepEqual(frames[0].payload, relate([normal[0]]));
  assert.deepEqual(frames[1].payload, relate([normal[0]]));
  assert.deepEqual(frames[2].raw, trailer);
  expectUnchanged(invokeBinary(output.bytes));
});

test('unrecognized or already clean protobuf is returned untouched', () => {
  for (const payload of [Buffer.alloc(0), unknown, relate(retained), sourceRoot([sourceEntry(unknown)])]) {
    expectUnchanged(invokeBinary(cat(frame(payload), trailer)));
  }
  expectUnchanged(invokeBinary(trailer));
});

test('binary endpoint accepts only exact supported hosts and path', () => {
  const payload = relate([content(5)]);
  for (const host of ['app.bilibili.com', 'grpc.biliapi.net']) {
    for (const scheme of ['http', 'https']) {
      const url = scheme + '://' + host + '/bilibili.app.viewunite.v1.View/AIRelateAsync?synthetic=1';
      expectBinary(cat(frame(payload), trailer), relate([]), 0, url);
    }
  }
  for (const url of [
    BINARY + '/child', BINARY + 'Suffix', BINARY + '#fragment',
    BINARY.replace('app.bilibili.com', 'app.bilibili.com.evil.example'),
    BINARY.replace('app.bilibili.com', 'evil-app.bilibili.com'),
    BINARY.replace('app.bilibili.com', 'app.bilibili.com@evil.example'),
    BINARY.replace('https:', 'ftp:'), SPLASH, 'https://example.invalid/'
  ]) expectUnchanged(invokeBinary(cat(frame(payload), trailer), url));
});

test('invalid frame, gzip or protobuf makes the complete response fail open', () => {
  const valid = frame(relate([content(5)]));
  const invalidLength = Buffer.from(valid); invalidLength.writeUInt32BE(valid.length + 1, 1);
  const unknownCompression = Buffer.from(valid); unknownCompression[0] = 2;
  const brokenGzip = frame(relate([content(5)]), 1); brokenGzip[brokenGzip.length - 8] ^= 1;
  const malformed = [
    Buffer.alloc(0), Buffer.from([0, 0, 0]), invalidLength, unknownCompression,
    frame(utf8('not gzip'), 3), cat(Buffer.from([1, 0, 0, 0, 3]), utf8('bad')),
    brokenGzip, frame(Buffer.from([0x12, 0x08, 0x0a])), frame(Buffer.from([0x00])),
    frame(Buffer.from([0x0f])), frame(Buffer.from([0x80])),
    frame(bytes(2, bytes(1, bytes(22, Buffer.from([0x0a, 0x7f]))))),
    cat(valid, Buffer.from([0, 0])), cat(valid, unknownCompression), cat(valid, brokenGzip)
  ];
  for (const input of malformed) expectUnchanged(invokeBinary(input));
});

test('splash removes only positively identified advertising and matching IDs', () => {
  const root = {code: 0, message: 'synthetic', data: {
    list: [
      {id: 1, is_ad: true}, {id: 2, is_ad: 1}, {id: 3, is_ad_loc: true},
      {id: 4, is_ad_loc: 1}, {id: 5, ad_cb: 'synthetic', cm_mark: 1},
      {id: 6, is_ad: false, wallpaper: true}, {id: 7, is_ad: '1'},
      {id: 8, ad_cb: '', cm_mark: 'synthetic'}, {id: 9, ad_cb: 'synthetic'},
      {id: 10, source: 935, wallpaper: true}
    ],
    show: [{id: 1}, {id: 6}, {id: 5}, {id: 999, synthetic: 'unknown cached ID'}],
    keep_ids: [1, 6, 5, 999], untouched: {name: 'synthetic'}
  }};
  const expected = clone(root);
  expected.data.list = expected.data.list.slice(5);
  expected.data.show = [root.data.show[1], root.data.show[3]];
  expected.data.keep_ids = [6, 999];
  const output = invokeJSON(root);
  assert.equal(output.changed, true);
  assert.deepEqual(output.value, expected);
  expectUnchanged(invokeJSON(output.body));
});

test('all-ad splash clears stale show and keep IDs', () => {
  const root = {code: 0, data: {
    list: [{id: 1, is_ad: true}, {id: 2, is_ad_loc: 1}],
    show: [{id: 1}, {id: 991, cached: true}], keep_ids: [1, 992], keep: 'synthetic'
  }};
  const expected = {code: 0, data: {list: [], show: [], keep_ids: [], keep: 'synthetic'}};
  const output = invokeJSON(root);
  assert.deepEqual(output.value, expected);
  expectUnchanged(invokeJSON(output.body));
});

test('brand wallpaper endpoint and ordinary splash are preserved', () => {
  const root = {code: 0, data: {list: [{id: 1, source: 935, is_ad: true}], show: [{id: 1}], keep_ids: [1]}};
  expectUnchanged(invokeJSON(root, 'https://app.bilibili.com/x/v2/splash/brand/list'));
  for (const list of [[], [{id: 1, wallpaper: true}], [{id: 1, source: 935}], [{id: 1, ad_cb: '', cm_mark: ''}]]) {
    expectUnchanged(invokeJSON({code: 0, data: {list, show: [{id: 991}], keep_ids: [992]}}));
  }
});

test('feed requires explicit advertising identity', () => {
  const root = {code: 0, data: {items: [
    {id: 1, card_goto: 'ad', ad_info: {synthetic: true}},
    {id: 2, goto: 'ad_av', ad_info: {synthetic: true}},
    {id: 3, goto: 'ad_player', ad_info: {synthetic: true}},
    {id: 4, is_ad: true}, {id: 5, is_ad: 1},
    {id: 6, card_goto: 'av', ad_info: {synthetic: true}},
    {id: 7, card_goto: 'ad'}, {id: 8, card_goto: 'ad', ad_info: {}},
    {id: 9, goto: 'ad_av', ad_info: null}, {id: 10, is_ad: '1'},
    {id: 11, goto: 'unknown'}, {id: 12, goto: 'av', title: 'synthetic ordinary video'}
  ], keep: {unknown: true}}, message: 'synthetic'};
  const expected = clone(root); expected.data.items = expected.data.items.slice(5);
  const output = invokeJSON(root, FEED + '?synthetic=1');
  assert.equal(output.changed, true);
  assert.deepEqual(output.value, expected);
  expectUnchanged(invokeJSON(output.body, FEED));
});

test('JSON malformed shapes, nonzero status and endpoint boundaries fail open', () => {
  for (const root of ['{', 'null', '[]', '{}', {code: 1, data: {list: [{id: 1, is_ad: true}]}}, {code: 0, data: {list: {is_ad: true}}}]) {
    expectUnchanged(invokeJSON(root));
  }
  const root = {code: 0, data: {list: [{id: 1, is_ad: true}], items: [{is_ad: true}]}};
  for (const url of [
    SPLASH + '/child', SPLASH + 'Suffix', SPLASH + '#fragment',
    SPLASH.replace('app.bilibili.com', 'grpc.biliapi.net'),
    SPLASH.replace('app.bilibili.com', 'app.bilibili.com.evil.example'),
    SPLASH.replace('app.bilibili.com', 'app.bilibili.com@evil.example'),
    FEED + '/child', 'https://api.bilibili.com/x/v2/feed/index'
  ]) expectUnchanged(invokeJSON(root, url));
  expectUnchanged(invokeBinary(frame(relate([content(5)])), SPLASH));
  assert.equal(Object.keys(execute(BINARY, {body: JSON.stringify(root)})).length, 0);
  assert.equal(Object.keys(execute(SPLASH, {})).length, 0);
});

for (const {name, run} of cases) {
  try { run(); } catch (error) {
    error.message = name + ': ' + error.message;
    throw error;
  }
}
console.log('BilibiliAppAds: ' + cases.length + ' synthetic preservation, protobuf, gzip, frame and JSON checks passed');
