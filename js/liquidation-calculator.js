// ---------------------------------------------------------------------------
// liquidation-price-calculator.html: standalone long/short liquidation price
// estimator. Pure arithmetic, no fetch calls, no dependency on the numbered
// js/00-.. app modules — this page isn't part of the app.html bundle. Kept as
// a plain external file (rather than an inline <script>) so the page's CSP
// script-src doesn't need 'unsafe-inline' or a hash entry — see the header
// comment in scripts/build-csp.js for why that matters project-wide.
// ---------------------------------------------------------------------------
(function () {
    var side = 'long';

    function fmtUSD(n) {
        if (!Number.isFinite(n)) return '--';
        return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function setSide(s) {
        side = s;
        document.getElementById('lc-side-long').classList.toggle('active', s === 'long');
        document.getElementById('lc-side-short').classList.toggle('active', s === 'short');
        recalc();
    }

    function recalc() {
        var entry = parseFloat(document.getElementById('lc-entry').value);
        var lev = parseFloat(document.getElementById('lc-leverage').value);
        var mmr = parseFloat(document.getElementById('lc-mmr').value) / 100;
        var mode = document.getElementById('lc-margin-mode').value;
        var out = document.getElementById('lc-out-price');
        var sub = document.getElementById('lc-out-sub');
        var warn = document.getElementById('lc-warning');
        warn.classList.remove('show');
        warn.innerText = '';

        if (!(entry > 0) || !(lev >= 1) || !Number.isFinite(mmr) || mmr < 0) {
            out.innerText = '--';
            sub.innerText = 'Enter a valid entry price and leverage.';
            return;
        }

        // Same simplified isolated-margin model as js/16-paper-trading.js's estimateLiqPrice:
        // cushion shrinks as leverage rises (less margin backing each dollar of notional).
        var cushion = (1 / lev) - mmr;
        var liq;
        if (cushion <= 0) {
            // Extreme leverage edge case: maintenance margin alone exceeds available margin.
            liq = side === 'long' ? entry * 1.001 : entry * 0.999;
        } else {
            liq = side === 'long' ? entry * (1 - cushion) : entry * (1 + cushion);
        }
        var distPct = Math.abs((liq - entry) / entry) * 100;

        out.innerText = fmtUSD(liq);
        sub.innerText = 'Estimated liquidation price · ' + distPct.toFixed(2) + '% away from entry' +
            (mode === 'cross' ? ' (cross — rough estimate)' : '');

        if (lev > 20) {
            warn.innerText = 'At ' + lev + 'x, this position liquidates on a ' + distPct.toFixed(2) +
                '% move — a routine intraday swing on many pairs.';
            warn.classList.add('show');
        } else if (mode === 'cross') {
            warn.innerText = 'Cross margin pools your whole futures wallet, so your real liquidation ' +
                'price depends on your total account balance and other open positions, not just this one.';
            warn.classList.add('show');
        }
    }

    function init() {
        var longBtn = document.getElementById('lc-side-long');
        var shortBtn = document.getElementById('lc-side-short');
        if (!longBtn || !shortBtn) return; // script loaded on a page without the calculator markup

        longBtn.addEventListener('click', function () { setSide('long'); });
        shortBtn.addEventListener('click', function () { setSide('short'); });

        ['lc-entry', 'lc-leverage', 'lc-mmr', 'lc-margin-mode'].forEach(function (id) {
            var el = document.getElementById(id);
            el.addEventListener('input', recalc);
            el.addEventListener('change', recalc);
        });

        recalc();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();