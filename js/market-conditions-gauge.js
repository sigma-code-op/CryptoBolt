// ---------------------------------------------------------------------------
// Market Conditions Gauge — shared between app.html's AI Market Insight panel
// and ai.html's AI Research page.
//
// Deliberately NOT a trade plan: no entry zone, no stop, no targets, no
// long/short bias. It just turns data the AI read already computed (ATR
// volatility, Fear & Greed, funding rate) into a quick "what's the backdrop
// right now" visual — informational context the reader interprets themselves,
// not a directive.
// ---------------------------------------------------------------------------
(function (global) {
    'use strict';

    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function volatilityRead(atrPct) {
        if (typeof atrPct !== 'number' || !Number.isFinite(atrPct)) return null;
        let label, color;
        if (atrPct < 1) { label = 'Low'; color = '#4fd8e8'; }
        else if (atrPct < 2.5) { label = 'Normal'; color = '#14d38a'; }
        else if (atrPct < 5) { label = 'Elevated'; color = '#e5b324'; }
        else { label = 'High'; color = '#ff4d6a'; }
        return { label, color, pct: clamp((atrPct / 6) * 100, 4, 100), value: `${atrPct.toFixed(2)}%` };
    }

    function sentimentRead(fearGreed) {
        if (!fearGreed || typeof fearGreed.value !== 'number') return null;
        const v = clamp(fearGreed.value, 0, 100);
        const color = v <= 24 ? '#ff4d6a' : v <= 44 ? '#e5b324' : v <= 55 ? '#9aa3ad' : v <= 75 ? '#14d38a' : '#4fd8e8';
        return { label: fearGreed.classification || '—', color, pct: clamp(v, 2, 100), value: `${v}/100` };
    }

    function positioningRead(fundingRatePct) {
        if (typeof fundingRatePct !== 'number' || !Number.isFinite(fundingRatePct)) return null;
        const magnitude = clamp(Math.abs(fundingRatePct) / 0.05, 0, 1); // 0.05% funding ~= "stretched"
        const label = fundingRatePct > 0.01 ? 'Longs paying shorts' : fundingRatePct < -0.01 ? 'Shorts paying longs' : 'Roughly balanced';
        const color = fundingRatePct >= 0 ? '#14d38a' : '#ff4d6a';
        return { label, color, pct: clamp(50 + (fundingRatePct >= 0 ? 1 : -1) * magnitude * 50, 4, 96), value: `${fundingRatePct >= 0 ? '+' : ''}${fundingRatePct.toFixed(4)}%` };
    }

    function row(icon, title, read) {
        if (!read) return '';
        return `
        <div class="cb-gauge-row">
            <div class="cb-gauge-row-head">
                <span class="cb-gauge-row-title">${icon} ${esc(title)}</span>
                <span class="cb-gauge-row-value" style="color:${read.color}">${esc(read.label)} <span class="cb-gauge-row-num">${esc(read.value)}</span></span>
            </div>
            <div class="cb-gauge-bar"><div class="cb-gauge-fill" style="width:${read.pct}%;background:${read.color}"></div></div>
        </div>`;
    }

    /**
     * data: { atrPct: number|null, fundingRatePct: number|null (futures only), fearGreed: {value, classification}|null, market: 'spot'|'perpetual futures' }
     * Returns an HTML string, or '' if there's nothing worth showing.
     */
    function renderMarketConditionsGauge(data) {
        data = data || {};
        const vol = volatilityRead(data.atrPct);
        const sentiment = sentimentRead(data.fearGreed);
        const positioning = data.market === 'perpetual futures' ? positioningRead(data.fundingRatePct) : null;

        const rows = [
            row('📉', 'Volatility (ATR)', vol),
            row('🧭', 'Sentiment (Fear & Greed)', sentiment),
            row('⚖️', 'Futures positioning', positioning),
        ].filter(Boolean).join('');

        if (!rows) return '';

        return `<div class="cb-gauge-card">
            <div class="cb-gauge-title">📡 Market Conditions</div>
            ${rows}
            <p class="cb-gauge-footnote">Read-only context, not a trade signal — no entry, stop, or target here on purpose.</p>
        </div>`;
    }

    global.renderMarketConditionsGauge = renderMarketConditionsGauge;
})(window);