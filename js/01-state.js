// ---------- Shared DOM refs, app state, and small utility helpers used by every other module. ----------
    const cryptoRows = document.getElementById('crypto-rows');
    const loading = document.getElementById('loading');
    const initError = document.getElementById('init-error');
    const tableContainer = document.getElementById('table-container');
    const searchInput = document.getElementById('search-input');
    const container = document.getElementById('chart-workspace');
    const ohlvLegend = document.getElementById('ohlv-legend');
    const gridCount = document.getElementById('grid-count');
    
    let globalMarketList = []; 
    let marketMap = {}; 
    let selectedAsset = null; 
    let currentInterval = '15m'; 
    let currentFilter = 'all';
    let currentChartType = 'candles';
    let watchlist = safeJSONParse(localStorage.getItem('cw_watchlist'), []);
    let priceAlerts = safeJSONParse(localStorage.getItem('cw_alerts'), {}); // { assetId: [{id,direction,target,triggered}] }
    let lastSelection = safeJSONParse(localStorage.getItem('cw_last_selection'), null);
    let holdings = safeJSONParse(localStorage.getItem('cw_holdings'), []); // [{id, symbol, qty, avgCost}]
    let futuresPositions = safeJSONParse(localStorage.getItem('cw_futures_positions'), []); // [{id, symbol, side, entryPrice, qty, leverage}]
    let soundEnabled = safeJSONParse(localStorage.getItem('cw_sound_enabled'), true);
    let compareSymbol = null;
    let compareSeries = null;
    let compareCandles = [];
    let compareSocket = null;
    let fundingPollTimer = null;
    let lastFundingRatePct = null;
    let lastFundingNextMins = null;
    let aiInsightLoading = false;
    let assetNotes = safeJSONParse(localStorage.getItem('cw_notes'), {}); // { assetId: text }
    let notesSaveTimer = null;
    let mtfTrendCache = null; // { assetId, timeframes: [{tf, trend, pct}], fetchedAt }

    // Curated list of widely recognized, frequently searched coins for the quick-select strip.
    // Kept separate from the full Binance listing so it stays stable and predictable regardless
    // of which obscure symbols happen to sort highest by volume that day.
    const POPULAR_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'TRX', 'MATIC', 'LTC', 'SHIB', 'UNI', 'ATOM', 'NEAR', 'APT', 'ARB', 'OP', 'TON', 'ICP', 'FIL', 'SUI', 'PEPE', 'INJ'];

    // Delays invoking `fn` until `wait` ms have passed since the last call — used to avoid
    // expensive re-renders (e.g. table filtering) firing on every single keystroke.
    function debounce(fn, wait) {
        let timer = null;
        return function debounced(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    function safeJSONParse(str, fallback) {
        try {
            const val = JSON.parse(str);
            return val === null || val === undefined ? fallback : val;
        } catch (e) { return fallback; }
    }

    // Escapes text pulled from anywhere outside this codebase (AI model responses, values a
    // person typed) before it's ever concatenated into an innerHTML template — cheap
    // insurance against a stray "<" turning into markup instead of visible text.
    const ESCAPE_HTML_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_HTML_MAP[ch]);
    }

    // Chart Series Objects
    let chartInstance = null;
    let candlestickSeries = null;
    let lineSeries = null;
    let volumeSeries = null;
    let ma7Series = null;
    let ma25Series = null;
    let ema12Series = null;
    let ema26Series = null;
    let vwapSeries = null;
    let bbUpperSeries = null;
    let bbBasisSeries = null;
    let bbLowerSeries = null;
    let rsiChartInstance = null;
    let rsiLineSeries = null;
    let macdChartInstance = null;
    let macdLineSeries = null;
    let macdSignalSeries = null;
    let macdHistSeries = null;
    let atrChartInstance = null;
    let atrLineSeries = null;
    let stochChartInstance = null;
    let stochKSeries = null;
    let overlayPriceLines = [];
    let candleCloseTimestamp = null;
    let syncingRange = false;
    let isLogScale = false;
    let haCandlesArray = [];

    let resizeObserver = null;
    let chartSocket = null;
    let spotTickerSocket = null; 
    let futuresTickerSocket = null;
    let depthSocket = null;
    let tradesSocket = null;
    let cachedCandlesArray = [];

    // Indicator Visibilities
    const activeIndicators = { ma7: true, ma25: false, ema12: false, ema26: false, vwap: false, bb: false, rsi: false, macd: false, atr: false, stoch: false };

    // ---------- Socket watchdog (heartbeat) ----------
    // Some WebSocket connections die silently — no close/error event ever fires (a proxy or
    // NAT idle-timeout just drops the pipe). This is the actual cause of a feed looking "frozen
    // until refresh": our reconnect logic only runs off onclose/onerror, so a socket that goes
    // silent without one of those events never gets replaced. The watchdog below tracks the
    // last time each socket produced any message and forces a hard reconnect if a socket goes
    // quiet for longer than it reasonably should. This affects kline streams most visibly
    // because they only emit on trades, so a stalled futures connection can look "live" (open)
    // while producing nothing.
    const socketWatchdog = {
        spot:    { lastMsg: 0, threshold: 20000 },
        futures: { lastMsg: 0, threshold: 20000 },
        chart:   { lastMsg: 0, threshold: 25000 },
        depth:   { lastMsg: 0, threshold: 15000 },
        trades:  { lastMsg: 0, threshold: 60000 },
    };
    function touchWatchdog(key) { socketWatchdog[key].lastMsg = Date.now(); }
    function resetWatchdog(key) { socketWatchdog[key].lastMsg = Date.now(); }

    setInterval(() => {
        const now = Date.now();
        const checks = [
            [spotTickerSocket, 'spot'],
            [futuresTickerSocket, 'futures'],
            [chartSocket, 'chart'],
            [depthSocket, 'depth'],
            [tradesSocket, 'trades'],
        ];
        checks.forEach(([sock, key]) => {
            const w = socketWatchdog[key];
            if (!sock || sock.readyState !== WebSocket.OPEN || !w.lastMsg) return;
            if (now - w.lastMsg > w.threshold) {
                console.warn(`${key} stream went quiet for ${Math.round((now - w.lastMsg) / 1000)}s — forcing reconnect.`);
                w.lastMsg = 0; // avoid re-triggering while the reconnect is in flight
                try { sock.close(); } catch (e) {}
            }
        });
    }, 8000);

    // Reconnection handles + backoff tracking
    let globalReconnectTimeout = null;
    let chartReconnectTimeout = null;
    let depthReconnectTimeout = null;
    let tradesReconnectTimeout = null;
    let spotBackoff = 3000, futuresBackoff = 3000;

    // Guards against race conditions when rapidly switching assets/intervals
    let chartRequestToken = 0;

    function setStatus(market, state, label) {
        const dot = document.getElementById(`dot-${market}`);
        const text = document.getElementById(`status-${market}-text`);
        if (!dot) return;
        dot.className = `status-dot status-${state}`;
        if (text) text.innerText = label || state;
    }

    function showToast(message, tone = 'info') {
        const toneMap = {
            success: { color: 'var(--cw-green)', icon: '✓' },
            error: { color: 'var(--cw-red)', icon: '✕' },
            info: { color: 'var(--cw-cyan)', icon: 'ℹ' },
        };
        const { color, icon } = toneMap[tone] || toneMap.info;
        const el = document.createElement('div');
        el.className = 'toast-enter cw-toast rounded-lg pr-4 py-2.5 text-xs shadow-2xl max-w-xs border border-gray-800';
        el.style.setProperty('--cw-tone', color);
        const iconEl = document.createElement('span');
        iconEl.className = 'cw-toast-icon text-[13px]';
        iconEl.innerText = icon;
        const msgEl = document.createElement('span');
        msgEl.className = 'font-mono leading-snug pt-px';
        msgEl.style.color = color;
        msgEl.innerText = message; // user-supplied fragments (e.g. typed symbols) land here — never innerHTML
        el.appendChild(iconEl);
        el.appendChild(msgEl);
        document.getElementById('toast-container').appendChild(el);
        setTimeout(() => { el.style.transition = 'opacity 0.4s, transform 0.4s'; el.style.opacity = '0'; el.style.transform = 'translateX(16px)'; setTimeout(() => el.remove(), 400); }, 4500);
    }

    function formatCompact(num) {
        if (num === null || num === undefined || isNaN(num)) return '--';
        const abs = Math.abs(num);
        if (abs >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (abs >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (abs >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(2);
    }

    function priceFmt(price) {
        return price < 1 ? { minimumFractionDigits: 4, maximumFractionDigits: 6 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    }

    // ---------- Bootstrapping market data ----------
    // Spot and futures are fetched fully independently (each with its own try/catch) so a
    // network/CORS/regional failure on ONE leg — most commonly the futures API — can never
    // take down the other. Previously both fetches shared a single Promise.all with no inner
    // catch, so any futures-side network error rejected the whole thing and produced
    // "Could not reach Binance market data" even when spot was reachable. That was the bug.
