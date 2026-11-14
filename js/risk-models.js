// ---------------------------------------------------------------------------
// Risk models: liquidation-probability-calculator.html, risk-of-ruin-calculator.html
// and losing-streak-calculator.html.
//
// Everything here is plain arithmetic: no network calls, no dependency on the
// numbered js/00-.. app modules. The maths lives in window.CBRisk so tests (and
// the static tables printed on the pages) use exactly the same functions as
// the calculators. External file, not inline, so the page CSP needs no
// 'unsafe-inline' - see scripts/build-csp.js. Each init*() returns early when
// its markup is absent, so one file serves all three pages.
//
// Model notes (also printed on the pages):
//  * Liquidation odds treat price as a continuous random walk (geometric
//    Brownian motion) with a volatility the user supplies. Real markets have
//    fat tails, gaps and wicks, so real touch probabilities are higher than
//    this model says. Treat the output as a floor, not a forecast.
//  * Risk of ruin is a seeded Monte Carlo: the same inputs always give the
//    same answer, and trades are assumed independent.
//  * Losing-streak odds are exact (dynamic programming), not simulated.
// ---------------------------------------------------------------------------
(function (g) {
    'use strict';

    // ---------- statistics helpers ------------------------------------------
    function erf(x) {
        // Abramowitz & Stegun 7.1.26, max absolute error 1.5e-7.
        var s = x < 0 ? -1 : 1;
        x = Math.abs(x);
        var t = 1 / (1 + 0.3275911 * x);
        var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
        return s * y;
    }
    function normCdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
    function normInv(p) {
        if (!(p > 0 && p < 1)) return NaN;
        var lo = -12, hi = 12;
        for (var i = 0; i < 80; i++) {
            var mid = (lo + hi) / 2;
            if (normCdf(mid) < p) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
    }

    // ---------- liquidation odds --------------------------------------------
    // Isolated-margin distance to liquidation as a fraction of entry price,
    // using the same simplification as liquidation-price-calculator.html:
    // distance = 1/leverage - maintenance margin rate.
    function liqDistance(lev, mmr) { return 1 / lev - mmr; }

    // Log-price barrier for a long (price falls) or short (price rises).
    function barrierLog(side, dist) {
        if (!(dist > 0)) return 0;
        return side === 'short' ? Math.log(1 + dist) : -Math.log(1 - dist);
    }

    // P(price touches the barrier at some moment within `days`).
    // a: log distance to the barrier (>= 0). sigma and mu are annual; mu is the
    // drift of log price (0 = no expected move). For a short the barrier is
    // above, which is the same problem with the drift sign flipped.
    function touchProb(a, sigma, days, mu, side) {
        if (!(a > 0)) return 1;
        if (!(sigma > 0) || !(days > 0)) return 0;
        var T = days / 365;
        var s = sigma * Math.sqrt(T);
        var m = (side === 'short' ? -1 : 1) * (mu || 0);
        var p = normCdf((-a - m * T) / s);
        if (m !== 0) {
            var e = Math.exp(-2 * m * a / (sigma * sigma));
            if (Number.isFinite(e)) p += e * normCdf((-a + m * T) / s);
        } else {
            p *= 2;
        }
        return Math.min(1, Math.max(0, p));
    }

    // Days until the chance of having been liquidated reaches `target`.
    function daysToProb(a, sigma, mu, side, target) {
        var lo = 1e-6, hi = 365 * 100;
        if (touchProb(a, sigma, hi, mu, side) < target) return Infinity;
        for (var i = 0; i < 100; i++) {
            var mid = (lo + hi) / 2;
            if (touchProb(a, sigma, mid, mu, side) < target) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
    }

    // Highest leverage whose touch probability over `days` stays at or below `target`.
    function maxLeverage(target, sigma, days, mu, side, mmr) {
        var lo = 0, hi = 25; // log-distance search range
        for (var i = 0; i < 100; i++) {
            var mid = (lo + hi) / 2;
            if (touchProb(mid, sigma, days, mu, side) > target) lo = mid; else hi = mid;
        }
        var a = hi;
        var dist = side === 'short' ? Math.exp(a) - 1 : 1 - Math.exp(-a);
        return 1 / (dist + mmr);
    }

    // ---------- risk of ruin (seeded Monte Carlo) ---------------------------
    function mulberry32(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function quantile(sorted, q) {
        if (!sorted.length) return NaN;
        var idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
        return sorted[idx];
    }
    // p: win rate 0..1, rr: reward per 1 risked, risk: fraction of current equity
    // risked per trade, n: trades, dd: drawdown (0..1) that counts as ruin,
    // cost: fees+slippage per trade in R.
    function simulate(o) {
        var runs = o.runs || Math.max(500, Math.min(5000, Math.floor(4e6 / Math.max(1, o.n))));
        var rnd = mulberry32(o.seed == null ? 20261114 : o.seed);
        var cost = o.cost || 0;
        var winMul = 1 + o.risk * (o.rr - cost);
        var lossMul = 1 - o.risk * (1 + cost);
        var ends = new Float64Array(runs), dds = new Float64Array(runs);
        var ruined = 0, below = 0;
        for (var r = 0; r < runs; r++) {
            var eq = 1, peak = 1, maxdd = 0;
            for (var i = 0; i < o.n; i++) {
                eq *= rnd() < o.p ? winMul : lossMul;
                if (eq > peak) peak = eq;
                else { var d = 1 - eq / peak; if (d > maxdd) maxdd = d; }
            }
            ends[r] = eq; dds[r] = maxdd;
            if (maxdd >= o.dd) ruined++;
            if (eq < 1) below++;
        }
        ends.sort(); dds.sort();
        return {
            runs: runs,
            pRuin: ruined / runs,
            pBelowStart: below / runs,
            endP5: quantile(ends, 0.05), endMedian: quantile(ends, 0.5), endP95: quantile(ends, 0.95),
            ddMedian: quantile(dds, 0.5), ddP95: quantile(dds, 0.95)
        };
    }
    function kelly(p, rr) { return rr > 0 ? p - (1 - p) / rr : NaN; }

    // ---------- losing streaks (exact) --------------------------------------
    // P(at least one run of k or more losses in n independent trades), loss prob q.
    function streakProb(q, n, k) {
        if (k <= 0) return 1;
        if (k > n) return 0;
        // state[j] = P(current losing streak is exactly j and no run of k yet)
        var state = new Float64Array(k), next = new Float64Array(k);
        state[0] = 1;
        var hit = 0;
        for (var t = 0; t < n; t++) {
            next.fill(0);
            var win = 0;
            for (var j = 0; j < k; j++) {
                var pr = state[j];
                if (!pr) continue;
                win += pr * (1 - q);
                if (j + 1 === k) hit += pr * q; else next[j + 1] += pr * q;
            }
            next[0] += win;
            var tmp = state; state = next; next = tmp;
        }
        return hit;
    }
    // Longest streak that has at least `prob` chance of showing up in n trades.
    function streakAtProb(q, n, prob) {
        var k = 1;
        while (k < n && streakProb(q, n, k + 1) >= prob) k++;
        return streakProb(q, n, 1) >= prob ? k : 0;
    }
    function streakDrawdown(risk, k) { return 1 - Math.pow(1 - risk, k); }

    g.CBRisk = {
        normCdf: normCdf, normInv: normInv,
        liqDistance: liqDistance, barrierLog: barrierLog, touchProb: touchProb,
        daysToProb: daysToProb, maxLeverage: maxLeverage,
        simulate: simulate, kelly: kelly,
        streakProb: streakProb, streakAtProb: streakAtProb, streakDrawdown: streakDrawdown
    };

    // ---------- DOM helpers --------------------------------------------------
    if (typeof document === 'undefined') return;
    function $(id) { return document.getElementById(id); }
    function num(id) { var el = $(id); return el ? parseFloat(el.value) : NaN; }
    function setText(id, t) { var el = $(id); if (el) el.textContent = t; }
    function pct(x, d) { return Number.isFinite(x) ? (x * 100).toFixed(d == null ? 1 : d) + '%' : '--'; }
    function pctSmart(x) {
        if (!Number.isFinite(x)) return '--';
        if (x > 0 && x < 0.0005) return '<0.05%';
        if (x > 0.9995) return '>99.9%';
        return (x * 100).toFixed(x < 0.1 ? 2 : 1) + '%';
    }
    function usd(n) {
        if (!Number.isFinite(n)) return '--';
        return '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function price(n) {
        if (!Number.isFinite(n)) return '--';
        var d = n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
        return '$' + n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
    }
    function daysText(d) {
        if (!Number.isFinite(d)) return '100+ years';
        if (d < 1) return (d * 24).toFixed(d * 24 < 10 ? 1 : 0) + ' hours';
        if (d < 365) return d.toFixed(d < 10 ? 1 : 0) + ' days';
        return (d / 365).toFixed(1) + ' years';
    }
    function showWarn(id, msg) {
        var w = $(id);
        if (!w) return;
        w.textContent = msg || '';
        w.classList.toggle('show', !!msg);
    }
    function bind(ids, fn) {
        ids.forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener('input', fn);
            el.addEventListener('change', fn);
        });
    }
    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    // ---------- page 1: liquidation probability -----------------------------
    function initLiqProb() {
        if (!$('lp-leverage')) return;
        var side = 'long';
        var presets = { btc: 45, eth: 65, sol: 85, alt: 110, meme: 160 };
        function set(s) {
            side = s;
            $('lp-side-long').classList.toggle('active', s === 'long');
            $('lp-side-short').classList.toggle('active', s === 'short');
            $('lp-side-long').setAttribute('aria-pressed', String(s === 'long'));
            $('lp-side-short').setAttribute('aria-pressed', String(s === 'short'));
            recalc();
        }
        function recalc() {
            var entry = num('lp-entry'), lev = num('lp-leverage'), vol = num('lp-vol') / 100;
            var days = num('lp-days'), mmr = num('lp-mmr') / 100, mu = (num('lp-drift') || 0) / 100;
            var target = num('lp-target') / 100;
            var ids = ['lp-out-prob', 'lp-out-price', 'lp-out-dist', 'lp-out-sigmas', 'lp-out-t50', 'lp-out-t5', 'lp-out-maxlev',
                'lp-p1', 'lp-p7', 'lp-p30', 'lp-p90'];
            if (!(entry > 0) || !(lev >= 1) || !(vol > 0) || !(days > 0) || !(mmr >= 0)) {
                ids.forEach(function (i) { setText(i, '--'); });
                showWarn('lp-warning', 'Enter a valid entry price, leverage (1 or more), volatility and horizon.');
                return;
            }
            var dist = liqDistance(lev, mmr);
            if (dist <= 0) {
                ids.forEach(function (i) { setText(i, '--'); });
                setText('lp-out-prob', '100%');
                showWarn('lp-warning', 'At this leverage the maintenance margin alone is larger than your margin, so the position is liquidated at entry.');
                return;
            }
            showWarn('lp-warning', '');
            var a = barrierLog(side, dist);
            var liq = side === 'short' ? entry * (1 + dist) : entry * (1 - dist);
            var p = touchProb(a, vol, days, mu, side);
            setText('lp-out-prob', pctSmart(p));
            setText('lp-out-sub', 'chance the price touches your liquidation price at least once in ' + daysText(days));
            setText('lp-out-price', price(liq));
            setText('lp-out-dist', pct(dist, 2));
            setText('lp-out-sigmas', (a / (vol / Math.sqrt(365))).toFixed(1));
            setText('lp-out-t50', daysText(daysToProb(a, vol, mu, side, 0.5)));
            setText('lp-out-t5', daysText(daysToProb(a, vol, mu, side, 0.05)));
            setText('lp-p1', pctSmart(touchProb(a, vol, 1, mu, side)));
            setText('lp-p7', pctSmart(touchProb(a, vol, 7, mu, side)));
            setText('lp-p30', pctSmart(touchProb(a, vol, 30, mu, side)));
            setText('lp-p90', pctSmart(touchProb(a, vol, 90, mu, side)));
            if (target > 0 && target < 1) {
                var ml = maxLeverage(target, vol, days, mu, side, mmr);
                setText('lp-out-maxlev', ml >= 100 ? '100x+' : ml.toFixed(ml < 10 ? 1 : 0) + 'x');
            } else setText('lp-out-maxlev', '--');
        }
        $('lp-side-long').addEventListener('click', function () { set('long'); });
        $('lp-side-short').addEventListener('click', function () { set('short'); });
        var sel = $('lp-preset');
        if (sel) sel.addEventListener('change', function () {
            if (presets[sel.value]) { $('lp-vol').value = presets[sel.value]; recalc(); }
        });
        bind(['lp-entry', 'lp-leverage', 'lp-vol', 'lp-days', 'lp-mmr', 'lp-drift', 'lp-target'], recalc);
        recalc();
    }

    // ---------- page 2: risk of ruin ----------------------------------------
    function initRuin() {
        if (!$('rr-win')) return;
        function recalc() {
            var p = num('rr-win') / 100, rr = num('rr-ratio'), risk = num('rr-risk') / 100;
            var n = Math.round(num('rr-trades')), dd = num('rr-dd') / 100, cost = num('rr-cost') || 0;
            var ids = ['rr-out-ruin', 'rr-out-loss', 'rr-out-med', 'rr-out-p5', 'rr-out-p95', 'rr-out-dd', 'rr-out-dd95', 'rr-out-ev', 'rr-out-kelly'];
            if (!(p > 0 && p < 1) || !(rr > 0) || !(risk > 0 && risk < 1) || !(n >= 1 && n <= 5000) || !(dd > 0 && dd < 1)) {
                ids.forEach(function (i) { setText(i, '--'); });
                showWarn('rr-warning', 'Use a win rate between 0 and 100, a positive ratio, risk between 0 and 100%, 1 to 5,000 trades and a drawdown between 0 and 100%.');
                return;
            }
            showWarn('rr-warning', '');
            var s = simulate({ p: p, rr: rr, risk: risk, n: n, dd: dd, cost: cost });
            var ev = p * (rr - cost) - (1 - p) * (1 + cost);
            var k = kelly(p, rr - cost);
            setText('rr-out-ruin', pctSmart(s.pRuin));
            setText('rr-out-sub', 'chance of a ' + (dd * 100).toFixed(0) + '% drawdown at some point in ' + n + ' trades (' + s.runs.toLocaleString() + ' simulated accounts)');
            setText('rr-out-loss', pctSmart(s.pBelowStart));
            setText('rr-out-med', s.endMedian.toFixed(2) + 'x');
            setText('rr-out-p5', s.endP5.toFixed(2) + 'x');
            setText('rr-out-p95', s.endP95.toFixed(2) + 'x');
            setText('rr-out-dd', pct(s.ddMedian, 1));
            setText('rr-out-dd95', pct(s.ddP95, 1));
            setText('rr-out-ev', (ev >= 0 ? '+' : '') + ev.toFixed(2) + 'R');
            if (!(k > 0)) setText('rr-out-kelly', 'No edge');
            else setText('rr-out-kelly', pct(risk / k, 0) + ' of full Kelly');
            showWarn('rr-warning', ev <= 0 ? 'This plan has zero or negative expectancy, so given enough trades the account is expected to shrink. The ruin odds above show how fast.' : '');
        }
        bind(['rr-win', 'rr-ratio', 'rr-risk', 'rr-trades', 'rr-dd', 'rr-cost'], recalc);
        recalc();
    }

    // ---------- page 3: losing streaks --------------------------------------
    function initStreak() {
        if (!$('ls-win')) return;
        function recalc() {
            var win = num('ls-win') / 100, n = Math.round(num('ls-trades')), risk = num('ls-risk') / 100;
            var ids = ['ls-out-med', 'ls-out-p5', 'ls-out-p1', 'ls-out-dd50', 'ls-out-dd5', 'ls-out-k'];
            if (!(win > 0 && win < 1) || !(n >= 1 && n <= 10000) || !(risk > 0 && risk < 1)) {
                ids.forEach(function (i) { setText(i, '--'); });
                showWarn('ls-warning', 'Use a win rate between 0 and 100, 1 to 10,000 trades and risk between 0 and 100%.');
                return;
            }
            showWarn('ls-warning', '');
            var q = 1 - win;
            var k50 = streakAtProb(q, n, 0.5), k5 = streakAtProb(q, n, 0.05), k1 = streakAtProb(q, n, 0.01);
            setText('ls-out-med', k50 + ' in a row');
            setText('ls-out-sub', 'a losing streak this long or longer happens in half of all ' + n + '-trade runs');
            setText('ls-out-p5', k5 + ' in a row');
            setText('ls-out-p1', k1 + ' in a row');
            setText('ls-out-dd50', pct(streakDrawdown(risk, k50), 1));
            setText('ls-out-dd5', pct(streakDrawdown(risk, k5), 1));
            var kk = Math.round(num('ls-k'));
            if (kk >= 1 && kk <= n) setText('ls-out-k', pctSmart(streakProb(q, n, kk)));
            else setText('ls-out-k', '--');
        }
        bind(['ls-win', 'ls-trades', 'ls-risk', 'ls-k'], recalc);
        recalc();
    }

    ready(function () { initLiqProb(); initRuin(); initStreak(); });
})(typeof window !== 'undefined' ? window : globalThis);