// ---------------------------------------------------------------------------
// Coin profit calculator (altcoin-profit-calculator.html). Spot trades only:
// buy with a USD amount, sell later, fees charged on both sides. Pure
// arithmetic, no network calls. External file so page CSP needs no inline
// script (see scripts/build-csp.js). Returns early when its markup is absent.
//
//   fee on buy      = invested x fee%
//   units bought    = (invested - fee on buy) / buy price
//   sale proceeds   = units x sell price
//   fee on sell     = proceeds x fee%
//   net profit      = proceeds - fee on sell - invested
//   break-even sell = buy price / (1 - fee%)^2
// ---------------------------------------------------------------------------
(function () {
    function $(id) { return document.getElementById(id); }
    function num(id) { var el = $(id); return el ? parseFloat(el.value) : NaN; }
    function setText(id, txt) { var el = $(id); if (el) el.textContent = txt; }
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
    // Prices of small-cap coins need more decimals than BTC does.
    function price(n) {
        if (!Number.isFinite(n)) return '--';
        var d = n >= 100 ? 2 : n >= 1 ? 4 : n >= 0.01 ? 5 : 8;
        return '$' + n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
    }
    function units(n) {
        if (!Number.isFinite(n)) return '--';
        var d = n >= 100 ? 2 : n >= 1 ? 3 : 6;
        return n.toLocaleString(undefined, { maximumFractionDigits: d });
    }
    function showWarn(msg) {
        var w = $('ap-warning');
        if (!w) return;
        w.textContent = msg || '';
        w.classList.toggle('show', !!msg);
    }
    function clear() {
        ['ap-out-profit', 'ap-out-units', 'ap-out-fees', 'ap-out-proceeds', 'ap-out-roi', 'ap-out-be', 'ap-out-target', 'ap-out-move']
            .forEach(function (id) { setText(id, '--'); });
        setText('ap-out-sub', 'Enter a buy price, sell price and amount.');
    }

    function calc() {
        var invested = num('ap-amount'), buy = num('ap-buy'), sell = num('ap-sell');
        var feePct = num('ap-fee'), target = num('ap-target');
        var main = $('ap-out-profit');
        if (!(invested > 0) || !(buy > 0) || !(sell > 0)) { clear(); showWarn(''); return; }
        if (!Number.isFinite(feePct) || feePct < 0) feePct = 0;
        if (feePct >= 50) { clear(); showWarn('Fee per side must be below 50%.'); return; }
        showWarn('');
        var f = feePct / 100;
        var buyFee = invested * f;
        var qty = (invested - buyFee) / buy;
        var gross = qty * sell;
        var sellFee = gross * f;
        var net = gross - sellFee;
        var profit = net - invested;
        var roi = profit / invested * 100;
        var breakEven = buy / Math.pow(1 - f, 2);
        var coin = $('ap-out-coin') ? $('ap-out-coin').textContent : '';

        setText('ap-out-profit', usd(profit, true));
        setText('ap-out-sub', (profit >= 0 ? 'Net profit' : 'Net loss') + ' after fees \u00b7 ROI ' + pct(roi, true) + (coin ? ' \u00b7 ' + coin : ''));
        setText('ap-out-units', units(qty));
        setText('ap-out-fees', usd(buyFee + sellFee));
        setText('ap-out-proceeds', usd(net));
        setText('ap-out-roi', pct(roi, true));
        setText('ap-out-be', price(breakEven));
        setText('ap-out-move', pct((sell / buy - 1) * 100, true));
        if (Number.isFinite(target) && target > -100) {
            setText('ap-out-target', price(invested * (1 + target / 100) / (qty * (1 - f))));
        } else {
            setText('ap-out-target', '--');
        }
        if (main) main.classList.toggle('lc-neg', profit < 0);
        var r = $('ap-out-roi');
        if (r) r.classList.toggle('lc-neg', profit < 0);
    }

    function init() {
        if (!$('ap-amount')) return;
        var ids = ['ap-amount', 'ap-buy', 'ap-sell', 'ap-fee', 'ap-target'];
        ids.forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener('input', calc);
            el.addEventListener('change', calc);
        });
        var coin = $('ap-coin');
        if (coin) {
            coin.addEventListener('change', function () {
                var opt = coin.options ? coin.options[coin.selectedIndex] : null;
                setText('ap-out-coin', opt ? (opt.getAttribute('data-sym') || opt.value) : '');
                calc();
            });
        }
        calc();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();