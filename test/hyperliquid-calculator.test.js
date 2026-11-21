import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ Number, Math, Infinity, isFinite });
ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/hyperliquid-calculator.js'), 'utf8'), ctx);
const { compute } = ctx.CBHyperliquid;
const base = { side: 'long', balance: 5000, risk: 1, entry: 65000, stop: 63700, maxLev: 40, lev: 10, fundRate: 0.00125, hours: 24 };
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('sizes the position from risk and stop distance', () => {
  const r = compute(base);
  assert.ok(r.ok);
  near(r.riskAmt, 50);
  near(r.units, 50 / 1300, 1e-9);
  near(r.notional, 2500);
  near(r.margin, 250);
});

test('maintenance margin is half the initial margin at max leverage (1.25% at 40x, 16.7% at 3x)', () => {
  near(compute(base).mmr, 0.0125, 1e-9);
  near(compute({ ...base, maxLev: 3, lev: 3 }).mmr, 1 / 6, 1e-9);
});

test('long liquidation price matches the documented formula', () => {
  // entry*(1 - (1/lev - mmr)/(1 - mmr)) for a long
  const r = compute(base);
  near(r.liq, 65000 * (1 - (0.1 - 0.0125) / (1 - 0.0125)), 0.01);
  assert.ok(!r.liqFirst);
  assert.ok(r.ratio > 4);
});

test('short liquidation price is above entry and uses (1 + mmr)', () => {
  const r = compute({ ...base, side: 'short', stop: 66300 });
  near(r.liq, 65000 * (1 + (0.1 - 0.0125) / (1 + 0.0125)), 0.01);
  assert.ok(r.liq > 65000);
});

test('warns when liquidation comes before the stop', () => {
  const r = compute({ ...base, lev: 40, stop: 60000, risk: 0.5 });
  assert.ok(r.liqFirst);
  assert.ok(r.warn.includes('liq-first'));
});

test('caps leverage at the asset max and flags it', () => {
  const r = compute({ ...base, maxLev: 10, lev: 25 });
  assert.strictEqual(r.lev, 10);
  assert.ok(r.warn.includes('lev-capped'));
});

test('funding is paid by longs and received by shorts at a positive rate', () => {
  near(compute(base).fund, 2500 * 0.0000125 * 24, 1e-6);
  assert.ok(compute({ ...base, side: 'short', stop: 66300 }).fund < 0);
});

test('rejects bad input', () => {
  assert.strictEqual(compute({ ...base, stop: 65000 }).error, 'stop-equals-entry');
  assert.strictEqual(compute({ ...base, stop: 66000 }).error, 'stop-wrong-side');
  assert.strictEqual(compute({ ...base, balance: NaN }).error, 'invalid');
  assert.strictEqual(compute({ ...base, risk: 100 }).error, 'invalid');
});