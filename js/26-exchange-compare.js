// ---------- Multi-exchange price comparison (Binance vs Coinbase) ----------
// A small addition to the HUD strip: alongside Binance's own index price (already shown in
// #hud-price), fetch the same asset's spot price from Coinbase's public API and show the
// spread between the two. No API key needed — this is Coinbase's unauthenticated public spot
// price endpoint, same trust tier as the Binance/CoinGecko/Fear&Greed calls elsewhere in this
// codebase (see js/06-chart-engine.js, js/10-ai-insight.js).
//
// Deliberately loose coupling with the rest of the app, matching the existing pattern for
// optional per-asset panels (see the `typeof syncRiskCalcForAsset === 'function'` guard at the
// end of selectAsset() in js/04-ticker-sockets.js): this file defines
// `updateExchangeCompare(item)` as a plain top-level function (shared global scope — see the
// note at the top of js/16-paper-trading.js for why that's how this project's non-bundled
// pages share state) and js/04-ticker-sockets.js calls it the same defensive way if it exists.
// Nothing breaks if this file is ever removed from a page's bundle.
//
// Coverage: Coinbase doesn't list every pair Binance does (many small-cap/futures-only
// symbols have no Coinbase spot market at all) — the widget simply stays hidden for those
// rather than showing a wrong or empty comparison.

let exchangeCompareRequestToken = 0;

async function updateExchangeCompare(item) {
    const wrap = document.getElementById('hud-exchange-compare-wrap');
    const valueEl = document.getElementById('hud-exchange-compare');
    if (!wrap || !valueEl || !item) return;

    wrap.classList.add('hidden'); // hide immediately on every asset switch, then reveal only on a successful match

    const myToken = ++exchangeCompareRequestToken;
    const base = (item.baseAsset || '').toUpperCase();
    if (!base) return;

    try {
        const res = await fetch(`https://api.coinbase.com/v2/prices/${base}-USD/spot`);
        if (myToken !== exchangeCompareRequestToken) return; // asset changed again while this was in flight
        if (!res.ok) return; // most commonly a 404 — Coinbase has no USD spot market for this asset

        const data = await res.json();
        const coinbasePrice = parseFloat(data?.data?.amount);
        if (!Number.isFinite(coinbasePrice) || coinbasePrice <= 0) return;

        // item.price is Binance's own index/last price, already tracked live elsewhere on the
        // HUD (#hud-price) — comparing against that (not re-fetching Binance here) keeps this
        // widget to a single extra network call per asset switch.
        const binancePrice = item.price;
        if (!Number.isFinite(binancePrice) || binancePrice <= 0) return;

        const spreadPct = ((binancePrice - coinbasePrice) / coinbasePrice) * 100;
        const precision = coinbasePrice < 1 ? 5 : 2;
        const sign = spreadPct >= 0 ? '+' : '';
        valueEl.innerText = `$${coinbasePrice.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: 6 })} (${sign}${spreadPct.toFixed(2)}%)`;
        valueEl.className = `text-sm font-mono font-bold ${Math.abs(spreadPct) < 0.05 ? 'text-gray-300' : (spreadPct >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]')}`;
        wrap.classList.remove('hidden');
    } catch {
        // network hiccup / CSP block on an unusual deployment / Coinbase outage — stay quiet,
        // the widget just doesn't appear for this asset switch, same as a 404 above.
    }
}