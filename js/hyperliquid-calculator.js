/*
 * Hyperliquid position size calculator.
 *
 * Rules used (from Hyperliquid's published docs, checked 2026-11-20):
 *  - Maintenance margin is half of the initial margin at the asset's max leverage,
 *    so MMR = 1 / (2 x maxLeverage)  (1.25% at 40x, 16.7% at 3x).
 *  - liq_price = price - side * margin_available / position_size / (1 - l * side),
 *    with l = MMR and side = +1 (long) or -1 (short), isolated margin_available =
 *    isolated margin - maintenance margin required.
 *  - Funding is paid every hour at 1/8 of the computed 8-hour rate.
 *
 * Simplifications: margin tiers for very large positions, fees, slippage and
 * cross-margin effects are not modelled. Liquidations use the mark price on the
 * exchange, which can differ from the last traded price.
 */
(function (root) {
    'use strict';

    function compute(i) {
        var side = i.side === 'short' ? -1 : 1;
        var out = { ok: false, warn: [] };
        var vals = [i.balance, i.risk, i.entry, i.stop, i.maxLev, i.lev];
        for (var k = 0; k < vals.length; k++) {
            if (!Number.isFinite(vals[k])) { out.error = 'invalid'; return out; }
        }
        if (i.balance <= 0 || i.risk <= 0 || i.risk >= 100 || i.entry <= 0 || i.stop <= 0 || i.maxLev < 1 || i.lev < 1) {
            out.error = 'invalid'; return out;
        }
        if (i.entry === i.stop) { out.error = 'stop-equals-entry'; return out; }
        if ((side === 1 && i.stop > i.entry) || (side === -1 && i.stop < i.entry)) {
            out.error = 'stop-wrong-side'; return out;
        }
        var lev = i.lev;
        if (lev > i.maxLev) { lev = i.maxLev; out.warn.push('lev-capped'); }
        var riskAmt = i.balance * i.risk / 100;
        var stopDist = Math.abs(i.entry - i.stop);
        var units = riskAmt / stopDist;
        var notional = units * i.entry;
        var margin = notional / lev;
        var mmr = 1 / (2 * i.maxLev);
        var maint = mmr * notional;
        var avail = margin - maint;
        var liq = i.entry - side * avail / units / (1 - mmr * side);
        var liqDist = Math.abs(i.entry - liq);
        var ratio = liqDist / stopDist;
        var rate = Number.isFinite(i.fundRate) ? i.fundRate : 0;
        var hours = Number.isFinite(i.hours) ? i.hours : 0;
        // positive rate: longs pay shorts. cost > 0 means you pay.
        var fund = notional * (rate / 100) * hours * side;

        out.ok = true;
        out.lev = lev; out.riskAmt = riskAmt; out.units = units; out.notional = notional; out.margin = margin;
        out.mmr = mmr; out.liq = liq; out.liqDist = liqDist; out.ratio = ratio; out.fund = fund; out.stopDist = stopDist;
        out.liqFirst = side === 1 ? liq >= i.stop : liq <= i.stop;
        if (out.liqFirst) out.warn.push('liq-first');
        else if (ratio < 2) out.warn.push('thin-cushion');
        if (margin > i.balance) out.warn.push('margin-over-balance');
        if (avail <= 0) out.warn.push('no-margin-left');
        return out;
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = { compute: compute };
    root.CBHyperliquid = { compute: compute };

    if (typeof document === 'undefined') return;

    function $(id) { return document.getElementById(id); }
    function num(id) { var el = $(id); return el ? parseFloat(el.value) : NaN; }
    function setText(id, t) { var el = $(id); if (el) el.textContent = t; }
    function usd(n) {
        if (!Number.isFinite(n)) return '--';
        return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function units(n) {
        if (!Number.isFinite(n)) return '--';
        var d = n >= 100 ? 2 : n >= 1 ? 3 : n >= 0.01 ? 4 : 6;
        return n.toLocaleString(undefined, { maximumFractionDigits: d });
    }
    function showWarn(msg) {
        var w = $('hl-warning');
        if (!w) return;
        w.textContent = msg || '';
        w.classList.toggle('show', !!msg);
    }

    var MSG = {
        'invalid': 'Enter a balance, a risk % between 0 and 100, an entry, a stop and leverage of 1 or more.',
        'stop-equals-entry': 'The stop-loss must be different from the entry price.',
        'stop-wrong-side': 'For a long the stop must be below the entry; for a short it must be above.',
        'lev-capped': 'Hyperliquid limits leverage to the asset\u2019s max leverage, so the calculation uses that cap.',
        'liq-first': 'Your liquidation price is closer than your stop-loss, so the position would be liquidated before the stop triggers. Lower the leverage or tighten the stop.',
        'thin-cushion': 'Liquidation is less than twice as far from entry as your stop. A thin gap leaves little room for a fast wick, so many traders keep a wider cushion.',
        'margin-over-balance': 'This position needs more margin than your balance. Lowering the leverage will not fix this: reduce the risk % or move the stop closer.',
        'no-margin-left': 'At this leverage the maintenance margin uses up all of the margin, so the position is liquidated at entry.'
    };

    function init() {
        if (!$('hl-balance')) return;
        var side = 'long';
        var l = $('hl-side-long'), s = $('hl-side-short');
        function setSide(v) {
            side = v;
            l.classList.toggle('active', v === 'long');
            s.classList.toggle('active', v === 'short');
            l.setAttribute('aria-pressed', String(v === 'long'));
            s.setAttribute('aria-pressed', String(v === 'short'));
            calc();
        }
        function calc() {
            var r = compute({
                side: side, balance: num('hl-balance'), risk: num('hl-risk'), entry: num('hl-entry'), stop: num('hl-stop'),
                maxLev: num('hl-maxlev'), lev: num('hl-lev'), fundRate: num('hl-fund'), hours: num('hl-hours')
            });
            var ids = ['hl-out-risk', 'hl-out-notional', 'hl-out-margin', 'hl-out-mmr', 'hl-out-liq', 'hl-out-ratio', 'hl-out-fund'];
            if (!r.ok) {
                setText('hl-out-size', '--');
                setText('hl-out-sub', MSG[r.error] || MSG.invalid);
                ids.forEach(function (id) { setText(id, '--'); });
                showWarn('');
                return;
            }
            setText('hl-out-size', units(r.units) + ' units');
            setText('hl-out-sub', 'Size for a ' + usd(r.riskAmt) + ' loss if your stop fills (stop is ' + (r.stopDist / num('hl-entry') * 100).toFixed(2) + '% from entry)');
            setText('hl-out-risk', usd(r.riskAmt));
            setText('hl-out-notional', usd(r.notional));
            setText('hl-out-margin', usd(r.margin) + ' at ' + r.lev + 'x');
            setText('hl-out-mmr', (r.mmr * 100).toFixed(2) + '%');
            setText('hl-out-liq', usd(r.liq));
            setText('hl-out-ratio', r.ratio.toFixed(1) + '\u00d7 your stop distance');
            setText('hl-out-fund', (r.fund >= 0 ? 'Pay ' : 'Receive ') + usd(Math.abs(r.fund)));
            showWarn(r.warn.length ? r.warn.map(function (k) { return MSG[k]; }).join(' ') : '');
        }
        l.addEventListener('click', function () { setSide('long'); });
        s.addEventListener('click', function () { setSide('short'); });
        ['hl-balance', 'hl-risk', 'hl-entry', 'hl-stop', 'hl-maxlev', 'hl-lev', 'hl-fund', 'hl-hours'].forEach(function (id) {
            var el = $(id);
            if (!el) return;
            el.addEventListener('input', calc);
            el.addEventListener('change', calc);
        });
        calc();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);