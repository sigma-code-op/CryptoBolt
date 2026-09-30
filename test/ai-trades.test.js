import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadPaperTradingMath } from './helpers/load-paper-trading.js';

// Loads the real, shipped js/ai-trades.js (it attaches cwAiTrades to globalThis when there's no window).
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../js/ai-trades.js');
vm.runInThisContext(readFileSync(src, 'utf8'), { filename: src });
const ai = globalThis.cwAiTrades;
const pt = loadPaperTradingMath();

const NOW = 1_800_000_000_000;

function makeState(over = {}) {
  return {
    cash: 5000,
    totalDeposited: 10000,
    holdings: [{ symbol: 'ETH', qty: 2, avgCost: 2000, tpPrice: null, slPrice: null }],
    trades: [],
    pendingOrders: [{ id: 'ord_1', ts: NOW - 3600000, symbol: 'SOL', side: 'buy', qty: 10, limitPrice: 90 }],
    futuresPositions: [
      {
        id: 'pos_long', ts: NOW - 7200000, symbol: 'BTC', side: 'long', entryPrice: 100, qty: 10,
        leverage: 10, margin: 100, notional: 1000, liqPrice: pt.estimateLiqPrice('long', 100, 10),
        tpPrice: null, slPrice: null, fundingPaid: 0, lastFundingTs: NOW,
      },
      {
        id: 'pos_short', ts: NOW - 7200000, symbol: 'DOGE', side: 'short', entryPrice: 0.2, qty: 5000,
        leverage: 5, margin: 200, notional: 1000, liqPrice: pt.estimateLiqPrice('short', 0.2, 5),
        tpPrice: null, slPrice: null, fundingPaid: 1.5, lastFundingTs: NOW,
      },
    ],
    ...over,
  };
}

const quotes = {
  BTC: { price: 105, bid: 104.9, ask: 105.1 },
  DOGE: { price: 0.19, bid: 0.1899, ask: 0.1901 },
  ETH: { price: 2100, bid: 2099, ask: 2101 },
  SOL: { price: 100, bid: 99.9, ask: 100.1 },
};

// ---------------------------------------------------------------------------
// Parity with the trade page: the duplicated formulas must not drift
// ---------------------------------------------------------------------------

test('parity: fee rate equals FEE_RATE in 16-paper-trading.js', () => {
  const code = readFileSync(path.resolve(here, '../js/16-paper-trading.js'), 'utf8');
  const m = code.match(/const FEE_RATE = ([0-9.]+);/);
  assert.ok(m, 'FEE_RATE constant not found in 16-paper-trading.js');
  assert.equal(ai._math.FEE_RATE, Number(m[1]));
});

test('parity: pnl, liq shift, slippage and fill price match the trade-page functions', () => {
  const positions = [
    { side: 'long', entryPrice: 100, qty: 3 },
    { side: 'short', entryPrice: 0.2, qty: 5000 },
  ];
  for (const p of positions) {
    for (const mark of [0.05, 0.19, 0.25, 90, 100, 120]) {
      assert.equal(ai._math.futuresPnl(p, mark), pt.futuresPnl(p, mark));
    }
  }
  for (const n of [0, 100, 5000, 250000, 1e9]) {
    assert.equal(ai._math.computeSlippageBps(n), pt.computeSlippageBps(n));
    for (const side of ['buy', 'sell']) {
      assert.equal(
        ai._math.estimateFillPrice(side, 100, 99.8, 100.2, n),
        pt.estimateFillPrice(side, 100, 99.8, 100.2, n)
      );
      assert.equal(ai._math.estimateFillPrice(side, 100, 0, 0, n), pt.estimateFillPrice(side, 100, 0, 0, n));
    }
  }
  for (const side of ['long', 'short']) {
    assert.equal(ai._math.effectiveLiqPrice(side, 90, 10, 2.5), pt.effectiveLiqPrice(side, 90, 10, 2.5));
    assert.equal(ai._math.effectiveLiqPrice(side, 90, 10, 0), pt.effectiveLiqPrice(side, 90, 10, 0));
  }
});

// ---------------------------------------------------------------------------
// close_futures matches what the trade page's closeFuturesPosition would do
// ---------------------------------------------------------------------------

test('close_futures: cash, fee, funding and trade-log entry match the trade-page close math', () => {
  const state = makeState();
  const p = state.futuresPositions[1]; // short DOGE, funding already paid
  const res = ai.applyAction(state, { type: 'close_futures', id: 'pos_short' }, quotes, NOW);
  assert.equal(res.ok, true, res.error);

  // Same steps as closeFuturesPosition(id, 'close') in js/16-paper-trading.js, using its own pure functions.
  const q = quotes.DOGE;
  const fill = pt.estimateFillPrice('buy', q.price, q.bid, q.ask, p.notional);
  const pnl = pt.futuresPnl(p, fill);
  const fee = fill * p.qty * 0.001;
  const net = pnl - fee - p.fundingPaid;

  assert.ok(Math.abs(state.cash - (5000 + Math.max(0, p.margin + net))) < 1e-9);
  assert.equal(state.futuresPositions.length, 1);
  assert.equal(state.futuresPositions[0].id, 'pos_long');
  const t = state.trades[0];
  assert.equal(t.type, 'close');
  assert.equal(t.side, 'short');
  assert.equal(t.leverage, 5);
  assert.ok(Math.abs(t.realizedPnl - net) < 1e-9);
  assert.ok(Math.abs(t.fee - fee) < 1e-9);
  assert.deepEqual(res.changed.sort(), ['cash', 'futuresPositions', 'trades']);
});

test('close_futures: a position already at/through liquidation cannot be closed from chat', () => {
  const state = makeState();
  const liq = state.futuresPositions[0].liqPrice;
  const res = ai.applyAction(state, { type: 'close_futures', id: 'pos_long' }, { BTC: { price: liq - 1 } }, NOW);
  assert.equal(res.ok, false);
  assert.match(res.error, /liquidation/i);
  assert.equal(state.futuresPositions.length, 2);
  assert.equal(state.cash, 5000);
});

test('close_futures: missing position or missing live price is refused without changing anything', () => {
  const state = makeState();
  assert.equal(ai.applyAction(state, { type: 'close_futures', id: 'nope' }, quotes, NOW).ok, false);
  assert.equal(ai.applyAction(state, { type: 'close_futures', id: 'pos_long' }, {}, NOW).ok, false);
  assert.equal(state.futuresPositions.length, 2);
  assert.equal(state.trades.length, 0);
});

// ---------------------------------------------------------------------------
// set_tp_sl
// ---------------------------------------------------------------------------

test('set_tp_sl: valid long levels are applied and can be cleared with null', () => {
  const state = makeState();
  let res = ai.applyAction(state, { type: 'set_tp_sl', market: 'futures', id: 'pos_long', tpPrice: 120, slPrice: 98 }, quotes, NOW);
  assert.equal(res.ok, true, res.error);
  assert.equal(state.futuresPositions[0].tpPrice, 120);
  assert.equal(state.futuresPositions[0].slPrice, 98);
  res = ai.applyAction(state, { type: 'set_tp_sl', market: 'futures', id: 'pos_long', slPrice: null }, quotes, NOW);
  assert.equal(res.ok, true);
  assert.equal(state.futuresPositions[0].slPrice, null);
  assert.equal(state.futuresPositions[0].tpPrice, 120, 'unmentioned side is left alone');
});

test('set_tp_sl: wrong-side levels are rejected for longs and shorts', () => {
  const state = makeState();
  const bad = (action) => ai.applyAction(state, action, quotes, NOW);
  assert.equal(bad({ type: 'set_tp_sl', market: 'futures', id: 'pos_long', tpPrice: 100 }).ok, false); // tp below mark
  assert.equal(bad({ type: 'set_tp_sl', market: 'futures', id: 'pos_long', slPrice: 110 }).ok, false); // sl above mark
  assert.equal(bad({ type: 'set_tp_sl', market: 'futures', id: 'pos_short', tpPrice: 0.25 }).ok, false); // tp above mark
  assert.equal(bad({ type: 'set_tp_sl', market: 'futures', id: 'pos_short', slPrice: 0.15 }).ok, false); // sl below mark
  assert.equal(state.futuresPositions[0].tpPrice, null);
});

test('set_tp_sl: a stop-loss at or beyond the liquidation price is rejected', () => {
  const state = makeState();
  const liq = state.futuresPositions[0].liqPrice; // long: ~90.4
  const res = ai.applyAction(state, { type: 'set_tp_sl', market: 'futures', id: 'pos_long', slPrice: liq - 1 }, quotes, NOW);
  assert.equal(res.ok, false);
  assert.match(res.error, /liquidation/i);
});

test('set_tp_sl: spot holdings are treated as longs', () => {
  const state = makeState();
  assert.equal(ai.applyAction(state, { type: 'set_tp_sl', market: 'spot', symbol: 'ETH', slPrice: 2200 }, quotes, NOW).ok, false);
  const ok = ai.applyAction(state, { type: 'set_tp_sl', market: 'spot', symbol: 'ETH', tpPrice: 2500, slPrice: 1900 }, quotes, NOW);
  assert.equal(ok.ok, true);
  assert.equal(state.holdings[0].tpPrice, 2500);
  assert.equal(state.holdings[0].slPrice, 1900);
  assert.deepEqual(ok.changed, ['holdings']);
});

// ---------------------------------------------------------------------------
// cancel_order + preview
// ---------------------------------------------------------------------------

test('cancel_order removes only the named order and touches no cash', () => {
  const state = makeState();
  const res = ai.applyAction(state, { type: 'cancel_order', id: 'ord_1' }, quotes, NOW);
  assert.equal(res.ok, true);
  assert.equal(state.pendingOrders.length, 0);
  assert.equal(state.cash, 5000);
  assert.equal(ai.applyAction(state, { type: 'cancel_order', id: 'ord_1' }, quotes, NOW).ok, false);
});

test('unknown action types are refused', () => {
  const state = makeState();
  assert.equal(ai.applyAction(state, { type: 'open_position' }, quotes, NOW).ok, false);
  assert.equal(ai.applyAction(state, null, quotes, NOW).ok, false);
});

test('previewAction describes a close with the estimated result and does not mutate state', () => {
  const state = makeState();
  const before = JSON.stringify(state);
  const pv = ai.previewAction(state, { type: 'close_futures', id: 'pos_long' }, quotes);
  assert.equal(pv.ok, true);
  assert.match(pv.title, /Close 10x LONG BTC/);
  assert.match(pv.detail, /Estimated result/);
  assert.equal(JSON.stringify(state), before);
});

// ---------------------------------------------------------------------------
// Snapshot sent to the AI
// ---------------------------------------------------------------------------

test('buildTradesContext: pnl, distance to liquidation and equity are computed from live prices', () => {
  const state = makeState();
  const ctx = ai.buildTradesContext(state, quotes, NOW);

  const long = ctx.futuresPositions.find((p) => p.id === 'pos_long');
  assert.equal(long.markPrice, 105);
  assert.equal(long.unrealizedPnl, 50); // (105-100)*10
  assert.equal(long.slPrice, null);
  const liq = state.futuresPositions[0].liqPrice;
  assert.ok(Math.abs(long.distanceToLiqPct - ((105 - liq) / 105) * 100) < 0.01);
  assert.equal(long.ageHours, 2);

  const short = ctx.futuresPositions.find((p) => p.id === 'pos_short');
  assert.ok(Math.abs(short.unrealizedPnl - ((0.2 - 0.19) * 5000 - 1.5)) < 0.01);

  // equity = cash + spot value + margin + futures unrealized (same formula as computeStats on the trade page)
  const expected = 5000 + 2 * 2100 + 300 + 50 + ((0.2 - 0.19) * 5000 - 1.5);
  assert.ok(Math.abs(ctx.account.equity - expected) < 0.01);

  assert.equal(ctx.pendingOrders[0].id, 'ord_1');
  assert.equal(ctx.pendingOrders[0].distancePct, -10);
  assert.equal(ctx.holdings[0].unrealizedPnl, 200);
});

test('buildTradesContext: stats only count closing trades and cap recent history', () => {
  const trades = [];
  for (let i = 0; i < 20; i++) {
    trades.push({ ts: NOW - i * 1000, symbol: 'BTC', side: 'long', type: 'close', qty: 1, price: 1, value: 1, fee: 0.1, realizedPnl: i % 2 ? -10 : 20 });
  }
  trades.push({ ts: NOW, symbol: 'BTC', side: 'buy', type: 'market', qty: 1, price: 1, value: 1, fee: 0.1, realizedPnl: null }); // opening buy: ignored
  const ctx = ai.buildTradesContext(makeState({ trades }), quotes, NOW);
  assert.equal(ctx.stats.closedCount, 20);
  assert.equal(ctx.stats.wins, 10);
  assert.equal(ctx.stats.losses, 10);
  assert.equal(ctx.stats.winRate, 50);
  assert.equal(ctx.stats.avgWin, 20);
  assert.equal(ctx.stats.avgLoss, 10);
  assert.equal(ctx.recentClosedTrades.length, 15);
});

test('buildTradesContext: missing live prices give nulls, never invented numbers', () => {
  const ctx = ai.buildTradesContext(makeState(), {}, NOW);
  assert.equal(ctx.futuresPositions[0].markPrice, null);
  assert.equal(ctx.futuresPositions[0].unrealizedPnl, null);
  assert.equal(ctx.futuresPositions[0].distanceToLiqPct, null);
  assert.equal(ctx.pendingOrders[0].distancePct, null);
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function fakeStorage(seed = {}) {
  const data = { ...seed };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('readState / persistState round-trip and only write the keys that changed', () => {
  const s = makeState();
  const storage = fakeStorage({
    cw_paper_cash: JSON.stringify(s.cash),
    cw_paper_deposited: JSON.stringify(s.totalDeposited),
    cw_paper_holdings: JSON.stringify(s.holdings),
    cw_paper_trades: JSON.stringify(s.trades),
    cw_paper_orders: JSON.stringify(s.pendingOrders),
    cw_paper_futures: JSON.stringify(s.futuresPositions),
    cw_paper_equity_curve: JSON.stringify([{ ts: 1, equity: 1 }]),
  });
  const state = ai.readState(storage);
  assert.equal(state.cash, 5000);
  assert.equal(state.futuresPositions.length, 2);
  const equityBefore = storage.data.cw_paper_equity_curve;

  const res = ai.applyAction(state, { type: 'cancel_order', id: 'ord_1' }, quotes, NOW);
  ai.persistState(state, storage, res.changed);
  assert.deepEqual(JSON.parse(storage.data.cw_paper_orders), []);
  assert.equal(storage.data.cw_paper_equity_curve, equityBefore);
  assert.equal(JSON.parse(storage.data.cw_paper_cash), 5000);
});

test('readState tolerates empty or corrupt storage', () => {
  const state = ai.readState(fakeStorage({ cw_paper_futures: '{not json', cw_paper_trades: '"oops"' }));
  assert.deepEqual(state.futuresPositions, []);
  assert.deepEqual(state.trades, []);
  assert.equal(ai.hasActivity(state), false);
});