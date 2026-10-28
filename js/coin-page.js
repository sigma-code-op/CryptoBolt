// ---------------------------------------------------------------------------
// Dedicated coin pages (bitcoin.html, ethereum.html, solana.html): live panel.
//
// Reads the symbol from <section id="coin-live" data-symbol="BTCUSDT"
// data-ratio="ETHBTC" data-ratio-label="ETH / BTC"> and fills in:
//   - last price, 24h change, 24h high / low, 24h volume (Binance spot 24hr ticker)
//   - perpetual funding rate + next funding time, open interest (Binance futures)
//   - a 24-hour hourly sparkline (Binance spot klines)
//   - an optional cross ratio such as ETH/BTC
//
// Only public, unauthenticated endpoints that are already allowed by the CSP
// connect-src (api.binance.com, data-api.binance.vision, fapi.binance.com).
// Values are written with textContent / SVG attributes only, never innerHTML,
// so API data can never inject markup. Every request fails soft: a missing
// number shows an em dash and the rest of the page keeps working.
// ---------------------------------------------------------------------------
(function () {
    'use strict';

    var root = document.getElementById('coin-live');
    if (!root) return;

    var SYMBOL = root.getAttribute('data-symbol');
    var BASE = root.getAttribute('data-base') || SYMBOL.replace(/USDT$/, '');
    var RATIO = root.getAttribute('data-ratio');
    var SPOT_HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision'];
    var FUTURES = 'https://fapi.binance.com';
    var DASH = '\u2014';

    function $(id) { return document.getElementById(id); }
    function set(id, text, cls) {
        var el = $(id);
        if (!el) return;
        el.textContent = text;
        if (cls !== undefined) {
            el.classList.remove('mk-up', 'mk-down');
            if (cls) el.classList.add(cls);
        }
    }

    function fmtPrice(n) {
        n = Number(n);
        if (!isFinite(n)) return DASH;
        if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (n >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
        return n.toPrecision(4);
    }
    function fmtCompact(n) {
        n = Number(n);
        if (!isFinite(n)) return DASH;
        if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
        if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        return '$' + Math.round(n).toLocaleString();
    }

    // Try api.binance.com first, then the data-only mirror (works in regions where the main host is blocked).
    function getSpot(path) {
        var i = 0;
        function attempt() {
            if (i >= SPOT_HOSTS.length) return Promise.reject(new Error('spot unavailable'));
            var url = SPOT_HOSTS[i++] + path;
            return fetch(url).then(function (r) {
                if (!r.ok) throw new Error('bad status');
                return r.json();
            }).catch(attempt);
        }
        return attempt();
    }
    function getFutures(path) {
        return fetch(FUTURES + path).then(function (r) {
            if (!r.ok) throw new Error('bad status');
            return r.json();
        });
    }

    var lastPrice = null;

    function loadTicker() {
        return getSpot('/api/v3/ticker/24hr?symbol=' + encodeURIComponent(SYMBOL)).then(function (t) {
            var price = parseFloat(t.lastPrice);
            var chg = parseFloat(t.priceChangePercent);
            lastPrice = price;
            set('live-price', '$' + fmtPrice(price));
            set('live-change', (chg >= 0 ? '\u25B2 +' : '\u25BC ') + chg.toFixed(2) + '%', chg >= 0 ? 'mk-up' : 'mk-down');
            set('live-high', '$' + fmtPrice(t.highPrice));
            set('live-low', '$' + fmtPrice(t.lowPrice));
            set('live-volume', fmtCompact(t.quoteVolume));
            set('live-updated', 'Updated ' + new Date().toLocaleTimeString());
            root.classList.remove('is-error');
        }).catch(function () {
            set('live-updated', 'Live data unavailable right now');
            root.classList.add('is-error');
        });
    }

    function loadFutures() {
        getFutures('/fapi/v1/premiumIndex?symbol=' + encodeURIComponent(SYMBOL)).then(function (d) {
            var rate = parseFloat(d.lastFundingRate) * 100;
            if (isFinite(rate)) {
                set('live-funding', (rate >= 0 ? '+' : '') + rate.toFixed(4) + '%');
            }
            var next = Number(d.nextFundingTime);
            if (next) {
                set('live-funding-next', 'Next funding ' + new Date(next).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
        }).catch(function () { /* keep the em dash */ });

        getFutures('/fapi/v1/openInterest?symbol=' + encodeURIComponent(SYMBOL)).then(function (d) {
            var coins = parseFloat(d.openInterest);
            if (isFinite(coins) && lastPrice) {
                set('live-oi', fmtCompact(coins * lastPrice));
                set('live-oi-coins', coins.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ' + BASE);
            }
        }).catch(function () { /* keep the em dash */ });
    }

    function loadRatio() {
        if (!RATIO) return;
        getSpot('/api/v3/ticker/price?symbol=' + encodeURIComponent(RATIO)).then(function (d) {
            var v = parseFloat(d.price);
            if (isFinite(v)) set('live-ratio', v.toFixed(v < 0.1 ? 5 : 4));
        }).catch(function () { /* keep the em dash */ });
    }

    // 24 hourly closes -> SVG polyline. Built with setAttribute only.
    function loadSpark() {
        var svg = $('live-spark');
        if (!svg) return;
        getSpot('/api/v3/klines?symbol=' + encodeURIComponent(SYMBOL) + '&interval=1h&limit=24').then(function (rows) {
            var closes = rows.map(function (r) { return parseFloat(r[4]); }).filter(isFinite);
            if (closes.length < 2) return;
            var min = Math.min.apply(null, closes), max = Math.max.apply(null, closes);
            var span = max - min || 1;
            var W = 300, H = 80, pad = 6;
            var pts = closes.map(function (c, i) {
                var x = (i / (closes.length - 1)) * W;
                var y = H - pad - ((c - min) / span) * (H - pad * 2);
                return x.toFixed(1) + ',' + y.toFixed(1);
            });
            var up = closes[closes.length - 1] >= closes[0];
            var line = $('live-spark-line');
            var area = $('live-spark-area');
            if (line) {
                line.setAttribute('points', pts.join(' '));
                line.setAttribute('class', up ? 'mk-spark-line mk-spark-up' : 'mk-spark-line mk-spark-down');
            }
            if (area) {
                area.setAttribute('points', '0,' + H + ' ' + pts.join(' ') + ' ' + W + ',' + H);
                area.setAttribute('class', up ? 'mk-spark-area mk-spark-up' : 'mk-spark-area mk-spark-down');
            }
            svg.setAttribute('aria-label', '24 hour ' + BASE + ' price chart, ' + (up ? 'up' : 'down') + ' over the period');
        }).catch(function () { /* leave the empty chart */ });
    }

    function refreshFast() { return loadTicker().then(loadRatio); }
    function refreshSlow() { loadFutures(); loadSpark(); }

    refreshFast().then(refreshSlow); // open interest needs the first price
    var fastTimer = setInterval(refreshFast, 10000);
    var slowTimer = setInterval(refreshSlow, 60000);

    // Stop polling while the tab is hidden.
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            clearInterval(fastTimer); clearInterval(slowTimer);
        } else {
            refreshFast(); refreshSlow();
            fastTimer = setInterval(refreshFast, 10000);
            slowTimer = setInterval(refreshSlow, 60000);
        }
    });
})();