import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../js/pro-tools.js', import.meta.url), 'utf8'), ctx);
const P = ctx.ProTools;

test('journal analyzer basics', () => {
  const a = P.analyzeJournal(P.parseJournal('pnl\n100\n-50\n-50\n150'), 1000);
  assert.equal(a.n, 4); assert.equal(a.net, 150); assert.equal(a.profitFactor, 2.5);
  assert.equal(a.maxLossStreak, 2); assert.equal(a.maxDD, 100);
  assert.ok(Math.abs(a.breakEvenWinRate - 50 / 175) < 1e-9);
});
test('parseJournal reads headed CSV with fee', () => {
  const r = P.parseJournal('time,realized pnl,fee\n2026-10-01T09:00:00Z,"1,5",0.1\n2026-10-01T10:00:00Z,-2,0.1'.replace('"1,5"', '15'));
  assert.equal(r.length, 2); assert.equal(r[0].fee, 0.1);
});
test('challenge odds: zero edge fails more than positive edge', () => {
  const base = { target: .1, maxDD: .1, dailyLimit: .05, rr: 2, risk: .01, tradesPerDay: 2, days: 30, runs: 2000, seed: 7 };
  const good = P.challengeOdds({ ...base, winRate: .5 }), bad = P.challengeOdds({ ...base, winRate: .3 });
  assert.ok(good.pass > bad.pass);
  assert.ok(Math.abs(good.pass + good.dailyFail + good.ddFail + good.timeout - 1) < 1e-9);
});
test('safe leverage puts liquidation beyond stop', () => {
  const r = P.safeLeverage({ stopPct: 2, buffer: 50, slipPct: .2, feePct: .05, mmr: .5 });
  const L = r.maxLeverage; assert.ok(1 / L - .005 >= .02 * 1.5 + .002 + .001 - 1e-9);
  assert.ok(r.rows.find(x => x.L === 50).ok === false);
});
test('walkBook averages across levels', () => {
  const w = P.walkBook([[100, 1], [110, 10]], 210);
  assert.ok(w.complete); assert.ok(Math.abs(w.qty - (1 + 110 / 110)) < 1e-9); assert.ok(w.avg > 100 && w.avg < 110);
  assert.equal(P.walkBook([[100, 1]], 500).complete, false);
});
test('ladder loses exactly the chosen risk at the stop', () => {
  const r = P.ladder({ prices: [100, 98, 96], weights: [1, 2, 3], stop: 93, long: true, riskUsd: 100, lev: 5, target: 112 });
  const loss = r.rows.reduce((a, x) => a + x.loss, 0);
  assert.ok(Math.abs(loss - 100) < 1e-9); assert.ok(r.avg < 100 && r.avg > 96);
  assert.equal(P.ladder({ prices: [100], weights: [1], stop: 105, long: true, riskUsd: 10, lev: 1 }), null);
});