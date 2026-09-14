import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPaperTradingMath } from './helpers/load-paper-trading.js';

const pt = loadPaperTradingMath();

// ---------------------------------------------------------------------------
// computeFee
// ---------------------------------------------------------------------------

test('computeFee: 0.1% of value', () => {
  assert.equal(pt.computeFee(10000, 0.001), 10);
  assert.equal(pt.computeFee(0, 0.001), 0);
});

// ---------------------------------------------------------------------------
// computeBuyAvgCost
// ---------------------------------------------------------------------------

test('computeBuyAvgCost: opening a fresh position (existingQty = 0)', () => {
  // Buy 1 BTC at $50,000, 0.1% fee ($50) -> avg cost = (50000 + 50) / 1
  const avg = pt.computeBuyAvgCost(0, 0, 1, 50000, 50);
  assert.equal(avg, 50050);
});

test('computeBuyAvgCost: topping up an existing position blends cost basis by quantity', () => {
  // Already hold 1 BTC @ 50,050 avg cost. Buy 1 more BTC at $60,000 (fee $60).
  // New avg = (1*50050 + 60000 + 60) / 2 = 55055
  const avg = pt.computeBuyAvgCost(1, 50050, 1, 60000, 60);
  assert.equal(avg, 55055);
});

test('computeBuyAvgCost: unequal quantities weight correctly', () => {
  // Hold 3 ETH @ 2000 avg cost. Buy 1 more ETH at 3000 (fee 3).
  // New avg = (3*2000 + 3000 + 3) / 4 = 2250.75
  const avg = pt.computeBuyAvgCost(3, 2000, 1, 3000, 3);
  assert.equal(avg, 2250.75);
});

// ---------------------------------------------------------------------------
// computeRealizedPnl
// ---------------------------------------------------------------------------

test('computeRealizedPnl: profit when proceeds exceed cost basis', () => {
  // Sold for $1000 net of fee, cost basis was $800 -> +$200
  assert.equal(pt.computeRealizedPnl(1000, 800), 200);
});

test('computeRealizedPnl: loss when proceeds are below cost basis', () => {
  assert.equal(pt.computeRealizedPnl(700, 800), -100);
});

test('computeRealizedPnl: breakeven', () => {
  assert.equal(pt.computeRealizedPnl(800, 800), 0);
});

// ---------------------------------------------------------------------------
// futuresPnl
// ---------------------------------------------------------------------------

test('futuresPnl: long position gains when mark price rises', () => {
  const position = { side: 'long', entryPrice: 100, qty: 2 };
  assert.equal(pt.futuresPnl(position, 110), 20); // (110-100)*2
});

test('futuresPnl: long position loses when mark price falls', () => {
  const position = { side: 'long', entryPrice: 100, qty: 2 };
  assert.equal(pt.futuresPnl(position, 90), -20);
});

test('futuresPnl: short position gains when mark price falls', () => {
  const position = { side: 'short', entryPrice: 100, qty: 3 };
  assert.equal(pt.futuresPnl(position, 80), 60); // (100-80)*3
});

test('futuresPnl: short position loses when mark price rises', () => {
  const position = { side: 'short', entryPrice: 100, qty: 3 };
  assert.equal(pt.futuresPnl(position, 120), -60);
});

// ---------------------------------------------------------------------------
// estimateLiqPrice
// ---------------------------------------------------------------------------

test('estimateLiqPrice: long liquidates below entry, short above entry', () => {
  const longLiq = pt.estimateLiqPrice('long', 100, 10);
  const shortLiq = pt.estimateLiqPrice('short', 100, 10);
  assert.ok(longLiq < 100, 'long liq price should be below entry');
  assert.ok(shortLiq > 100, 'short liq price should be above entry');
});

test('estimateLiqPrice: higher leverage moves the liquidation price closer to entry', () => {
  const lowLevLiq = pt.estimateLiqPrice('long', 100, 5);
  const highLevLiq = pt.estimateLiqPrice('long', 100, 25);
  // Both are below entry (long), but 25x should liquidate at a HIGHER price (closer to entry,
  // i.e. less room to move) than 5x — less margin cushion per dollar of notional at higher leverage.
  assert.ok(highLevLiq > lowLevLiq, `expected 25x liq (${highLevLiq}) closer to entry than 5x liq (${lowLevLiq})`);
});

test('estimateLiqPrice: matches the hand-computed isolated-margin formula at 10x long', () => {
  // cushion = (1/10) - 0.004 = 0.096 -> liq = 100 * (1 - 0.096) = 90.4
  assert.equal(pt.estimateLiqPrice('long', 100, 10), 90.4);
});

test('estimateLiqPrice: matches the hand-computed isolated-margin formula at 10x short', () => {
  // cushion = 0.096 -> liq = 100 * (1 + 0.096) = 109.6 (float math lands a hair off exact)
  assert.ok(Math.abs(pt.estimateLiqPrice('short', 100, 10) - 109.6) < 1e-9);
});

test('estimateLiqPrice: extreme leverage edge case (cushion <= 0) still returns a sane one-sided price', () => {
  // At leverage where 1/leverage <= MAINTENANCE_MARGIN_RATE (0.004), i.e. leverage >= 250,
  // the formula falls back to a fixed 0.1% buffer rather than a negative/zero cushion.
  assert.equal(pt.estimateLiqPrice('long', 100, 300), 100.1);
  assert.equal(pt.estimateLiqPrice('short', 100, 300), 99.9);
});