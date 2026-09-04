// ---------- Buy/Sell Crypto — redirects to Binance ----------
// Every Buy/Sell entry point (chart panel, portfolio panel, futures panel, invest.html) sends
// the visitor to Binance in a new tab with the relevant asset (and PKR as the fiat currency,
// since that's the default most visitors here need) preselected. There is no in-page ramp
// widget or iframe — this is a plain window.open() redirect, nothing more.

(function setupBuyRedirect() {
    function binanceUrl(symbol) {
        const sym = String(symbol || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BTC';
        return `https://www.binance.com/en/buy-sell-crypto?fiat=PKR&crypto=${encodeURIComponent(sym)}`;
    }

    function openBuySellRedirect(mode, presetSymbol) {
        const url = binanceUrl(presetSymbol);
        window.open(url, '_blank', 'noopener,noreferrer');
    }
    window.openBuySellRedirect = openBuySellRedirect;

    function currentChartSymbol() {
        return (typeof selectedAsset !== 'undefined' && selectedAsset && selectedAsset.baseAsset) || 'BTC';
    }
    function firstHoldingSymbol() {
        return (typeof holdings !== 'undefined' && holdings[0] && holdings[0].symbol) || currentChartSymbol();
    }
    function firstFuturesSymbol() {
        return (typeof futuresPositions !== 'undefined' && futuresPositions[0] && futuresPositions[0].symbol) || currentChartSymbol();
    }

    document.getElementById('chart-buy-btn')?.addEventListener('click', () => openBuySellRedirect('BUY', currentChartSymbol()));
    document.getElementById('chart-sell-btn')?.addEventListener('click', () => openBuySellRedirect('SELL', currentChartSymbol()));

    document.getElementById('portfolio-buy-btn')?.addEventListener('click', () => openBuySellRedirect('BUY', firstHoldingSymbol()));
    document.getElementById('portfolio-sell-btn')?.addEventListener('click', () => openBuySellRedirect('SELL', firstHoldingSymbol()));

    document.getElementById('futures-buy-btn')?.addEventListener('click', () => openBuySellRedirect('BUY', firstFuturesSymbol()));
    document.getElementById('futures-sell-btn')?.addEventListener('click', () => openBuySellRedirect('SELL', firstFuturesSymbol()));
})();