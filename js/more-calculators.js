// ---------------------------------------------------------------------------
// More free calculators: dca-calculator.html, crypto-average-price-calculator.html,
// risk-reward-calculator.html, crypto-staking-calculator.html,
// impermanent-loss-calculator.html, crypto-roi-calculator.html,
// fibonacci-retracement-calculator.html. Pure arithmetic, no network calls and
// no dependency on the numbered js/00-.. app modules. External file (not
// inline) so page CSP script-src needs no 'unsafe-inline' - see
// scripts/build-csp.js. Each init() returns early when its markup is absent,
// so one file serves all seven pages.
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
    function price(n) {
        if (!Number.isFinite(n)) return '--';
        var d = Math.abs(n) >= 1 ? 2 : Math.abs(n) >= 0.01 ? 4 : 6;
        return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
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
    function clear(ids) { ids.forEach(function (i) { setText(i, '--'); }); }
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

    // ---- Dollar-cost averaging ----------------------------------------------
    // Buys are spread evenly over the period and the price moves in a straight
    // line from the first buy to the last. That is a deliberate simplification:
    // real prices zig-zag, which is why the page says to treat it as a model.
    function initDca() {
        if (!$('dc-amount')) return;
        function calc() {
            var amt = num('dc-amount'), n = Math.floor(num('dc-count')),
                p0 = num('dc-start'), p1 = num('dc-end');
            showWarn('dc-warning', '');
            if (!(amt > 0) || !(n >= 1) || !(p0 > 0) || !(p1 > 0)) {
                setText('dc-out-main', '--');
                setText('dc-out-sub', 'Enter an amount, number of buys and a start and end price.');
                clear(['dc-out-invested', 'dc-out-avg', 'dc-out-units', 'dc-out-roi', 'dc-out-lump', 'dc-out-lumproi']);
                return;
            }
            var totalUnits = 0, i, p;
            for (i = 0; i < n; i++) {
                p = n === 1 ? p0 : p0 + (p1 - p0) * i / (n - 1);
                totalUnits += amt / p;
            }
            var invested = amt * n;
            var value = totalUnits * p1;
            var avg = invested / totalUnits;
            var roi = (value - invested) / invested * 100;
            var lumpValue = invested / p0 * p1;
            var lumpRoi = (lumpValue - invested) / invested * 100;
            setText('dc-out-main', usd(value));
            setText('dc-out-sub', 'Value at the end price · ' + pct(roi, true) + ' on ' + usd(invested) + ' invested');
            setText('dc-out-invested', usd(invested));
            setText('dc-out-avg', price(avg));
            setText('dc-out-units', units(totalUnits));
            setText('dc-out-roi', pct(roi, true));
            setText('dc-out-lump', usd(lumpValue));
            setText('dc-out-lumproi', pct(lumpRoi, true));
            tone('dc-out-roi', roi);
            tone('dc-out-lumproi', lumpRoi);
            if (n > 520) showWarn('dc-warning', 'That is a very large number of buys. Check the figure is what you meant.');
        }
        bind(['dc-amount', 'dc-count', 'dc-start', 'dc-end'], calc);
        calc();
    }

    // ---- Average buy price ----------------------------------------------------
    function initAverage() {
        if (!$('av-p1')) return;
        var ROWS = 5;
        function calc() {
            var cost = 0, qty = 0, used = 0, i, p, q;
            for (i = 1; i <= ROWS; i++) {
                p = num('av-p' + i); q = num('av-q' + i);
                if (p > 0 && q > 0) { cost += p * q; qty += q; used++; }
            }
            var cur = num('av-current');
            showWarn('av-warning', '');
            if (!used) {
                setText('av-out-avg', '--');
                setText('av-out-sub', 'Enter at least one buy with a price and a quantity.');
                clear(['av-out-qty', 'av-out-cost', 'av-out-value', 'av-out-pnl', 'av-out-pct']);
                return;
            }
            var avg = cost / qty;
            setText('av-out-avg', price(avg));
            setText('av-out-sub', used + ' buy' + (used > 1 ? 's' : '') + ' combined · break-even is the average price (before fees)');
            setText('av-out-qty', units(qty));
            setText('av-out-cost', usd(cost));
            if (cur > 0) {
                var value = qty * cur, pnl = value - cost, p2 = pnl / cost * 100;
                setText('av-out-value', usd(value));
                setText('av-out-pnl', usd(pnl, true));
                setText('av-out-pct', pct(p2, true));
                tone('av-out-pnl', pnl);
                tone('av-out-pct', pnl);
            } else {
                clear(['av-out-value', 'av-out-pnl', 'av-out-pct']);
            }
        }
        var ids = ['av-current'], i;
        for (i = 1; i <= ROWS; i++) { ids.push('av-p' + i); ids.push('av-q' + i); }
        bind(ids, calc);
        calc();
    }

    // ---- Risk / reward ----------------------------------------------------------
    function initRiskReward() {
        if (!$('rr-entry')) return;
        var st;
        function calc() {
            var entry = num('rr-entry'), stop = num('rr-stop'), target = num('rr-target');
            showWarn('rr-warning', '');
            if (!(entry > 0) || !(stop > 0) || !(target > 0)) {
                setText('rr-out-ratio', '--');
                setText('rr-out-sub', 'Enter an entry, a stop-loss and a take-profit price.');
                clear(['rr-out-risk', 'rr-out-reward', 'rr-out-win', 'rr-out-riskpct', 'rr-out-rewardpct', 'rr-out-ev']);
                return;
            }
            var long = st.side === 'long';
            var risk = long ? entry - stop : stop - entry;
            var reward = long ? target - entry : entry - target;
            var msg = '';
            if (!(risk > 0)) msg = long ? 'For a long, the stop-loss must be below the entry price.' : 'For a short, the stop-loss must be above the entry price.';
            else if (!(reward > 0)) msg = long ? 'For a long, the take-profit must be above the entry price.' : 'For a short, the take-profit must be below the entry price.';
            if (msg) {
                setText('rr-out-ratio', '--');
                setText('rr-out-sub', 'Check the direction of your stop and target.');
                clear(['rr-out-risk', 'rr-out-reward', 'rr-out-win', 'rr-out-riskpct', 'rr-out-rewardpct', 'rr-out-ev']);
                showWarn('rr-warning', msg);
                return;
            }
            var r = reward / risk;
            var be = 1 / (1 + r) * 100;
            setText('rr-out-ratio', '1 : ' + r.toFixed(2));
            setText('rr-out-sub', 'You stand to make ' + r.toFixed(2) + 'x what you risk · break-even win rate ' + be.toFixed(1) + '%');
            setText('rr-out-risk', price(risk));
            setText('rr-out-reward', price(reward));
            setText('rr-out-riskpct', pct(risk / entry * 100));
            setText('rr-out-rewardpct', pct(reward / entry * 100));
            setText('rr-out-win', be.toFixed(1) + '%');
            var wr = num('rr-winrate');
            if (wr >= 0 && wr <= 100) {
                var ev = (wr / 100) * r - (1 - wr / 100); // expectancy in R per trade
                setText('rr-out-ev', (ev >= 0 ? '+' : '') + ev.toFixed(2) + 'R');
                tone('rr-out-ev', ev);
            } else {
                setText('rr-out-ev', '--');
            }
            if (r < 1) showWarn('rr-warning', 'The reward is smaller than the risk, so you would need to win more than half your trades just to break even.');
        }
        st = sideToggle('rr', calc);
        bind(['rr-entry', 'rr-stop', 'rr-target', 'rr-winrate'], calc);
        calc();
    }

    // ---- Staking / compound rewards -----------------------------------------------
    function initStaking() {
        if (!$('sk-principal')) return;
        function calc() {
            var p = num('sk-principal'), apr = num('sk-apr') / 100, yrs = num('sk-years'),
                f = num('sk-comp'), add = num('sk-contrib');
            if (!(add >= 0)) add = 0;
            showWarn('sk-warning', '');
            if (!(p >= 0) || !(apr >= 0) || !(yrs > 0) || !(f >= 1) || (p === 0 && add === 0)) {
                setText('sk-out-final', '--');
                setText('sk-out-sub', 'Enter a starting amount, a rate and a number of years.');
                clear(['sk-out-contrib', 'sk-out-rewards', 'sk-out-apy', 'sk-out-simple', 'sk-out-extra']);
                return;
            }
            var months = Math.round(yrs * 12);
            var g = Math.pow(1 + apr / f, f / 12); // monthly growth that matches the compounding frequency
            var bal = p, i;
            for (i = 0; i < months; i++) bal = bal * g + add;
            var contributed = p + add * months;
            var rewards = bal - contributed;
            var apy = (Math.pow(1 + apr / f, f) - 1) * 100;
            var simple = p * (1 + apr * months / 12) + add * months + add * apr * (months * (months - 1) / 2) / 12;
            setText('sk-out-final', usd(bal));
            setText('sk-out-sub', 'Projected balance after ' + months + ' month' + (months === 1 ? '' : 's') + ' · rewards ' + usd(rewards));
            setText('sk-out-contrib', usd(contributed));
            setText('sk-out-rewards', usd(rewards));
            setText('sk-out-apy', apy.toFixed(2) + '%');
            setText('sk-out-simple', usd(simple));
            setText('sk-out-extra', usd(bal - simple));
            if (apr * 100 >= 30) showWarn('sk-warning', 'Rates this high are usually temporary or come with extra risk (token price falls, lock-ups, smart-contract risk). Treat the result as a best case, not a forecast.');
        }
        bind(['sk-principal', 'sk-apr', 'sk-years', 'sk-comp', 'sk-contrib'], calc);
        calc();
    }

    // ---- Impermanent loss (50/50 constant-product pool) --------------------------------
    function initImpermanent() {
        if (!$('il-change')) return;
        function calc() {
            var ch = num('il-change'), dep = num('il-deposit'), fee = num('il-fees');
            if (!(fee >= 0)) fee = 0;
            showWarn('il-warning', '');
            if (!(ch > -100) || !(dep > 0)) {
                setText('il-out-pct', '--');
                setText('il-out-sub', 'Enter a price change above -100% and a deposit.');
                clear(['il-out-hold', 'il-out-pool', 'il-out-loss', 'il-out-fees', 'il-out-net', 'il-out-be']);
                return;
            }
            var r = 1 + ch / 100;
            var il = 2 * Math.sqrt(r) / (1 + r) - 1; // negative or zero
            var hold = dep * (1 + r) / 2;
            var pool = dep * Math.sqrt(r);
            var feesUsd = dep * fee / 100;
            var net = pool + feesUsd - hold;
            setText('il-out-pct', pct(il * 100));
            tone('il-out-pct', il);
            setText('il-out-sub', 'Pool is worth ' + Math.abs(il * 100).toFixed(2) + '% less than simply holding the same two tokens');
            setText('il-out-hold', usd(hold));
            setText('il-out-pool', usd(pool));
            setText('il-out-loss', usd(pool - hold, true));
            setText('il-out-fees', usd(feesUsd));
            setText('il-out-net', usd(net, true));
            setText('il-out-be', ((hold - pool) / dep * 100).toFixed(2) + '%'); // fees needed, as % of the deposit
            tone('il-out-loss', pool - hold);
            tone('il-out-net', net);
            if (Math.abs(ch) >= 90) showWarn('il-warning', 'A move this large is extreme. The formula still holds, but real pools may also suffer from token-specific risks such as de-pegs or rug pulls.');
        }
        bind(['il-change', 'il-deposit', 'il-fees'], calc);
        calc();
    }

    // ---- Spot ROI and break-even ---------------------------------------------------
    function initRoi() {
        if (!$('ro-buy')) return;
        function calc() {
            var buy = num('ro-buy'), sell = num('ro-sell'), inv = num('ro-invest'), f = num('ro-fee') / 100;
            if (!(f >= 0)) f = 0;
            showWarn('ro-warning', '');
            if (!(buy > 0) || !(sell > 0) || !(inv > 0) || f >= 0.5) {
                setText('ro-out-net', '--');
                setText('ro-out-sub', 'Enter a buy price, a sell price and an amount invested.');
                clear(['ro-out-roi', 'ro-out-fees', 'ro-out-units', 'ro-out-proceeds', 'ro-out-be', 'ro-out-move', 'ro-out-recover']);
                return;
            }
            var qty = inv * (1 - f) / buy;        // fee is taken out of the amount you spend
            var gross = qty * sell;
            var proceeds = gross * (1 - f);       // fee is taken out of the sale
            var net = proceeds - inv;
            var roi = net / inv * 100;
            var fees = inv * f + gross * f;
            var be = buy / ((1 - f) * (1 - f));
            var move = (sell - buy) / buy * 100;
            setText('ro-out-net', usd(net, true));
            tone('ro-out-net', net);
            setText('ro-out-sub', (net >= 0 ? 'Net profit' : 'Net loss') + ' after fees · ROI ' + pct(roi, true));
            setText('ro-out-roi', pct(roi, true));
            tone('ro-out-roi', net);
            setText('ro-out-fees', usd(fees));
            setText('ro-out-units', units(qty));
            setText('ro-out-proceeds', usd(proceeds));
            setText('ro-out-be', price(be));
            setText('ro-out-move', pct(move, true));
            tone('ro-out-move', move);
            if (net < 0) setText('ro-out-recover', '+' + ((inv / proceeds - 1) * 100).toFixed(2) + '%');
            else setText('ro-out-recover', 'Not needed');
        }
        bind(['ro-buy', 'ro-sell', 'ro-invest', 'ro-fee'], calc);
        calc();
    }

    // ---- Fibonacci retracement ------------------------------------------------------
    function initFib() {
        if (!$('fb-high')) return;
        var st;
        var RET = [['l0', 0], ['l236', 0.236], ['l382', 0.382], ['l50', 0.5], ['l618', 0.618], ['l786', 0.786], ['l100', 1]];
        var EXT = [['e1272', 1.272], ['e1618', 1.618], ['e2618', 2.618]];
        function calc() {
            var hi = num('fb-high'), lo = num('fb-low');
            showWarn('fb-warning', '');
            var ids = RET.concat(EXT).map(function (x) { return 'fb-out-' + x[0]; });
            if (!(hi > 0) || !(lo > 0) || !(hi > lo)) {
                setText('fb-out-sub', 'Enter a swing high that is above the swing low.');
                clear(ids);
                if (hi > 0 && lo > 0 && !(hi > lo)) showWarn('fb-warning', 'The swing high must be greater than the swing low.');
                return;
            }
            var up = st.side === 'long';
            var range = hi - lo;
            RET.forEach(function (x) {
                setText('fb-out-' + x[0], price(up ? hi - range * x[1] : lo + range * x[1]));
            });
            EXT.forEach(function (x) {
                setText('fb-out-' + x[0], price(up ? lo + range * x[1] : hi - range * x[1]));
            });
            setText('fb-out-sub', (up ? 'Uptrend: retracements measured down from the high' : 'Downtrend: retracements measured up from the low') + ' · swing range ' + price(range));
        }
        st = sideToggle('fb', calc);
        bind(['fb-high', 'fb-low'], calc);
        calc();
    }

    function init() { initDca(); initAverage(); initRiskReward(); initStaking(); initImpermanent(); initRoi(); initFib(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();