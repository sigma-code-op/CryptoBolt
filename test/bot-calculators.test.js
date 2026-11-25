import test from 'node:test';
import assert from 'node:assert';
import { loadCalc } from '../scripts/load-calc.mjs';

const grid = loadCalc('js/grid-bot.js', 'CBGrid');
const dca = loadCalc('js/dca-bot.js', 'CBDcaBot');
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const g0 = { lower: 50000, upper: 70000, grids: 20, invest: 10000, price: 60000, fee: 0.1, mode: 'arithmetic', cyclesPerDay: 3 };

test('grid: lines are evenly spaced (arithmetic) and equally proportioned (geometric)', () => {
  const a = grid.lines(50000, 70000, 20, 'arithmetic');
  near(a[1] - a[0], 1000); near(a[20], 70000);
  const g = grid.lines(50000, 70000, 20, 'geometric');
  near(g[1] / g[0], g[11] / g[10], 1e-9);
});

test('grid: orders plus starting coin cost the investment, start value is close to investment', () => {
  const r = grid.compute(g0);
  assert.ok(r.ok);
  near(r.scen[2].pnl, -5.23, 0.05); // only the entry fee on the starting coin
  assert.strictEqual(r.buys + r.sells, 20);
});

test('grid: net profit per cycle is the step minus round-trip fees', () => {
  const r = grid.compute({ ...g0, mode: 'geometric' });
  const step = Math.pow(70000 / 50000, 1 / 20);
  near(r.minNetPct, ((step * 0.999) / 1.001 - 1) * 100, 1e-6);
});

test('grid: a step smaller than the round-trip fee loses money and warns', () => {
  const r = grid.compute({ ...g0, grids: 500, fee: 0.2 });
  assert.ok(r.warn.includes('step-below-fees'));
  assert.ok(r.minNetPct < 0);
});

test('grid: leaving the range downward hurts, upward caps the profit below holding', () => {
  const r = grid.compute(g0);
  assert.ok(r.scen[1].pnl < 0);
  assert.ok(r.scen[3].pnl > 0);
  assert.ok(r.scen[3].value < r.scen[3].hodl);
  assert.ok(r.scen[1].value > r.scen[1].hodl);
  near(r.scen[4].value, r.scen[3].value, 1e-6);
});

test('grid: rejects a price outside the range and bad inputs', () => {
  assert.strictEqual(grid.compute({ ...g0, price: 80000 }).error, 'price-outside');
  assert.strictEqual(grid.compute({ ...g0, grids: 1 }).error, 'invalid');
  assert.strictEqual(grid.compute({ ...g0, upper: 40000 }).error, 'invalid');
});

const d0 = { side: 'long', entry: 100, base: 100, so: 200, count: 5, dev: 1.5, stepScale: 1.2, volScale: 1.5, tp: 1.5, fee: 0.1, lev: 1, mmr: 0.5 };

test('dca bot: safety order prices and sizes follow the step and volume scales', () => {
  const r = dca.compute(d0);
  near(r.rows[1].dev, 1.5); near(r.rows[2].dev, 1.5 + 1.8); near(r.rows[3].dev, 1.5 + 1.8 + 2.16);
  near(r.rows[1].size, 200); near(r.rows[2].size, 300); near(r.rows[3].size, 450);
  near(r.capital, 100 + 200 + 300 + 450 + 675 + 1012.5);
});

test('dca bot: average entry is the volume-weighted average and take profit sits above it', () => {
  const r = dca.compute(d0);
  const last = r.rows[5];
  near(last.avg, last.cost / r.units, 1e-9);
  near(last.tpPrice, last.avg * 1.015, 1e-9);
  assert.ok(last.avg > last.price);
});

test('dca bot: scale of 1 gives equal steps and equal sizes', () => {
  const r = dca.compute({ ...d0, stepScale: 1, volScale: 1 });
  near(r.rows[4].dev, 6); near(r.rows[4].size, 200);
});

test('dca bot: short side mirrors the ladder upward', () => {
  const r = dca.compute({ ...d0, side: 'short' });
  assert.ok(r.rows[1].price > 100);
  assert.ok(r.rows[5].tpPrice < r.rows[5].avg);
});

test('dca bot: high leverage warns when liquidation comes before the ladder finishes', () => {
  const r = dca.compute({ ...d0, lev: 50 });
  assert.ok(r.warn.includes('liq-before-so'));
  assert.ok(r.liqAtOrder > 0);
});

test('dca bot: rejects invalid input', () => {
  assert.strictEqual(dca.compute({ ...d0, count: 0 }).error, 'invalid');
  assert.strictEqual(dca.compute({ ...d0, dev: 120 }).error, 'invalid');
});