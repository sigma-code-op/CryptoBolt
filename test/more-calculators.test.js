import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(ROOT, 'js/more-calculators.js'), 'utf8');

// Minimal DOM stub: elements keyed by id, with value/textContent/classList/listeners.
function makeEnv(values) {
  const els = {};
  const get = (id) => {
    if (!(id in els)) {
      const cls = new Set();
      els[id] = {
        id, value: values[id] ?? '', textContent: '', listeners: {},
        classList: { toggle: (c, on) => (on === undefined ? (cls.has(c) ? cls.delete(c) : cls.add(c)) : on ? cls.add(c) : cls.delete(c)), add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
        setAttribute() {}, addEventListener(t, f) { this.listeners[t] = f; },
      };
    }
    return els[id];
  };
  const present = new Set(Object.keys(values));
  const document = {
    readyState: 'complete', addEventListener() {},
    getElementById: (id) => (present.has(id) || /-(out|side|warning)/.test(id) ? get(id) : null),
  };
  vm.runInNewContext(src, { document, Number, Math, String, parseFloat });
  return els;
}

test('dca: $200 x 10 buys, price falls linearly 50,000 -> 40,000', () => {
  const e = makeEnv({ 'dc-amount': '200', 'dc-count': '10', 'dc-start': '50000', 'dc-end': '40000' });
  assert.equal(e['dc-out-invested'].textContent, '$2,000.00');
  assert.equal(e['dc-out-avg'].textContent, '$44,772.77');
  assert.equal(e['dc-out-main'].textContent, '$1,786.80');
  assert.equal(e['dc-out-roi'].textContent, '-10.66%');
  assert.equal(e['dc-out-lump'].textContent, '$1,600.00');
  assert.equal(e['dc-out-lumproi'].textContent, '-20.00%');
});

test('dca: a single buy equals the lump sum', () => {
  const e = makeEnv({ 'dc-amount': '500', 'dc-count': '1', 'dc-start': '100', 'dc-end': '150' });
  assert.equal(e['dc-out-roi'].textContent, '+50.00%');
  assert.equal(e['dc-out-lumproi'].textContent, '+50.00%');
});

test('average price: three buys and a current price', () => {
  const e = makeEnv({ 'av-p1': '60000', 'av-q1': '0.1', 'av-p2': '50000', 'av-q2': '0.2', 'av-p3': '40000', 'av-q3': '0.3',
    'av-p4': '', 'av-q4': '', 'av-p5': '', 'av-q5': '', 'av-current': '55000' });
  assert.equal(e['av-out-avg'].textContent, '$46,666.67');
  assert.equal(e['av-out-qty'].textContent, '0.6');
  assert.equal(e['av-out-cost'].textContent, '$28,000.00');
  assert.equal(e['av-out-pnl'].textContent, '+$5,000.00');
  assert.equal(e['av-out-pct'].textContent, '+17.86%');
});

test('risk reward: long 100, stop 95, target 115 is 1:3 with a 25% break-even win rate', () => {
  const e = makeEnv({ 'rr-entry': '100', 'rr-stop': '95', 'rr-target': '115', 'rr-winrate': '40' });
  assert.equal(e['rr-out-ratio'].textContent, '1 : 3.00');
  assert.equal(e['rr-out-win'].textContent, '25.0%');
  assert.equal(e['rr-out-riskpct'].textContent, '5.00%');
  assert.equal(e['rr-out-rewardpct'].textContent, '15.00%');
  assert.equal(e['rr-out-ev'].textContent, '+0.60R'); // 0.4 * 3 - 0.6
});

test('risk reward: a stop on the wrong side shows a warning and no ratio', () => {
  const e = makeEnv({ 'rr-entry': '100', 'rr-stop': '105', 'rr-target': '115', 'rr-winrate': '' });
  assert.equal(e['rr-out-ratio'].textContent, '--');
  assert.match(e['rr-warning'].textContent, /below the entry/);
});

test('staking: $10,000 at 5% APR compounded daily for 3 years', () => {
  const e = makeEnv({ 'sk-principal': '10000', 'sk-apr': '5', 'sk-years': '3', 'sk-comp': '365', 'sk-contrib': '0' });
  assert.equal(e['sk-out-final'].textContent, '$11,618.22');
  assert.equal(e['sk-out-rewards'].textContent, '$1,618.22');
  assert.equal(e['sk-out-apy'].textContent, '5.13%');
});

test('staking: $5,000 + $100 a month at 6% compounded monthly for 5 years', () => {
  const e = makeEnv({ 'sk-principal': '5000', 'sk-apr': '6', 'sk-years': '5', 'sk-comp': '12', 'sk-contrib': '100' });
  assert.equal(e['sk-out-final'].textContent, '$13,721.25');
  assert.equal(e['sk-out-contrib'].textContent, '$11,000.00');
});

test('impermanent loss: price doubles on a $10,000 50/50 position', () => {
  const e = makeEnv({ 'il-change': '100', 'il-deposit': '10000', 'il-fees': '0' });
  assert.equal(e['il-out-pct'].textContent, '-5.72%');
  assert.equal(e['il-out-hold'].textContent, '$15,000.00');
  assert.equal(e['il-out-pool'].textContent, '$14,142.14');
  assert.equal(e['il-out-loss'].textContent, '-$857.86');
});

test('impermanent loss: a 4x move (+300%) costs exactly 20%', () => {
  const e = makeEnv({ 'il-change': '300', 'il-deposit': '1000', 'il-fees': '60' });
  assert.equal(e['il-out-pct'].textContent, '-20.00%');
  assert.equal(e['il-out-be'].textContent, '50.00%'); // hold $2,500 vs pool $2,000: fees of $500 break even
  assert.equal(e['il-out-net'].textContent, '+$100.00'); // $600 of fees beat the $500 gap
});

test('roi: buy 2,000 sell 2,600 with $1,000 and 0.1% fees each way', () => {
  const e = makeEnv({ 'ro-buy': '2000', 'ro-sell': '2600', 'ro-invest': '1000', 'ro-fee': '0.1' });
  assert.equal(e['ro-out-net'].textContent, '+$297.40');
  assert.equal(e['ro-out-roi'].textContent, '+29.74%');
  assert.equal(e['ro-out-fees'].textContent, '$2.30');
  assert.equal(e['ro-out-be'].textContent, '$2,004.01');
});

test('roi: a loss reports the rise needed to get back to even', () => {
  const e = makeEnv({ 'ro-buy': '2600', 'ro-sell': '2000', 'ro-invest': '1000', 'ro-fee': '0.1' });
  assert.equal(e['ro-out-net'].textContent, '-$232.31');
  assert.equal(e['ro-out-recover'].textContent, '+30.26%');
});

test('fibonacci: uptrend 50,000 -> 70,000', () => {
  const e = makeEnv({ 'fb-high': '70000', 'fb-low': '50000' });
  assert.equal(e['fb-out-l618'].textContent, '$57,640.00');
  assert.equal(e['fb-out-l50'].textContent, '$60,000.00');
  assert.equal(e['fb-out-l382'].textContent, '$62,360.00');
  assert.equal(e['fb-out-e1272'].textContent, '$75,440.00');
  assert.equal(e['fb-out-e1618'].textContent, '$82,360.00');
});

test('fibonacci: a swing high at or below the low is rejected', () => {
  const e = makeEnv({ 'fb-high': '50000', 'fb-low': '60000' });
  assert.equal(e['fb-out-l618'].textContent, '--');
  assert.match(e['fb-warning'].textContent, /greater than/);
});