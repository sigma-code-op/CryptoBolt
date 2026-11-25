/*
 * Grid bot profit calculator (spot grid, equal quantity per grid).
 *
 * Model (simplified, stated on the page):
 *  - n intervals between lower and upper. Arithmetic: equal price step. Geometric: equal % step.
 *  - Every interval holds the same base quantity q. An interval whose lower line is below the
 *    current price waits with a buy order at that line and a sell at the line above.
 *    An interval whose lower line is at or above the current price starts as base coin bought at the
 *    current price and sells at the line above.
 *  - q is chosen so that the pending buy orders plus the starting coin cost exactly `invest`.
 *  - One completed cycle of interval i earns q*(L[i+1]-L[i]) minus fee on both legs.
 *  - Range exit: value at a price outside the range follows a one-way move from the start price
 *    (no extra cycles), so it isolates the cost of leaving the range.
 */
(function (root) {
    'use strict';

    function lines(lower, upper, n, mode) {
        var L = [], i;
        if (mode === 'geometric') {
            var r = Math.pow(upper / lower, 1 / n);
            for (i = 0; i <= n; i++) L.push(lower * Math.pow(r, i));
        } else {
            var s = (upper - lower) / n;
            for (i = 0; i <= n; i++) L.push(lower + s * i);
        }
        L[n] = upper;
        return L;
    }

    function compute(i) {
        var out = { ok: false, warn: [] };
        var v = [i.lower, i.upper, i.grids, i.invest, i.price, i.fee];
        for (var k = 0; k < v.length; k++) if (!Number.isFinite(v[k])) { out.error = 'invalid'; return out; }
        if (i.lower <= 0 || i.upper <= i.lower || i.grids < 2 || i.grids > 500 || Math.floor(i.grids) !== i.grids ||
            i.invest <= 0 || i.price <= 0 || i.fee < 0 || i.fee >= 5) { out.error = 'invalid'; return out; }
        if (i.price < i.lower || i.price > i.upper) { out.error = 'price-outside'; return out; }
        var mode = i.mode === 'geometric' ? 'geometric' : 'arithmetic';
        var n = i.grids, f = i.fee / 100;
        var L = lines(i.lower, i.upper, n, mode);

        // classify intervals
        var below = [], above = [];
        for (var j = 0; j < n; j++) (L[j + 1] <= i.price ? below : above).push(j);
        var denom = 0;
        below.forEach(function (j) { denom += L[j] * (1 + f); });
        denom += above.length * i.price * (1 + f);
        var q = i.invest / denom;

        // per-interval cycle profit
        var cyc = [], sum = 0, minPct = Infinity, maxPct = -Infinity;
        for (j = 0; j < n; j++) {
            var gross = q * (L[j + 1] - L[j]);
            var feeAmt = f * q * (L[j] + L[j + 1]);
            var net = gross - feeAmt;
            var pct = (L[j + 1] / L[j] - 1) * 100;
            var netPct = ((L[j + 1] * (1 - f)) / (L[j] * (1 + f)) - 1) * 100;
            cyc.push({ gross: gross, fee: feeAmt, net: net, pct: pct, netPct: netPct });
            sum += net;
            if (netPct < minPct) minPct = netPct;
            if (netPct > maxPct) maxPct = netPct;
        }
        var avgNet = sum / n;
        var stepLow = (L[1] / L[0] - 1) * 100, stepHigh = (L[n] / L[n - 1] - 1) * 100;
        var minStepPct = ((1 + f) / (1 - f) - 1) * 100; // step % needed just to cover both fees

        // portfolio value after a one-way move from the start price to p
        var base0 = above.length * q;
        var cash0 = i.invest - above.length * q * i.price * (1 + f) - below.reduce(function (a, j) { return a + q * L[j] * (1 + f); }, 0);
        function valueAt(p) {
            var cash = cash0 + 0, base = base0, jj;
            // pending buy orders are reserved cash: add reserved cash back as cash that is spent on fill
            var reserved = below.reduce(function (a, j) { return a + q * L[j] * (1 + f); }, 0);
            cash += reserved;
            if (p < i.price) {
                below.forEach(function (j) { if (L[j] >= p) { cash -= q * L[j] * (1 + f); base += q; } });
            } else if (p > i.price) {
                above.forEach(function (j) { if (L[j + 1] <= p) { cash += q * L[j + 1] * (1 - f); base -= q; } });
            }
            return cash + base * p;
        }
        var hodlUnits = i.invest / (i.price * (1 + f));
        function hodlAt(p) { return hodlUnits * p; }

        var scen = [i.lower * 0.9, i.lower, i.price, i.upper, i.upper * 1.1].map(function (p) {
            return { price: p, value: valueAt(p), hodl: hodlAt(p), pnl: valueAt(p) - i.invest };
        });

        var cyclesPerDay = Number.isFinite(i.cyclesPerDay) && i.cyclesPerDay >= 0 ? i.cyclesPerDay : 0;
        var daily = avgNet * cyclesPerDay;
        var apr = daily * 365 / i.invest * 100;

        out.ok = true; out.mode = mode; out.lines = L; out.qty = q; out.orderValue = i.invest / n;
        out.stepLow = stepLow; out.stepHigh = stepHigh; out.minStepPct = minStepPct;
        out.avgNet = avgNet; out.sumNet = sum; out.minNetPct = minPct; out.maxNetPct = maxPct;
        out.avgNetPct = avgNet / (i.invest / n) * 100;
        out.cycles = cyc; out.scen = scen; out.daily = daily; out.apr = apr;
        out.buys = below.length; out.sells = above.length;
        out.lossAtLower = scen[1].pnl;
        out.cyclesToRecover = avgNet > 0 && scen[1].pnl < 0 ? Math.ceil(-scen[1].pnl / avgNet) : 0;
        if (minPct <= 0) out.warn.push('step-below-fees');
        else if (minPct < 0.1) out.warn.push('thin-step');
        if (i.grids > 100) out.warn.push('many-grids');
        return out;
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = { compute: compute, lines: lines };
    root.CBGrid = { compute: compute, lines: lines };

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
        var d = n >= 10 ? 2 : n >= 1 ? 4 : 6;
        return '$' + n.toLocaleString(undefined, { maximumFractionDigits: d });
    }
    function pct(n, d) { return Number.isFinite(n) ? n.toFixed(d == null ? 2 : d) + '%' : '--'; }

    var MSG = {
        'invalid': 'Enter a lower price below the upper price, a whole number of grids from 2 to 500, an investment above 0, a current price and a fee of 0 or more.',
        'price-outside': 'The current price must be inside your grid range. If the price is outside the range the bot would not start trading.',
        'step-below-fees': 'In at least one grid the price step is smaller than the round-trip fees, so a completed cycle there loses money. Use fewer grids or a wider range.',
        'thin-step': 'The smallest net profit per cycle is under 0.1%. A tiny edge is easily erased by slippage, so check the real fee tier you pay.',
        'many-grids': 'Many grids mean small orders; check the exchange minimum order size before you rely on this number.'
    };

    function init() {
        if (!$('gb-lower')) return;
        var mode = 'arithmetic';
        var a = $('gb-mode-a'), g = $('gb-mode-g');
        function setMode(m) {
            mode = m;
            a.classList.toggle('active', m === 'arithmetic'); g.classList.toggle('active', m === 'geometric');
            a.setAttribute('aria-pressed', String(m === 'arithmetic')); g.setAttribute('aria-pressed', String(m === 'geometric'));
            calc();
        }
        function calc() {
            var r = compute({ lower: num('gb-lower'), upper: num('gb-upper'), grids: num('gb-grids'), invest: num('gb-invest'),
                price: num('gb-price'), fee: num('gb-fee'), mode: mode, cyclesPerDay: num('gb-cycles') });
            var ids = ['gb-out-order', 'gb-out-step', 'gb-out-net', 'gb-out-avg', 'gb-out-day', 'gb-out-apr', 'gb-out-low', 'gb-out-up', 'gb-out-rec'];
            var w = $('gb-warning');
            if (!r.ok) {
                setText('gb-out-main', '--'); setText('gb-out-sub', MSG[r.error] || MSG.invalid);
                ids.forEach(function (x) { setText(x, '--'); });
                if (w) { w.textContent = ''; w.classList.remove('show'); }
                var tb = $('gb-scen'); if (tb) tb.innerHTML = '';
                return;
            }
            setText('gb-out-main', pct(r.minNetPct, 2) + ' to ' + pct(r.maxNetPct, 2));
            setText('gb-out-sub', 'Net profit per completed grid cycle after fees (' + r.mode + ' grid, about ' + usd(r.avgNet) + ' per cycle)');
            setText('gb-out-order', usd(r.orderValue));
            setText('gb-out-step', r.mode === 'geometric' ? pct(r.stepLow) + ' per grid' : pct(r.stepLow) + ' to ' + pct(r.stepHigh));
            setText('gb-out-net', pct(r.minStepPct) + ' needed to cover fees');
            setText('gb-out-avg', usd(r.avgNet));
            setText('gb-out-day', usd(r.daily));
            setText('gb-out-apr', r.daily > 0 ? pct(r.apr, 1) : '--');
            setText('gb-out-low', usd(r.scen[1].pnl));
            setText('gb-out-up', usd(r.scen[3].pnl));
            setText('gb-out-rec', r.cyclesToRecover ? r.cyclesToRecover + ' cycles' : '--');
            var rows = r.scen.map(function (s, ix) {
                var lab = ['10% below the range', 'Bottom of range', 'Start price', 'Top of range', '10% above the range'][ix];
                return '<tr><td>' + lab + '</td><td>' + px(s.price) + '</td><td>' + usd(s.value) + '</td><td class="' + (s.pnl < 0 ? 'lc-neg' : '') + '">' + usd(s.pnl) + '</td><td>' + usd(s.hodl) + '</td></tr>';
            });
            var t = $('gb-scen'); if (t) t.innerHTML = rows.join('');
            var msg = r.warn.map(function (k) { return MSG[k]; }).join(' ');
            if (w) { w.textContent = msg; w.classList.toggle('show', !!msg); }
        }
        a.addEventListener('click', function () { setMode('arithmetic'); });
        g.addEventListener('click', function () { setMode('geometric'); });
        ['gb-lower', 'gb-upper', 'gb-grids', 'gb-invest', 'gb-price', 'gb-fee', 'gb-cycles'].forEach(function (id) {
            var el = $(id); if (el) el.addEventListener('input', calc);
        });
        calc();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof globalThis !== 'undefined' ? globalThis : this);