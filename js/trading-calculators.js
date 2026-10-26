// ---------------------------------------------------------------------------
// Standalone trading calculators: position-size-calculator.html,
// crypto-profit-calculator.html, funding-fee-calculator.html. Pure arithmetic,
// no network calls and no dependency on the numbered js/00-.. app modules.
// Kept as an external file (not inline) so page CSP script-src needs no
// 'unsafe-inline' — see scripts/build-csp.js. Each init() returns early when
// its markup is absent, so one file serves all three pages.
// ---------------------------------------------------------------------------
(function () {
    function $(id) { return document.getElementById(id); }
    function num(id) { var el = $(id); return el ? parseFloat(el.value) : NaN; }
    function usd(n, signed) {
        if (!Number.isFinite(n)) return '--';
        var s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (signed) return (n < 0 ? '-$' : '+$') + s;
        return (n < 0 ? '-$' : '$') + s;
    }
    function pct(n, signed) {
        if (!Number.isFinite(n)) return '--';
        return (signed && n > 0 ? '+' : '') + n.toFixed(2) + '%';
    }
    function units(n) {
        if (!Number.isFinite(n)) return '--';
        var d = n >= 100 ? 2 : n >= 1 ? 3 : n >= 0.01 ? 4 : 6;
        return n.toLocaleString(undefined, { maximumFractionDigits: d });
    }
    function setText(id, txt) { var el = $(id); if (el) el.textContent = txt; }
    function tone(id, n) { var el = $(id); if (el) el.classList.toggle('lc-neg', Number.isFinite(n) && n < 0); }
    function showWarn(id, msg) {
        var w = $(id);
        if (!w) return;
        w.textContent = msg || '';
        w.classList.toggle('show', !!msg);
    }
    function sideToggle(prefix, onChange) {
        var l = $(prefix + '-side-long'), s = $(prefix + '-side-short');
        var state = { side: 'long' };
        function set(v) {
            state.side = v;
            l.classList.toggle('active', v === 'long');
            s.classList.toggle('active', v === 'short');
            l.setAttribute('aria-pressed', String(v === 'long'));
            s.setAttribute('aria-pressed', String(v === 'short'));
            onChange();
        }
        l.addEventListener('click', function () { set('long'); });
        s.addEventListener('click', function () { set('short'); });
        return state;
    }
    function bind(ids, fn) {
        ids.forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener('input', fn);
            el.addEventListener('change', fn);
        });
    }

    // ---- Position size -----------------------------------------------------
    function initPosition() {
        if (!$('ps-balance')) return;
        var st;
        function calc() {
            var bal = num('ps-balance'), risk = num('ps-risk'), entry = num('ps-entry'),
                stop = num('ps-stop'), lev = num('ps-lev');
            if (!(lev >= 1)) lev = 1;
            showWarn('ps-warning', '');
            var dist = Math.abs(entry - stop);
            if (!(bal > 0) || !(risk > 0) || !(entry > 0) || !(stop > 0) || !(dist > 0)) {
                setText('ps-out-size', '--');
                setText('ps-out-sub', 'Enter a balance, risk %, entry and a stop-loss different from entry.');
                ['ps-out-risk', 'ps-out-notional', 'ps-out-margin', 'ps-out-r1', 'ps-out-r2', 'ps-out-r3'].forEach(function (i) { setText(i, '--'); });
                return;
            }
            var long = st.side === 'long';
            var msg = '';
            if (long && stop > entry) msg = 'For a long, the stop-loss should be below the entry price.';
            if (!long && stop < entry) msg = 'For a short, the stop-loss should be above the entry price.';
            var riskUsd = bal * risk / 100;
            var qty = riskUsd / dist;
            var notional = qty * entry;
            var margin = notional / lev;
            var dir = long ? 1 : -1;
            setText('ps-out-size', units(qty) + ' units');
            setText('ps-out-sub', 'Stop is ' + (dist / entry * 100).toFixed(2) + '% from entry · position is ' + (notional / bal * 100).toFixed(0) + '% of your balance');
            setText('ps-out-risk', usd(riskUsd));
            setText('ps-out-notional', usd(notional));
            setText('ps-out-margin', usd(margin));
            setText('ps-out-r1', usd(entry + dir * dist));
            setText('ps-out-r2', usd(entry + dir * dist * 2));
            setText('ps-out-r3', usd(entry + dir * dist * 3));
            if (!msg && margin > bal) msg = 'This position needs more margin (' + usd(margin) + ') than your balance. Raise leverage, widen risk tolerance, or tighten the stop.';
            if (!msg && lev > 1) {
                var liqMove = 1 / lev - 0.005; // ~0.5% maintenance margin, rough
                if (liqMove > 0 && dist / entry >= liqMove) {
                    msg = 'At ' + lev + 'x the position is roughly liquidated after a ' + (liqMove * 100).toFixed(2) + '% move, before your stop at ' + (dist / entry * 100).toFixed(2) + '%. Lower the leverage or tighten the stop.';
                }
            }
            showWarn('ps-warning', msg);
        }
        st = sideToggle('ps', calc);
        bind(['ps-balance', 'ps-risk', 'ps-entry', 'ps-stop', 'ps-lev'], calc);
        calc();
    }

    // ---- Futures profit ------------------------------------------------------
    function initProfit() {
        if (!$('pf-entry')) return;
        var st;
        function calc() {
            var entry = num('pf-entry'), exit = num('pf-exit'), margin = num('pf-margin'),
                lev = num('pf-lev'), fee = num('pf-fee') / 100;
            if (!Number.isFinite(fee) || fee < 0) fee = 0;
            showWarn('pf-warning', '');
            if (!(entry > 0) || !(exit > 0) || !(margin > 0) || !(lev >= 1)) {
                setText('pf-out-net', '--');
                setText('pf-out-sub', 'Enter entry, exit, margin and leverage.');
                ['pf-out-gross', 'pf-out-fees', 'pf-out-roe', 'pf-out-notional', 'pf-out-qty', 'pf-out-move'].forEach(function (i) { setText(i, '--'); });
                return;
            }
            var dir = st.side === 'long' ? 1 : -1;
            var notional = margin * lev;
            var qty = notional / entry;
            var gross = qty * (exit - entry) * dir;
            var fees = notional * fee + qty * exit * fee;
            var net = gross - fees;
            var roe = net / margin * 100;
            var move = (exit - entry) / entry * 100 * dir;
            setText('pf-out-net', usd(net, true));
            setText('pf-out-sub', (net >= 0 ? 'Net profit' : 'Net loss') + ' after fees · ROE ' + pct(roe, true));
            setText('pf-out-gross', usd(gross, true));
            setText('pf-out-fees', usd(fees));
            setText('pf-out-roe', pct(roe, true));
            setText('pf-out-notional', usd(notional));
            setText('pf-out-qty', units(qty));
            setText('pf-out-move', pct(move, true));
            ['pf-out-net', 'pf-out-gross', 'pf-out-roe', 'pf-out-move'].forEach(function (i) { tone(i, i === 'pf-out-gross' ? gross : i === 'pf-out-move' ? move : net); });
            if (net <= -margin) {
                showWarn('pf-warning', 'This loss is at or beyond your margin. In practice the position would be liquidated first, so the most you can lose is the margin.');
            } else if (lev > 1) {
                var liqMove = 1 / lev - 0.005;
                if (liqMove > 0 && move < 0 && Math.abs(move) >= liqMove * 100) {
                    showWarn('pf-warning', 'At ' + lev + 'x, a ' + Math.abs(move).toFixed(2) + '% adverse move is past the rough liquidation distance (~' + (liqMove * 100).toFixed(2) + '%). The position would likely be liquidated before this exit.');
                }
            }
        }
        st = sideToggle('pf', calc);
        bind(['pf-entry', 'pf-exit', 'pf-margin', 'pf-lev', 'pf-fee'], calc);
        calc();
    }

    // ---- Funding fee ---------------------------------------------------------
    function initFunding() {
        if (!$('ff-notional')) return;
        var st;
        function calc() {
            var notional = num('ff-notional'), rate = num('ff-rate') / 100,
                interval = num('ff-interval'), days = num('ff-days');
            showWarn('ff-warning', '');
            if (!(notional > 0) || !Number.isFinite(rate) || !(interval > 0) || !(days >= 0)) {
                setText('ff-out-total', '--');
                setText('ff-out-sub', 'Enter a position value, funding rate and holding period.');
                ['ff-out-pay', 'ff-out-day', 'ff-out-month', 'ff-out-count', 'ff-out-apr', 'ff-out-dir'].forEach(function (i) { setText(i, '--'); });
                return;
            }
            var perDay = 24 / interval;
            var long = st.side === 'long';
            // Positive rate: longs pay, shorts receive. cash > 0 means you receive.
            var sign = (long ? -1 : 1) * (rate >= 0 ? 1 : -1);
            var perPay = Math.abs(notional * rate);
            var count = Math.floor(perDay * days + 1e-9);
            var total = sign * perPay * count;
            var perDayAmt = sign * perPay * perDay;
            var month = sign * perPay * perDay * 30;
            var apr = Math.abs(rate) * perDay * 365 * 100;
            setText('ff-out-total', usd(total, true));
            tone('ff-out-total', total);
            setText('ff-out-sub', total === 0 ? 'No funding at a zero rate' : (total < 0 ? 'You pay funding over the holding period' : 'You receive funding over the holding period'));
            setText('ff-out-pay', usd(perPay));
            setText('ff-out-day', usd(Math.abs(perDayAmt)));
            setText('ff-out-month', usd(Math.abs(month)));
            setText('ff-out-count', String(count));
            setText('ff-out-apr', apr.toFixed(2) + '%');
            setText('ff-out-dir', rate === 0 ? 'No payment' : (rate > 0 ? 'Longs pay shorts' : 'Shorts pay longs'));
            if (apr >= 50) showWarn('ff-warning', 'An annualised funding rate this high usually means very crowded positioning, and real rates reset every interval — it rarely stays this high.');
        }
        st = sideToggle('ff', calc);
        bind(['ff-notional', 'ff-rate', 'ff-interval', 'ff-days'], calc);
        calc();
    }

    function init() { initPosition(); initProfit(); initFunding(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();