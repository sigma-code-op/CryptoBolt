import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(ROOT, 'js/altcoin-profit.js'), 'utf8');

function makeEnv(values) {
  const els = {};
  const get = (id) => {
    if (!(id in els)) {
      const cls = new Set();
      els[id] = {
        id, value: values[id] ?? '', textContent: '', listeners: {},
        classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) },
        addEventListener(t, f) { this.listeners[t] = f; },
      };
    }
    return els[id];
  };
  const present = new Set(Object.keys(values));
  const document = {
    readyState: 'complete', addEventListener() {},
    getElementById: (id) => (present.has(id) || /-(out|warning)/.test(id) ? get(id) : null),
  };
  vm.runInNewContext(src, { document, Number, Math, String, parseFloat });
  return els;
}
const base = { 'ap-amount': '1000', 'ap-buy': '1.5', 'ap-sell': '2.4', 'ap-fee': '0.1', 'ap-target': '50' };

test('profit: $1,000 at 1.50 sold at 2.40, 0.1% fee per side', () => {
  const e = makeEnv(base);
  assert.equal(e['ap-out-profit'].textContent, '+$596.80');
  assert.equal(e['ap-out-units'].textContent, '666');
  assert.equal(e['ap-out-roi'].textContent, '+59.68%');
  assert.equal(e['ap-out-fees'].textContent, '$2.60');
  assert.equal(e['ap-out-be'].textContent, '$1.5030');
  assert.equal(e['ap-out-target'].textContent, '$2.2545');
});

test('loss: -50% move costs slightly more than half after fees', () => {
  const e = makeEnv({ ...base, 'ap-buy': '1', 'ap-sell': '0.5' });
  assert.equal(e['ap-out-profit'].textContent, '-$501.00');
  assert.equal(e['ap-out-roi'].textContent, '-50.10%');
  assert.ok(e['ap-out-profit'].classList.contains('lc-neg'));
});

test('invalid input clears results and fee >= 50% warns', () => {
  const e = makeEnv({ ...base, 'ap-buy': '' });
  assert.equal(e['ap-out-profit'].textContent, '--');
  const w = makeEnv({ ...base, 'ap-fee': '60' });
  assert.match(w['ap-warning'].textContent, /below 50%/);
});