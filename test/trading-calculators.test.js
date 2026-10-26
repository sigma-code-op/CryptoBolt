import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(ROOT, 'js/trading-calculators.js'), 'utf8');

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

test('position size: $5,000 balance, 1% risk, 65,000 entry, 63,700 stop', () => {
  const e = makeEnv({ 'ps-balance': '5000', 'ps-risk': '1', 'ps-entry': '65000', 'ps-stop': '63700', 'ps-lev': '5' });
  assert.equal(e['ps-out-risk'].textContent, '$50.00');
  assert.equal(e['ps-out-notional'].textContent, '$2,500.00');
  assert.equal(e['ps-out-margin'].textContent, '$500.00');
  assert.equal(e['ps-out-r1'].textContent, '$66,300.00');
  assert.equal(e['ps-out-r3'].textContent, '$68,900.00');
});

test('profit: 10x long 60,000 -> 63,000 with $1,000 margin and 0.05% fees', () => {
  const e = makeEnv({ 'pf-entry': '60000', 'pf-exit': '63000', 'pf-margin': '1000', 'pf-lev': '10', 'pf-fee': '0.05' });
  assert.equal(e['pf-out-gross'].textContent, '+$500.00');
  assert.equal(e['pf-out-fees'].textContent, '$10.25');
  assert.equal(e['pf-out-net'].textContent, '+$489.75');
  assert.equal(e['pf-out-roe'].textContent, '+48.98%');
});

test('funding: $10,000 long, 0.01% per 8h for 7 days', () => {
  const e = makeEnv({ 'ff-notional': '10000', 'ff-rate': '0.01', 'ff-interval': '8', 'ff-days': '7' });
  assert.equal(e['ff-out-pay'].textContent, '$1.00');
  assert.equal(e['ff-out-day'].textContent, '$3.00');
  assert.equal(e['ff-out-month'].textContent, '$90.00');
  assert.equal(e['ff-out-total'].textContent, '-$21.00');
  assert.equal(e['ff-out-apr'].textContent, '10.95%');
});