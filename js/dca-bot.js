/*
 * DCA bot (martingale) safety-order calculator.
 *
 * Conventions follow the common bot setup (base order, safety orders, price deviation,
 * step scale, volume scale, take profit):
 *  - Base order of `base` USD at `entry`.
 *  - Safety order k (1..N) is placed at a cumulative drop (longs) or rise (shorts) of
 *      dev_k = d1 * (1 + s + s^2 + ... + s^(k-1))   (s = step scale, so s = 1 gives k * d1)
 *    and has size  so * v^(k-1)   (v = volume scale).
 *  - Take profit is a % above (long) or below (short) the volume-weighted average entry.
 *  - Futures option: isolated margin = cost / leverage; liquidation of the averaged position
 *    uses the simple isolated formula  avg * (1 -/+ 1/lev +/- mmr). It ignores fees and funding.
 */
(function (root) {
    'use strict';

    function compute(i) {
        var out = { ok: false, warn: [] };
        var v = [i.entry, i.base, i.so, i.count, i.dev, i.stepScale, i.volScale, i.tp, i.fee];
        for (var k = 0; k < v.length; k++) if (!Number.isFinite(v[k])) { out.error = 'invalid'; return out; }
        if (i.entry <= 0 || i.base <= 0 || i.so <= 0 || i.count < 1 || i.count > 30 || Math.floor(i.count) !== i.count ||
            i.dev <= 0 || i.dev >= 100 || i.stepScale < 1 || i.stepScale > 5 || i.volScale < 1 || i.volScale > 5 ||
            i.tp <= 0 || i.fee < 0) { out.error = 'invalid'; return out; }
        var side = i.side === 'short' ? -1 : 1;
        var f = i.fee / 100;
        var lev = Number.isFinite(i.lev) && i.lev >= 1 ? i.lev : 1;
        var mmr = Number.isFinite(i.mmr) && i.mmr >= 0 ? i.mmr / 100 : 0.005;

        var rows = [], cost = 0, units = 0, cumDev = 0, step = i.dev, size = i.so;
        var p0 = i.entry;
        cost = i.base; units = i.base / p0;
        rows.push({ n: 0, price: p0, size: i.base, dev: 0, cost: cost, avg: cost / units, tpPrice: (cost / units) * (1 + side * i.tp / 100) });
        for (var n = 1; n <= i.count; n++) {
            cumDev += step;
            if (cumDev >= 100 && side === 1) { out.error = 'dev-too-deep'; return out; }
            var price = p0 * (1 - side * cumDev / 100);
            cost += size; units += size / price;
            var avg = cost / units;
            rows.push({ n: n, price: price, size: size, dev: cumDev, cost: cost, avg: avg, tpPrice: avg * (1 + side * i.tp / 100) });
            step *= i.stepScale; size *= i.volScale;
        }
        var last = rows[rows.length - 1];
        var rise = (last.tpPrice / last.price - 1) * side * 100; // move from last SO needed to reach take profit
        var cap = last.cost;
        var netTpPct = i.tp - 2 * i.fee;
        var tpProfit = cost * (i.tp / 100) - cost * f * 2; // approx: all coins sold at TP, fee both legs on cost
        out.ok = true; out.rows = rows; out.capital = cap; out.units = units; out.avg = last.avg;
        out.lastPrice = last.price; out.lastDev = last.dev; out.reachBackPct = rise;
        out.tpProfit = tpProfit; out.netTpPct = netTpPct;
        out.floatingAtLast = side === 1 ? units * last.price - cost : cost - units * last.price;
        out.sideSign = side; out.lev = lev;
        out.margin = cap / lev;
        out.liq = side === 1 ? last.avg * (1 - 1 / lev + mmr) : last.avg * (1 + 1 / lev - mmr);
        out.liqBeforeLast = lev > 1 && (side === 1 ? out.liq >= last.price : out.liq <= last.price);
        var firstLiq = (function () {
            // first safety order index whose averaged position has a liquidation price already hit by that order price
            for (var q = 0; q < rows.length; q++) {
                var r = rows[q];
                var l = side === 1 ? r.avg * (1 - 1 / lev + mmr) : r.avg * (1 + 1 / lev - mmr);
                var next = rows[q + 1];
                if (next && (side === 1 ? l >= next.price : l <= next.price)) return q + 1;
            }
            return 0;
        })();
        out.liqAtOrder = lev > 1 ? firstLiq : 0;
        if (lev > 1 && firstLiq) out.warn.push('liq-before-so');
        if (out.capital / i.base > 50) out.warn.push('capital-heavy');
        if (out.reachBackPct > 5) out.warn.push('far-tp');
        return out;
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = { compute: compute };
    root.CBDcaBot = { compute: compute };

    if (typeof document === 'undefined') return;

    function $(id) { return document.getElementById(id); }
    function num(id) { var el = $(id); return el ? parseFloat(el.value) : NaN; }
    function setText(id, t) { var el = $(id); if (el) el.textContent = t; }
    function usd(n) {
        if (!Number.isFinite(n)) return '--';
        return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function px(n) {
        if (!Number.isFinite(n)) return '--';
        return '$' + n.toLocaleString(undefined, { maximumFractionDigits: n >= 10 ? 2 : n >= 1 ? 4 : 6 });
    }
    function pct(n) { return Number.isFinite(n) ? n.toFixed(2) + '%' : '--'; }

    var MSG = {
        'invalid': 'Enter an entry price, base and safety order sizes above 0, 1 to 30 safety orders, a deviation between 0 and 100%, step and volume scales from 1 to 5, and a take profit above 0.',
        'dev-too-deep': 'The safety orders would reach a price at or below zero. Lower the deviation, step scale or number of orders.',
        'liq-before-so': 'With this leverage the averaged position is liquidated before all safety orders can fill. Lower the leverage or use fewer or closer safety orders.',
        'capital-heavy': 'The full ladder needs more than 50 times your base order. Late safety orders are very large, which is the main risk of martingale-style bots.',
        'far-tp': 'After the last safety order the price still has to recover more than 5% to hit take profit. In a long downtrend that can take a long time.'
    };

    function init() {
        if (!$('db-entry')) return;
        var side = 'long';
        var l = $('db-side-long'), s = $('db-side-short');
        function setSide(v) {
            side = v;
            l.classList.toggle('active', v === 'long'); s.classList.toggle('active', v === 'short');
            l.setAttribute('aria-pressed', String(v === 'long')); s.setAttribute('aria-pressed', String(v === 'short'));
            calc();
        }
        function calc() {
            var r = compute({ side: side, entry: num('db-entry'), base: num('db-base'), so: num('db-so'), count: num('db-count'),
                dev: num('db-dev'), stepScale: num('db-step'), volScale: num('db-vol'), tp: num('db-tp'), fee: num('db-fee'),
                lev: num('db-lev'), mmr: num('db-mmr') });
            var ids = ['db-out-cap', 'db-out-last', 'db-out-avg', 'db-out-reach', 'db-out-tp', 'db-out-float', 'db-out-liq'];
            var w = $('db-warning'), tb = $('db-rows');
            if (!r.ok) {
                setText('db-out-main', '--'); setText('db-out-sub', MSG[r.error] || MSG.invalid);
                ids.forEach(function (x) { setText(x, '--'); });
                if (w) { w.textContent = ''; w.classList.remove('show'); }
                if (tb) tb.innerHTML = '';
                return;
            }
            setText('db-out-main', usd(r.capital));
            setText('db-out-sub', 'Total capital needed if every safety order fills (' + (r.rows.length - 1) + ' safety orders)');
            setText('db-out-cap', usd(r.capital));
            setText('db-out-last', px(r.lastPrice) + ' (' + pct(r.lastDev) + (r.sideSign === 1 ? ' below' : ' above') + ' entry)');
            setText('db-out-avg', px(r.avg));
            setText('db-out-reach', pct(r.reachBackPct) + ' from the last order');
            setText('db-out-tp', usd(r.tpProfit));
            setText('db-out-float', usd(r.floatingAtLast));
            setText('db-out-liq', r.lev > 1 ? px(r.liq) + ' at ' + r.lev + 'x (margin ' + usd(r.margin) + ')' : 'No leverage (spot)');
            if (tb) tb.innerHTML = r.rows.map(function (x) {
                return '<tr><td>' + (x.n === 0 ? 'Base' : 'SO ' + x.n) + '</td><td>' + px(x.price) + '</td><td>' + pct(x.dev) + '</td><td>' + usd(x.size) + '</td><td>' + usd(x.cost) + '</td><td>' + px(x.avg) + '</td><td>' + px(x.tpPrice) + '</td></tr>';
            }).join('');
            var msg = r.warn.map(function (k) { return MSG[k]; }).join(' ');
            if (w) { w.textContent = msg; w.classList.toggle('show', !!msg); }
        }
        l.addEventListener('click', function () { setSide('long'); });
        s.addEventListener('click', function () { setSide('short'); });
        ['db-entry', 'db-base', 'db-so', 'db-count', 'db-dev', 'db-step', 'db-vol', 'db-tp', 'db-fee', 'db-lev', 'db-mmr'].forEach(function (id) {
            var el = $(id); if (el) el.addEventListener('input', calc);
        });
        calc();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof globalThis !== 'undefined' ? globalThis : this);