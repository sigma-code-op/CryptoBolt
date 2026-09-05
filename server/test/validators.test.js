import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContext, validateContact, validateAiCallLog } from '../src/validators.js';

// ---------- validateContext ----------

const validContext = {
  asset: 'BTCUSDT',
  market: 'spot',
  interval: '1h',
  price: 65000.5,
  change24hPct: 1.23,
  high24h: 66000,
  low24h: 64000,
  volume24hUSDT: 1234567,
  recentSwingHigh: 66500,
  recentSwingLow: 63500,
  ma7: 64800,
  ma25: 64200,
  rsi14: 55.5,
  recentClosesTrend: [64000, 64100, 64200],
};

test('validateContext accepts a well-formed payload', () => {
  assert.equal(validateContext(validContext), null);
});

test('validateContext rejects a missing context', () => {
  assert.match(validateContext(undefined), /Missing market context/);
  assert.match(validateContext(null), /Missing market context/);
  assert.match(validateContext('nope'), /Missing market context/);
});

test('validateContext rejects a missing/invalid required string field', () => {
  const { asset, ...rest } = validContext;
  assert.match(validateContext(rest), /Invalid field: asset/);
  assert.match(validateContext({ ...validContext, market: 123 }), /Invalid field: market/);
});

test('validateContext rejects an out-of-range required string field', () => {
  assert.match(validateContext({ ...validContext, asset: 'X'.repeat(41) }), /Invalid field: asset/);
});

test('validateContext rejects a missing/invalid required number field', () => {
  assert.match(validateContext({ ...validContext, price: 'free' }), /Invalid field: price/);
  assert.match(validateContext({ ...validContext, price: NaN }), /Invalid field: price/);
});

test('validateContext accepts null for nullable indicator fields', () => {
  assert.equal(validateContext({ ...validContext, ma7: null, ma25: null, rsi14: null }), null);
});

test('validateContext rejects a non-array recentClosesTrend', () => {
  assert.match(validateContext({ ...validContext, recentClosesTrend: 'not-an-array' }), /recentClosesTrend/);
});

test('validateContext rejects recentClosesTrend longer than 60 entries', () => {
  const tooLong = Array.from({ length: 61 }, (_, i) => i);
  assert.match(validateContext({ ...validContext, recentClosesTrend: tooLong }), /recentClosesTrend/);
});

test('validateContext validates optional volumeTrend enum', () => {
  assert.equal(validateContext({ ...validContext, volumeTrend: 'rising' }), null);
  assert.match(validateContext({ ...validContext, volumeTrend: 'sideways' }), /volumeTrend/);
});

test('validateContext validates optional mtf rows', () => {
  const withMtf = { ...validContext, mtf: [{ tf: '4h', trend: 'up', pct: 2.5 }] };
  assert.equal(validateContext(withMtf), null);
  const badMtf = { ...validContext, mtf: [{ tf: '4h', trend: 'up', pct: 'two' }] };
  assert.match(validateContext(badMtf), /mtf\[\]\.pct/);
});

test('validateContext rejects more than 5 mtf rows', () => {
  const tooMany = Array.from({ length: 6 }, () => ({ tf: '1h', trend: 'up', pct: 1 }));
  assert.match(validateContext({ ...validContext, mtf: tooMany }), /Invalid field: mtf/);
});

// ---------- validateContact ----------

const validContact = {
  name: 'Jane Trader',
  email: 'jane@example.com',
  topic: 'Bug report',
  message: 'The order book stopped updating on BTCUSDT futures.',
  company: '', // honeypot, left empty by real users
};

test('validateContact accepts a well-formed submission', () => {
  assert.equal(validateContact(validContact), null);
});

test('validateContact rejects a missing body', () => {
  assert.match(validateContact(undefined), /Missing form data/);
});

test('validateContact rejects when the honeypot field is filled in', () => {
  assert.match(validateContact({ ...validContact, company: 'I am a bot' }), /Submission rejected/);
});

test('validateContact rejects an empty or overlong name', () => {
  assert.match(validateContact({ ...validContact, name: '' }), /name/i);
  assert.match(validateContact({ ...validContact, name: 'X'.repeat(101) }), /name/i);
});

test('validateContact rejects a malformed email address', () => {
  assert.match(validateContact({ ...validContact, email: 'not-an-email' }), /email/i);
  assert.match(validateContact({ ...validContact, email: '' }), /email/i);
});

test('validateContact rejects a topic outside the allowed list', () => {
  assert.match(validateContact({ ...validContact, topic: 'Free money' }), /topic/i);
});

test('validateContact rejects a too-short or too-long message', () => {
  assert.match(validateContact({ ...validContact, message: 'hi' }), /Message/);
  assert.match(validateContact({ ...validContact, message: 'x'.repeat(4001) }), /Message/);
});

// ---------- validateAiCallLog ----------

const validAiCall = {
  asset: 'BTC',
  market: 'spot',
  interval: '1h',
  bias: 'long-leaning',
  setupType: 'pullback-entry',
  entryLow: 64000,
  entryHigh: 64500,
  stopPrice: 63000,
  target1: 66000,
  target2: 67500,
  priceAtCall: 64200,
  atr14: 350.5,
  stopMult: 1.5,
};

test('validateAiCallLog accepts a well-formed payload', () => {
  assert.equal(validateAiCallLog(validAiCall), null);
});

test('validateAiCallLog accepts a payload with atr14/stopMult omitted', () => {
  const { atr14, stopMult, ...rest } = validAiCall;
  assert.equal(validateAiCallLog(rest), null);
});

test('validateAiCallLog rejects a missing body', () => {
  assert.match(validateAiCallLog(undefined), /Missing call data/);
});

test('validateAiCallLog rejects an invalid asset', () => {
  assert.match(validateAiCallLog({ ...validAiCall, asset: 'not-an-asset!' }), /asset/);
});

test('validateAiCallLog rejects a market outside spot\\/futures', () => {
  assert.match(validateAiCallLog({ ...validAiCall, market: 'options' }), /market/);
});

test('validateAiCallLog rejects a bias outside the allowed enum', () => {
  assert.match(validateAiCallLog({ ...validAiCall, bias: 'sideways' }), /bias/);
});

test('validateAiCallLog rejects a setupType outside the allowed enum', () => {
  assert.match(validateAiCallLog({ ...validAiCall, setupType: 'no-setup' }), /setupType/);
});

test('validateAiCallLog rejects non-positive or non-finite numeric fields', () => {
  assert.match(validateAiCallLog({ ...validAiCall, entryLow: 0 }), /entryLow/);
  assert.match(validateAiCallLog({ ...validAiCall, stopPrice: -5 }), /stopPrice/);
  assert.match(validateAiCallLog({ ...validAiCall, target1: NaN }), /target1/);
  assert.match(validateAiCallLog({ ...validAiCall, priceAtCall: '64200' }), /priceAtCall/);
});