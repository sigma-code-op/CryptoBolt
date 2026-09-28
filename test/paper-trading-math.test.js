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
// ---------------------------------------------------------------------------
// computeSlippageBps / estimateFillPrice (execution realism)
// ---------------------------------------------------------------------------

test('computeSlippageBps: small orders sit at the floor', () => {
  assert.equal(pt.computeSlippageBps(10), 2);
  assert.equal(pt.computeSlippageBps(0), 2);
});

test('computeSlippageBps: grows past the reference notional', () => {
  const small = pt.computeSlippageBps(5000);
  const big = pt.computeSlippageBps(500000);
  assert.equal(small, 2); // at the reference notional itself, still at the floor
  assert.ok(big > small, `expected larger-order slippage (${big}) to exceed smaller (${small})`);
});

test('computeSlippageBps: caps at the max for extreme size', () => {
  assert.equal(pt.computeSlippageBps(999999999), 150);
});

test('estimateFillPrice: buy pays at/above the ask', () => {
  const fill = pt.estimateFillPrice('buy', 100, 99.9, 100.1, 1000);
  assert.ok(fill >= 100.1, `expected buy fill (${fill}) >= ask (100.1)`);
});

test('estimateFillPrice: sell receives at/below the bid', () => {
  const fill = pt.estimateFillPrice('sell', 100, 99.9, 100.1, 1000);
  assert.ok(fill <= 99.9, `expected sell fill (${fill}) <= bid (99.9)`);
});

test('estimateFillPrice: a bigger order slips further from the quote than a small one', () => {
  const small = pt.estimateFillPrice('buy', 100, 99.9, 100.1, 100);
  const big = pt.estimateFillPrice('buy', 100, 99.9, 100.1, 1000000);
  assert.ok(big > small, `expected larger order fill (${big}) to slip further than small order (${small})`);
});

test('estimateFillPrice: falls back to reference price when bid/ask are missing', () => {
  assert.equal(pt.estimateFillPrice('buy', 100, 0, 0, 0), pt.estimateFillPrice('buy', 100, null, null, 0));
});

// ---------------------------------------------------------------------------
// Funding fees
// ---------------------------------------------------------------------------

const H = 60 * 60 * 1000;
const utc = (iso) => Date.parse(iso);

test('countFundingSettlements: counts 00:00/08:00/16:00 UTC boundaries in (from, to]', () => {
  // Same 8h window -> nothing
  assert.equal(pt.countFundingSettlements(utc('2026-09-28T08:01:00Z'), utc('2026-09-28T15:59:00Z')), 0);
  // Crossing 08:00 exactly once
  assert.equal(pt.countFundingSettlements(utc('2026-09-28T07:59:59Z'), utc('2026-09-28T08:00:01Z')), 1);
  // A boundary exactly at `to` counts, one exactly at `from` does not (already settled)
  assert.equal(pt.countFundingSettlements(utc('2026-09-28T07:00:00Z'), utc('2026-09-28T08:00:00Z')), 1);
  assert.equal(pt.countFundingSettlements(utc('2026-09-28T08:00:00Z'), utc('2026-09-28T09:00:00Z')), 0);
  // A full day always crosses three
  assert.equal(pt.countFundingSettlements(utc('2026-09-28T03:30:00Z'), utc('2026-09-29T03:30:00Z')), 3);
});

test('countFundingSettlements: zero or negative spans are 0', () => {
  assert.equal(pt.countFundingSettlements(1000, 1000), 0);
  assert.equal(pt.countFundingSettlements(2000, 1000), 0);
});

test('computeFundingCharge: positive rate -> longs pay, shorts receive', () => {
  // $10,000 notional at 0.01% = $1
  assert.ok(Math.abs(pt.computeFundingCharge('long', 10000, 0.0001) - 1) < 1e-9);
  assert.ok(Math.abs(pt.computeFundingCharge('short', 10000, 0.0001) + 1) < 1e-9);
});

test('computeFundingCharge: negative rate flips who pays', () => {
  assert.ok(Math.abs(pt.computeFundingCharge('long', 10000, -0.0002) + 2) < 1e-9);
  assert.ok(Math.abs(pt.computeFundingCharge('short', 10000, -0.0002) - 2) < 1e-9);
});

test('computeFundingCharge: matches the blog worked example ($10,000 long, 0.01%/8h = ~$1,095/yr)', () => {
  const perYear = pt.computeFundingCharge('long', 10000, 0.0001) * 3 * 365;
  assert.ok(Math.abs(perYear - 1095) < 1e-6);
});

test('effectiveLiqPrice: funding paid pulls the liquidation price toward the market', () => {
  // Long: liq below entry, moves UP when funding is paid
  assert.equal(pt.effectiveLiqPrice('long', 90, 2, 10), 95);
  // Short: liq above entry, moves DOWN when funding is paid
  assert.equal(pt.effectiveLiqPrice('short', 110, 2, 10), 105);
});

test('effectiveLiqPrice: net funding received pushes liquidation further away; none leaves it alone', () => {
  assert.equal(pt.effectiveLiqPrice('long', 90, 2, -10), 85);
  assert.equal(pt.effectiveLiqPrice('long', 90, 2, 0), 90);
  assert.equal(pt.effectiveLiqPrice('long', 90, 2, undefined), 90);
});

test('effectiveLiqPrice: agrees with reducing the margin directly', () => {
  // 10x long, entry 100, qty 10 (notional 1000, margin 100). Original liq via the shipped formula.
  const liq = pt.estimateLiqPrice('long', 100, 10);
  const funding = 20; // margin effectively 80
  // Liquidates when loss = margin - maintenance; loss = (entry - p) * qty
  const maintenance = 0.004 * 1000;
  const expected = 100 - (100 - funding - maintenance) / 10;
  assert.ok(Math.abs(pt.effectiveLiqPrice('long', liq, 10, funding) - expected) < 1e-9);
});

// ---------------------------------------------------------------------------
// Closed-trade detection + performance stats
// ---------------------------------------------------------------------------

test('isClosingTrade: spot sells and every futures exit type count; opens and buys do not', () => {
  assert.equal(pt.isClosingTrade({ side: 'sell', type: 'market' }), true);
  assert.equal(pt.isClosingTrade({ side: 'long', type: 'close' }), true);
  assert.equal(pt.isClosingTrade({ side: 'short', type: 'liquidated' }), true);
  assert.equal(pt.isClosingTrade({ side: 'long', type: 'open' }), false);
  assert.equal(pt.isClosingTrade({ side: 'buy', type: 'market' }), false);
});

test('isClosingTrade: REGRESSION - futures take-profit and stop-loss exits are closing trades', () => {
  // These used to be excluded, so wins/losses closed via TP/SL never reached the win rate.
  assert.equal(pt.isClosingTrade({ side: 'long', type: 'tp' }), true);
  assert.equal(pt.isClosingTrade({ side: 'short', type: 'sl' }), true);
});

test('computePerformanceStats: no closed trades -> nulls, not NaN', () => {
  const s = pt.computePerformanceStats([{ side: 'buy', type: 'market' }, { side: 'long', type: 'open' }], []);
  assert.equal(s.closedCount, 0);
  assert.equal(s.winRate, null);
  assert.equal(s.profitFactor, null);
  assert.equal(s.expectancy, null);
  assert.equal(s.bestTrade, null);
});

test('computePerformanceStats: win rate, profit factor, averages and expectancy', () => {
  const trades = [
    { side: 'sell', type: 'market', realizedPnl: 300 },
    { side: 'long', type: 'tp', realizedPnl: 100 },     // futures TP win (previously ignored)
    { side: 'short', type: 'sl', realizedPnl: -100 },    // futures SL loss (previously ignored)
    { side: 'long', type: 'liquidated', realizedPnl: -200 },
    { side: 'long', type: 'open', realizedPnl: null },   // opens never count
  ];
  const s = pt.computePerformanceStats(trades, []);
  assert.equal(s.closedCount, 4);
  assert.equal(s.wins, 2);
  assert.equal(s.losses, 2);
  assert.equal(s.winRate, 50);
  assert.equal(s.avgWin, 200);
  assert.equal(s.avgLoss, 150);
  assert.equal(s.profitFactor, 400 / 300);
  assert.equal(s.expectancy, 25); // (300+100-100-200)/4
  assert.equal(s.bestTrade, 300);
  assert.equal(s.worstTrade, -200);
});

test('computePerformanceStats: all winners -> Infinity profit factor; break-even trades are neither win nor loss', () => {
  const allWins = pt.computePerformanceStats([{ side: 'sell', realizedPnl: 50 }, { side: 'sell', realizedPnl: 10 }], []);
  assert.equal(allWins.profitFactor, Infinity);
  assert.equal(allWins.winRate, 100);
  const flat = pt.computePerformanceStats([{ side: 'sell', realizedPnl: 0 }], []);
  assert.equal(flat.wins, 0);
  assert.equal(flat.losses, 0);
  assert.equal(flat.closedCount, 1);
  assert.equal(flat.profitFactor, null);
});

test('computeMaxDrawdown: peak-to-trough percentage, recovers do not erase it', () => {
  const curve = [
    { equity: 10000 }, { equity: 12000 }, { equity: 9000 }, { equity: 13000 }, { equity: 12500 },
  ];
  // Worst fall: 12000 -> 9000 = 25%; later 13000 -> 12500 is only ~3.8%
  assert.ok(Math.abs(pt.computeMaxDrawdown(curve) - 25) < 1e-9);
});

test('computeMaxDrawdown: rising, empty, or junk curves give 0', () => {
  assert.equal(pt.computeMaxDrawdown([{ equity: 1 }, { equity: 2 }, { equity: 3 }]), 0);
  assert.equal(pt.computeMaxDrawdown([]), 0);
  assert.equal(pt.computeMaxDrawdown(undefined), 0);
  assert.equal(pt.computeMaxDrawdown([{ equity: 0 }, { equity: NaN }, null]), 0);
});