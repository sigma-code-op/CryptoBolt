// ---------- Buy/Sell Crypto — redirects to Binance ----------
// This used to open an in-page AlchemyPay fiat on/off-ramp widget. That integration has been
// removed; every Buy/Sell entry point now just sends the visitor to Binance in a new tab with
// the relevant asset (and PKR as the fiat currency, since that's the default most visitors here
// need) preselected. Kept as window.openAlchemyPayWidget (same name/signature) so every existing
// caller across the codebase (chart panel, portfolio panel, futures panel, invest.html) keeps
// working without having to touch each of those files individually.

(function setupBuyRedirect() {
    function binanceUrl(symbol) {
        const sym = String(symbol || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BTC';
        return `https://www.binance.com/en/buy-sell-crypto?fiat=PKR&crypto=${encodeURIComponent(sym)}`;
    }

    function openAlchemyPayWidget(mode, presetSymbol) {
        const url = binanceUrl(presetSymbol);
        window.open(url, '_blank', 'noopener,noreferrer');
    }
    window.openAlchemyPayWidget = openAlchemyPayWidget; // kept for backward compatibility with existing call sites

    function currentChartSymbol() {
        return (typeof selectedAsset !== 'undefined' && selectedAsset && selectedAsset.baseAsset) || 'BTC';
    }
    function firstHoldingSymbol() {
        return (typeof holdings !== 'undefined' && holdings[0] && holdings[0].symbol) || currentChartSymbol();
    }
    function firstFuturesSymbol() {
        return (typeof futuresPositions !== 'undefined' && futuresPositions[0] && futuresPositions[0].symbol) || currentChartSymbol();
    }

    document.getElementById('chart-buy-btn')?.addEventListener('click', () => openAlchemyPayWidget('BUY', currentChartSymbol()));
    document.getElementById('chart-sell-btn')?.addEventListener('click', () => openAlchemyPayWidget('SELL', currentChartSymbol()));

    document.getElementById('portfolio-buy-btn')?.addEventListener('click', () => openAlchemyPayWidget('BUY', firstHoldingSymbol()));
    document.getElementById('portfolio-sell-btn')?.addEventListener('click', () => openAlchemyPayWidget('SELL', firstHoldingSymbol()));

    document.getElementById('futures-buy-btn')?.addEventListener('click', () => openAlchemyPayWidget('BUY', firstFuturesSymbol()));
    document.getElementById('futures-sell-btn')?.addEventListener('click', () => openAlchemyPayWidget('SELL', firstFuturesSymbol()));
})();