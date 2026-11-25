import test from 'node:test';
import assert from 'node:assert';
import { loadCalc } from '../scripts/load-calc.mjs';

const B = loadCalc('js/backtest-lab.js', 'CBBacktest');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const flat = (closes) => ({ t: closes.map((_, i) => i), o: closes.slice(), h: closes.map((c) => c * 1.0), l: closes.map((c) => c * 1.0), c: closes.slice() });
const noCost = { fee: 0, slip: 0, leverage: 1, stop: 0, target: 0, allowShort: false, interval: '1d', split: 0.7 };

test('indicators: sma, ema and rsi match hand-computed values', () => {
  const a = B.sma([1, 2, 3, 4, 5], 3);
  assert.ok(isNaN(a[1])); near(a[2], 2); near(a[4], 4);
  const e = B.ema([1, 2, 3, 4, 5], 3); // seed = sma(1,2,3)=2, k=0.5
  near(e[2], 2); near(e[3], 3); near(e[4], 4);
  const up = B.rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14);
  near(up[14], 100);
});

test('hold: signal is read at the close and filled at the NEXT open (no look-ahead)', () => {
  const cs = { t: [0, 1, 2, 3], o: [100, 110, 120, 130], h: [100, 110, 120, 130], l: [100, 110, 120, 130], c: [100, 110, 120, 130] };
  const run = B.simulate(cs, B.signals('hold', {}, cs, false), noCost, 0, 4);
  assert.strictEqual(run.trades.length, 1);
  assert.strictEqual(run.trades[0].entryBar, 1);
  near(run.trades[0].entryPx, 110);
  near(run.eq[3], 130 / 110);
});

test('fees and slippage are charged on both sides', () => {
  const cs = flat([100, 100, 100, 100, 100]);
  const run = B.simulate(cs, B.signals('hold', {}, cs, false), { ...noCost, fee: 0.1 }, 0, 5);
  near(run.eq[4], (1 - 0.001) * (1 - 0.001), 1e-9);
  const run2 = B.simulate(cs, B.signals('hold', {}, cs, false), { ...noCost, slip: 0.1 }, 0, 5);
  near(run2.eq[4], (1 - 0.001) / (1 + 0.001) , 1e-6);
});

test('leverage multiplies the move and liquidation wipes the account', () => {
  const up = flat([100, 100, 110, 110]);
  const r = B.simulate(up, [1, 1, 1, 1], { ...noCost, leverage: 5 }, 0, 4);
  near(r.eq[3], 1.5, 1e-9);
  const dn = { t: [0, 1, 2], o: [100, 100, 90], h: [100, 100, 100], l: [100, 100, 79], c: [100, 100, 85] };
  const liq = B.simulate(dn, [1, 1, 1], { ...noCost, leverage: 5 }, 0, 3);
  assert.ok(liq.blown); assert.strictEqual(liq.eq[2], 0);
  assert.strictEqual(liq.trades[0].reason, 'liquidation'); near(liq.trades[0].ret, -1);
});

test('stop-loss fires intrabar and wins a tie with the target; gaps fill at the open', () => {
  const cs = { t: [0, 1, 2], o: [100, 100, 100], h: [100, 100, 106], l: [100, 100, 94], c: [100, 100, 100] };
  const r = B.simulate(cs, [1, 1, 1], { ...noCost, stop: 5, target: 5 }, 0, 3);
  assert.strictEqual(r.trades[0].reason, 'stop'); near(r.trades[0].ret, -0.05, 1e-9);
  const gap = { t: [0, 1, 2], o: [100, 100, 90], h: [100, 100, 91], l: [100, 100, 89], c: [100, 100, 90] };
  const g = B.simulate(gap, [1, 1, 1], { ...noCost, stop: 5 }, 0, 3);
  near(g.trades[0].exitPx, 90); // not 95
});

test('shorts profit when price falls', () => {
  const cs = flat([100, 100, 90, 90]);
  const r = B.simulate(cs, [-1, -1, -1, -1], { ...noCost, allowShort: true }, 0, 4);
  near(r.eq[3], 1.1, 1e-9);
});

test('sma cross goes long only after the fast average crosses above', () => {
  const closes = [10, 10, 10, 10, 10, 11, 12, 13, 14, 15, 14, 12, 10, 8, 6];
  const cs = flat(closes), sig = B.signals('sma_cross', { fast: 2, slow: 4 }, cs, false);
  assert.strictEqual(sig[4], 0); assert.strictEqual(sig[6], 1); assert.strictEqual(sig[14], 0);
});

test('rsi strategy: enters below the low level and exits above the high level', () => {
  const closes = [];
  for (let i = 0; i < 20; i++) closes.push(100 - i * 2); // falling: RSI very low
  for (let i = 0; i < 20; i++) closes.push(62 + i * 3); // rising: RSI very high
  const cs = flat(closes), sig = B.signals('rsi_revert', { period: 5, low: 30, high: 70 }, cs, false);
  assert.strictEqual(sig[19], 1); assert.strictEqual(sig[39], 0);
});

test('metrics: total return, drawdown, win rate, profit factor', () => {
  const m = B.metrics({ eq: [1, 1.2, 0.9, 1.1], trades: [{ ret: 0.2 }, { ret: -0.1 }, { ret: 0.05 }], inPos: 2, blown: false }, 365, { ret: 0, maxDD: 0 });
  near(m.totalReturn, 0.1); near(m.maxDD, 0.25); near(m.winRate, 2 / 3); near(m.profitFactor, 2.5);
});

test('monte carlo is deterministic, ordered and refuses tiny samples', () => {
  const tr = []; for (let i = 0; i < 40; i++) tr.push({ ret: i % 3 === 0 ? -0.04 : 0.03 });
  const a = B.monteCarlo(tr, 500, 1), b = B.monteCarlo(tr, 500, 1);
  assert.deepStrictEqual(a, b);
  assert.ok(a.ret.p5 <= a.ret.p50 && a.ret.p50 <= a.ret.p95);
  assert.ok(a.dd.p5 <= a.dd.p95);
  assert.strictEqual(B.monteCarlo(tr.slice(0, 5), 100, 1).ok, false);
});

test('runAll splits 70/30 and reports both parts', () => {
  const cs = B.randomWalk(1000, 7, 0, 0.02);
  const r = B.runAll(cs, 'sma_cross', { fast: 10, slow: 30 }, { ...noCost, fee: 0.05 });
  assert.strictEqual(r.splitIndex, 700);
  assert.strictEqual(r.ins.run.eq.length, 700); assert.strictEqual(r.oos.run.eq.length, 300);
  assert.strictEqual(r.full.run.eq.length, 1000);
});

test('optimizer on pure random data: the best in-sample setting is just the luckiest one', () => {
  let sIn = 0, sOos = 0, sMed = 0; const N = 20;
  for (let seed = 1; seed <= N; seed++) {
    const cs = B.randomWalk(2000, seed, 0, 0.015);
    const o = B.optimize(cs, 'sma_cross', { fast: 10, slow: 40 }, 'fast', B.range(3, 30, 8).map(Math.round), 'slow', B.range(20, 120, 8).map(Math.round), { ...noCost, fee: 0.05, slip: 0.02 });
    sIn += o.best.ins; sOos += o.best.oos; sMed += o.medianOos;
  }
  assert.ok(sIn / N > 0.15, 'picking the best of 64 settings should look great in-sample: ' + sIn / N);
  assert.ok(sOos / N < sIn / N - 0.15, 'but it should not carry over: ' + sOos / N);
  assert.ok(Math.abs(sOos / N - sMed / N) < 0.15, 'out-of-sample it is no better than a typical setting');
});

test('parser understands common English descriptions', () => {
  let p = B.parseText('Buy when RSI(14) is below 25 and sell when it is above 75, 3x leverage, stop loss 4%');
  assert.strictEqual(p.strategy, 'rsi_revert'); assert.strictEqual(p.params.period, 14); assert.strictEqual(p.params.low, 25); assert.strictEqual(p.params.high, 75);
  assert.strictEqual(p.leverage, 3); assert.strictEqual(p.stop, 4);
  p = B.parseText('50/200 EMA crossover, long and short');
  assert.strictEqual(p.strategy, 'ema_cross'); assert.strictEqual(p.params.fast, 50); assert.strictEqual(p.params.slow, 200); assert.strictEqual(p.allowShort, true);
  assert.strictEqual(B.parseText('golden cross').params.slow, 200);
  assert.strictEqual(B.parseText('20 day breakout').params.period, 20);
  assert.strictEqual(B.parseText('bollinger bands 20 2.5').params.k, 2.5);
  assert.strictEqual(B.parseText('macd 12 26 9').params.signal, 9);
  assert.strictEqual(B.parseText('just buy and hold').strategy, 'hold');
  assert.strictEqual(B.parseText('make me rich'), null);
});