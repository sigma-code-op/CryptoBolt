import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {};
vm.runInNewContext(readFileSync(path.join(ROOT, 'js/risk-models.js'), 'utf8'), ctx);
const R = ctx.CBRisk;

test('normal cdf and inverse', () => {
  assert.ok(Math.abs(R.normCdf(1.96) - 0.975) < 1e-3);
  assert.ok(Math.abs(R.normInv(0.975) - 1.95996) < 1e-3);
});

test('liquidation distance and touch probability (10x BTC-like, 7 days)', () => {
  assert.ok(Math.abs(R.liqDistance(10, 0.005) - 0.095) < 1e-12);
  const a = R.barrierLog('long', 0.095);
  const p = R.touchProb(a, 0.45, 7, 0, 'long');
  assert.ok(Math.abs(p - 0.1092) < 0.002);
  assert.ok(R.touchProb(a, 0.45, 30, 0, 'long') > p);
  assert.ok(R.touchProb(a, 0.9, 7, 0, 'long') > p);
  assert.equal(R.touchProb(0, 0.45, 7, 0, 'long'), 1);
});

test('max leverage meets the target risk and falls with volatility', () => {
  const L = R.maxLeverage(0.05, 0.45, 7, 0, 'long', 0.005);
  const a = R.barrierLog('long', R.liqDistance(L, 0.005));
  assert.ok(Math.abs(R.touchProb(a, 0.45, 7, 0, 'long') - 0.05) < 1e-4);
  assert.ok(R.maxLeverage(0.05, 0.9, 7, 0, 'long', 0.005) < L);
});

test('days to probability inverts touchProb', () => {
  const a = R.barrierLog('long', R.liqDistance(10, 0.005));
  const d = R.daysToProb(a, 0.45, 0, 'long', 0.5);
  assert.ok(Math.abs(R.touchProb(a, 0.45, d, 0, 'long') - 0.5) < 1e-4);
});

test('simulation is repeatable and risk raises ruin odds', () => {
  const base = { p: 0.4, rr: 2, n: 200, dd: 0.3, runs: 3000, seed: 7 };
  const a = R.simulate({ ...base, risk: 0.01 });
  const b = R.simulate({ ...base, risk: 0.01 });
  assert.deepEqual(a, b);
  assert.ok(R.simulate({ ...base, risk: 0.03 }).pRuin > a.pRuin);
  assert.ok(R.simulate({ ...base, risk: 0.01, cost: 0.2 }).endMedian < a.endMedian);
});

test('kelly fraction', () => {
  assert.ok(Math.abs(R.kelly(0.4, 2) - 0.1) < 1e-12);
});

test('streak probabilities are exact', () => {
  assert.ok(Math.abs(R.streakProb(0.5, 5, 2) - 19 / 32) < 1e-12); // 13 of 32 sequences have no two losses in a row
  assert.equal(R.streakProb(0.5, 3, 4), 0);
  assert.equal(R.streakAtProb(0.6, 100, 0.5), 7);
  assert.equal(R.streakAtProb(0.6, 100, 0.05), 12);
  assert.ok(Math.abs(R.streakDrawdown(0.01, 10) - 0.0956179) < 1e-6);
});