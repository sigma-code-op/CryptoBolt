/* CryptoBolt Pro Tools: five original calculators. All maths runs in the browser. */
(function (root) {
  'use strict';
  var num = function (v) { var n = parseFloat(String(v).replace(/[$,%\s]/g, '').replace(/,/g, '')); return isFinite(n) ? n : NaN; };

  /* 1. Journal analyzer: input is array of {pnl, time?, fee?} */
  function analyzeJournal(trades, startEquity) {
    var n = trades.length; if (!n) return null;
    var wins = trades.filter(function (t) { return t.pnl > 0; }), losses = trades.filter(function (t) { return t.pnl < 0; });
    var gp = wins.reduce(function (a, t) { return a + t.pnl; }, 0), gl = -losses.reduce(function (a, t) { return a + t.pnl; }, 0);
    var net = gp - gl, avgW = wins.length ? gp / wins.length : 0, avgL = losses.length ? gl / losses.length : 0;
    var wr = wins.length / n;
    var eq = startEquity || 0, peak = eq, maxDD = 0, maxDDpct = 0, curW = 0, curL = 0, maxW = 0, maxL = 0, curve = [eq];
    trades.forEach(function (t) {
      eq += t.pnl; curve.push(eq); if (eq > peak) peak = eq;
      var dd = peak - eq; if (dd > maxDD) { maxDD = dd; maxDDpct = peak > 0 ? dd / peak : 0; }
      if (t.pnl > 0) { curW++; curL = 0; } else if (t.pnl < 0) { curL++; curW = 0; } else { curW = 0; curL = 0; }
      if (curW > maxW) maxW = curW; if (curL > maxL) maxL = curL;
    });
    var fees = trades.reduce(function (a, t) { return a + (t.fee || 0); }, 0);
    var byHour = {}, byDow = {};
    trades.forEach(function (t) { if (!t.time) return; var d = new Date(t.time); if (isNaN(d)) return;
      var h = d.getUTCHours(), w = d.getUTCDay(); byHour[h] = (byHour[h] || 0) + t.pnl; byDow[w] = (byDow[w] || 0) + t.pnl; });
    var pick = function (o, fn) { var k = Object.keys(o); if (!k.length) return null; return k.reduce(function (a, b) { return fn(o[b], o[a]) ? b : a; }); };
    return { n: n, winRate: wr, net: net, grossProfit: gp, grossLoss: gl, profitFactor: gl ? gp / gl : Infinity,
      avgWin: avgW, avgLoss: avgL, payoff: avgL ? avgW / avgL : Infinity, expectancy: net / n, maxDD: maxDD, maxDDpct: maxDDpct,
      maxWinStreak: maxW, maxLossStreak: maxL, fees: fees, feeDrag: gp ? fees / gp : 0, curve: curve,
      bestHour: pick(byHour, function (a, b) { return a > b; }), worstHour: pick(byHour, function (a, b) { return a < b; }),
      bestDay: pick(byDow, function (a, b) { return a > b; }), worstDay: pick(byDow, function (a, b) { return a < b; }),
      breakEvenWinRate: (avgW + avgL) ? avgL / (avgW + avgL) : NaN };
  }
  function parseJournal(text) {
    var lines = text.trim().split(/\r?\n/).filter(Boolean); if (!lines.length) return [];
    var sep = lines[0].indexOf('\t') > -1 ? '\t' : (lines[0].indexOf(';') > -1 ? ';' : ',');
    var head = lines[0].split(sep).map(function (h) { return h.trim().toLowerCase().replace(/^"|"$/g, ''); });
    var hasHead = head.some(function (h) { return /pnl|profit|realized|result|p&l|time|date/.test(h); });
    var pi = hasHead ? head.findIndex(function (h) { return /pnl|profit|realized|result|p&l/.test(h); }) : 0;
    var ti = hasHead ? head.findIndex(function (h) { return /time|date/.test(h); }) : -1;
    var fi = hasHead ? head.findIndex(function (h) { return /fee|commission/.test(h); }) : -1;
    if (pi < 0) pi = head.length - 1;
    var out = [];
    lines.slice(hasHead ? 1 : 0).forEach(function (l) {
      var c = l.split(sep).map(function (x) { return x.trim().replace(/^"|"$/g, ''); });
      var p = num(c[pi]); if (isNaN(p)) return;
      out.push({ pnl: p, time: ti > -1 ? c[ti] : null, fee: fi > -1 && !isNaN(num(c[fi])) ? Math.abs(num(c[fi])) : 0 });
    });
    return out;
  }

  /* 2. Challenge pass probability (Monte Carlo) */
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function challengeOdds(o) {
    var rnd = mulberry(o.seed || 12345), runs = o.runs || 5000, pass = 0, dailyFail = 0, ddFail = 0, timeout = 0, daysSum = 0;
    for (var r = 0; r < runs; r++) {
      var eq = 1, status = 0, d;
      for (d = 1; d <= o.days && !status; d++) {
        var start = eq;
        for (var t = 0; t < o.tradesPerDay; t++) {
          eq += (rnd() < o.winRate ? o.rr : -1) * o.risk * start;
          if (o.dailyLimit && start - eq >= o.dailyLimit * 1) { status = 2; break; }
          if (1 - eq >= o.maxDD) { status = 3; break; }
          if (eq - 1 >= o.target) { status = 1; break; }
        }
      }
      if (status === 1) { pass++; daysSum += d - 1; } else if (status === 2) dailyFail++; else if (status === 3) ddFail++; else timeout++;
    }
    return { pass: pass / runs, dailyFail: dailyFail / runs, ddFail: ddFail / runs, timeout: timeout / runs, avgDays: pass ? daysSum / pass : NaN };
  }

  /* 3. Safe leverage: highest leverage whose liquidation sits beyond stop + buffer (isolated margin, long/short) */
  function safeLeverage(o) {
    // liq distance (fraction of entry) for leverage L: 1/L - mmr (+ fees). Need liqDist >= stop*(1+buffer) + slip
    var need = o.stopPct / 100 * (1 + o.buffer / 100) + o.slipPct / 100 + 2 * o.feePct / 100;
    var maxL = 1 / (need + o.mmr / 100);
    var rows = [2, 3, 5, 10, 15, 20, 25, 50, 100].map(function (L) {
      var dist = 1 / L - o.mmr / 100; return { L: L, liqDist: dist * 100, ok: dist >= need, stopsToLiq: dist / (o.stopPct / 100) };
    });
    return { maxLeverage: Math.floor(maxL * 10) / 10, need: need * 100, rows: rows };
  }

  /* 4. Order book slippage */
  function walkBook(levels, usd) { // levels: [[price, qty], ...] best first
    var left = usd, qty = 0, cost = 0;
    for (var i = 0; i < levels.length && left > 0; i++) {
      var p = +levels[i][0], q = +levels[i][1], v = p * q, take = Math.min(v, left);
      cost += take; qty += take / p; left -= take;
    }
    return { filled: usd - left, avg: qty ? cost / qty : NaN, qty: qty, complete: left <= 1e-9 };
  }
  function depthTo(levels, mid, pct, side) {
    var lim = side === 'ask' ? mid * (1 + pct / 100) : mid * (1 - pct / 100), s = 0;
    for (var i = 0; i < levels.length; i++) { var p = +levels[i][0]; if (side === 'ask' ? p > lim : p < lim) break; s += p * (+levels[i][1]); }
    return s;
  }

  /* 5. Ladder: split a total risk across limit orders with weights; returns sizes, avg entry, loss at stop */
  function ladder(o) {
    var w = o.weights, ws = w.reduce(function (a, b) { return a + b; }, 0), lossPerUnit = 0, unitsTotal = 0, rows = [];
    // choose scale k so that total loss at stop = riskUsd
    var perUnitLoss = o.prices.map(function (p, i) { return (o.long ? p - o.stop : o.stop - p) * (w[i] / ws); });
    lossPerUnit = perUnitLoss.reduce(function (a, b) { return a + b; }, 0);
    if (!(lossPerUnit > 0)) return null;
    var k = o.riskUsd / lossPerUnit, notional = 0, qty = 0;
    o.prices.forEach(function (p, i) { var q = k * w[i] / ws; qty += q; notional += q * p;
      rows.push({ price: p, qty: q, usd: q * p, loss: q * (o.long ? p - o.stop : o.stop - p) }); });
    var avg = notional / qty;
    return { rows: rows, avg: avg, qty: qty, notional: notional, margin: notional / o.lev, loss: o.riskUsd,
      rr: o.target ? ((o.long ? o.target - avg : avg - o.target) * qty) / o.riskUsd : null };
  }

  var api = { analyzeJournal: analyzeJournal, parseJournal: parseJournal, challengeOdds: challengeOdds, safeLeverage: safeLeverage, walkBook: walkBook, depthTo: depthTo, ladder: ladder };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ProTools = api;

  /* ---------- UI ---------- */
  if (typeof document === 'undefined') return;
  var $ = function (id) { return document.getElementById(id); };
  var money = function (v, d) { return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 2 : d }); };
  var pct = function (v, d) { return (v * 100).toFixed(d == null ? 1 : d) + '%'; };
  var val = function (id) { return num($(id).value); };
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function stat(label, v, bad) { return '<div class="lc-stat"><b' + (bad ? ' class="lc-neg"' : '') + '>' + v + '</b><span>' + label + '</span></div>'; }
  function chart(curve) {
    var w = 600, h = 140, mn = Math.min.apply(null, curve), mx = Math.max.apply(null, curve), rg = (mx - mn) || 1;
    var pts = curve.map(function (v, i) { return (i / (curve.length - 1 || 1) * w).toFixed(1) + ',' + (h - (v - mn) / rg * (h - 8) - 4).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="Equity curve" style="margin-top:14px"><polyline fill="none" stroke="#22C58C" stroke-width="2" points="' + pts + '"/></svg>';
  }

  function initTabs() {
    var tabs = document.querySelectorAll('[data-pt-tab]');
    function show(name) { tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-pt-tab') === name); });
      document.querySelectorAll('[data-pt-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-pt-panel') !== name; });
      if (history.replaceState) history.replaceState(null, '', '#' + name); }
    tabs.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-pt-tab')); }); });
    var h = (location.hash || '').slice(1); show(document.querySelector('[data-pt-tab="' + h + '"]') ? h : 'journal');
  }

  function runJournal() {
    var rows = parseJournal($('pj-data').value), out = $('pj-out');
    if (!rows.length) { out.innerHTML = '<div class="lc-warning show">No trades found. Paste one P&amp;L number per line, or a CSV with a PnL column.</div>'; return; }
    var a = analyzeJournal(rows, val('pj-start') || 0), hr = function (h) { return h == null ? 'n/a' : String(h).padStart(2, '0') + ':00 UTC'; };
    var verdict = a.expectancy > 0 ? 'Positive expectancy: ' + money(a.expectancy) + ' per trade' : 'Negative expectancy: ' + money(a.expectancy) + ' per trade';
    out.innerHTML = '<div class="lc-result"><div class="lc-price ' + (a.expectancy > 0 ? '' : 'lc-neg') + '">' + verdict + '</div><div class="lc-sub">' + a.n + ' trades · net ' + money(a.net) + ' · you need ' + pct(a.breakEvenWinRate) + ' win rate to break even at your average win/loss, you have ' + pct(a.winRate) + '</div></div>' +
      '<div class="lc-stats">' + stat('Win rate', pct(a.winRate)) + stat('Profit factor', isFinite(a.profitFactor) ? a.profitFactor.toFixed(2) : '∞', a.profitFactor < 1) + stat('Payoff ratio (avg win / avg loss)', isFinite(a.payoff) ? a.payoff.toFixed(2) : '∞') +
      stat('Max drawdown', money(-a.maxDD) + (val('pj-start') ? ' (' + pct(a.maxDDpct) + ')' : ''), true) + stat('Longest win / loss streak', a.maxWinStreak + ' / ' + a.maxLossStreak) + stat('Fees paid' + (a.fees ? ' (' + pct(a.feeDrag, 0) + ' of gross profit)' : ''), money(a.fees)) +
      stat('Best / worst weekday', a.bestDay == null ? 'n/a' : days[a.bestDay] + ' / ' + days[a.worstDay]) + stat('Best / worst hour', a.bestHour == null ? 'n/a' : hr(a.bestHour) + ' / ' + hr(a.worstHour)) + '</div>' + chart(a.curve);
  }

  function runChallenge() {
    var o = { target: val('pc-target') / 100, maxDD: val('pc-dd') / 100, dailyLimit: val('pc-daily') / 100, winRate: val('pc-win') / 100, rr: val('pc-rr'), risk: val('pc-risk') / 100, tradesPerDay: Math.max(1, Math.round(val('pc-tpd'))), days: Math.max(1, Math.round(val('pc-days'))), runs: 5000 };
    if ([o.target, o.maxDD, o.winRate, o.rr, o.risk].some(isNaN)) { $('pc-out').innerHTML = '<div class="lc-warning show">Fill in every field.</div>'; return; }
    var r = challengeOdds(o), ev = o.winRate * o.rr - (1 - o.winRate);
    $('pc-out').innerHTML = '<div class="lc-result"><div class="lc-price ' + (r.pass < .3 ? 'lc-neg' : '') + '">' + pct(r.pass) + ' chance to pass</div><div class="lc-sub">5,000 simulated attempts · edge ' + (ev >= 0 ? '+' : '') + ev.toFixed(2) + 'R per trade' + (isNaN(r.avgDays) ? '' : ' · passes take about ' + r.avgDays.toFixed(0) + ' trading days') + '</div></div>' +
      '<div class="lc-stats">' + stat('Hit daily loss limit', pct(r.dailyFail), r.dailyFail > .2) + stat('Hit max drawdown', pct(r.ddFail), r.ddFail > .2) + stat('Ran out of time', pct(r.timeout)) + '</div>' +
      (ev <= 0 ? '<div class="lc-warning show">Your win rate and reward:risk give zero or negative edge, so more attempts will not fix it.</div>' : '');
  }

  function runLev() {
    var o = { stopPct: val('pl-stop'), buffer: val('pl-buf'), slipPct: val('pl-slip'), feePct: val('pl-fee'), mmr: val('pl-mmr') };
    if (!(o.stopPct > 0)) { $('pl-out').innerHTML = '<div class="lc-warning show">Enter a stop distance above 0.</div>'; return; }
    var r = safeLeverage(o);
    $('pl-out').innerHTML = '<div class="lc-result"><div class="lc-price">' + (r.maxLeverage >= 1 ? r.maxLeverage + 'x max safe leverage' : 'No safe leverage') + '</div><div class="lc-sub">Liquidation must sit at least ' + r.need.toFixed(2) + '% from entry, beyond your ' + o.stopPct + '% stop, so the stop fires first.</div></div>' +
      '<div class="lc-tbl-wrap"><table class="lc-fib"><thead><tr><th>Leverage</th><th>Liquidation distance</th><th>Stops before liquidation</th><th>Safe?</th></tr></thead><tbody>' +
      r.rows.map(function (x) { return '<tr><td>' + x.L + 'x</td><td>' + x.liqDist.toFixed(2) + '%</td><td>' + x.stopsToLiq.toFixed(2) + '</td><td>' + (x.ok ? 'Yes' : '<span class="lc-neg">No</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  function runSlip() {
    var sym = ($('ps-sym').value || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, ''), usd = val('ps-usd'), out = $('ps-out');
    if (!(usd > 0)) { out.innerHTML = '<div class="lc-warning show">Enter an order size above 0.</div>'; return; }
    if (!/USDT$/.test(sym)) sym += 'USDT';
    out.innerHTML = '<div class="lc-sub">Loading live order book…</div>';
    fetch('https://api.binance.com/api/v3/depth?symbol=' + sym + '&limit=1000').then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); }).then(function (b) {
      var bid = +b.bids[0][0], ask = +b.asks[0][0], mid = (bid + ask) / 2, buy = walkBook(b.asks, usd), sell = walkBook(b.bids, usd);
      var sB = (buy.avg / ask - 1) * 1e4, sS = (1 - sell.avg / bid) * 1e4, spread = (ask - bid) / mid * 1e4;
      out.innerHTML = '<div class="lc-result"><div class="lc-price">Buy ' + (buy.complete ? sB.toFixed(1) + ' bps' : 'book too thin') + ' · Sell ' + (sell.complete ? sS.toFixed(1) + ' bps' : 'book too thin') + '</div><div class="lc-sub">Market order of ' + money(usd, 0) + ' on ' + sym + ' (1 bp = 0.01%). Extra cost on top of the spread and fees.' + (buy.complete && sell.complete ? ' Round trip costs about ' + money(usd * (sB + sS + spread) / 1e4) + ' before fees.' : '') + '</div></div>' +
        '<div class="lc-stats">' + stat('Spread', spread.toFixed(2) + ' bps') + stat('Avg buy fill', buy.complete ? '$' + buy.avg.toPrecision(7) : 'n/a') + stat('Avg sell fill', sell.complete ? '$' + sell.avg.toPrecision(7) : 'n/a') +
        stat('Ask depth within 1%', money(depthTo(b.asks, mid, 1, 'ask'), 0)) + stat('Bid depth within 1%', money(depthTo(b.bids, mid, 1, 'bid'), 0)) + stat('Ask depth within 0.1%', money(depthTo(b.asks, mid, .1, 'ask'), 0)) + '</div>';
    }).catch(function () { out.innerHTML = '<div class="lc-warning show">Could not load that pair from Binance spot. Check the symbol (for example BTC, SOL, DOGE) and try again.</div>'; });
  }

  function runLadder() {
    var prices = $('pd-prices').value.split(/[\s,]+/).map(num).filter(function (x) { return !isNaN(x); });
    var wRaw = $('pd-w').value.split(/[\s,]+/).map(num).filter(function (x) { return !isNaN(x); });
    var w = prices.map(function (_, i) { return wRaw[i] > 0 ? wRaw[i] : 1; }), stop = val('pd-stop'), long = $('pd-side').value === 'long';
    var r = prices.length ? ladder({ prices: prices, weights: w, stop: stop, long: long, riskUsd: val('pd-risk'), lev: val('pd-lev') || 1, target: val('pd-tp') }) : null;
    if (!r) { $('pd-out').innerHTML = '<div class="lc-warning show">Stop must be on the losing side of every entry. For a long it must be below all entries.</div>'; return; }
    $('pd-out').innerHTML = '<div class="lc-result"><div class="lc-price">Average entry $' + r.avg.toPrecision(7) + '</div><div class="lc-sub">If every order fills and the stop hits, you lose exactly ' + money(r.loss) + '. Total position ' + money(r.notional, 0) + ' · margin ' + money(r.margin, 0) + (r.rr ? ' · ' + r.rr.toFixed(2) + 'R to target' : '') + '.</div></div>' +
      '<div class="lc-tbl-wrap"><table class="lc-fib"><thead><tr><th>Entry</th><th>Size (coins)</th><th>Order value</th><th>Loss if stopped</th></tr></thead><tbody>' +
      r.rows.map(function (x) { return '<tr><td>$' + x.price + '</td><td>' + x.qty.toPrecision(5) + '</td><td>' + money(x.usd) + '</td><td>' + money(x.loss) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  function init() {
    initTabs();
    var map = { 'pj-run': runJournal, 'pc-run': runChallenge, 'pl-run': runLev, 'ps-run': runSlip, 'pd-run': runLadder };
    Object.keys(map).forEach(function (id) { $(id).addEventListener('click', map[id]); });
    $('pj-file').addEventListener('change', function (e) { var f = e.target.files[0]; if (!f) return; var fr = new FileReader(); fr.onload = function () { $('pj-data').value = fr.result; runJournal(); }; fr.readAsText(f); });
    $('pj-sample').addEventListener('click', function () { $('pj-data').value = 'time,pnl,fee\n' + Array.from({ length: 40 }, function (_, i) { var p = [120, -60, -60, 90, -60, 210, -60, -60, -60, 150][i % 10] + (i % 7) * 3; return '2026-10-' + String(1 + i % 28).padStart(2, '0') + 'T' + String(8 + i % 12).padStart(2, '0') + ':00:00Z,' + p + ',1.2'; }).join('\n'); runJournal(); });
    runLev(); runLadder(); runChallenge();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);