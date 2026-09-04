// ---------- Real Trading (invest.html): a self-contained "buy/sell real crypto" page. ----------
// Runs on invest.html only. This page is the dedicated home for REAL, real-money trading
// (fiat in/out via a Binance redirect) — kept on its own URL and its own bundle, deliberately
// separate from trade.html (practice/paper trading with virtual funds) so the two are never
// confused.
//
// 14-buy-sell-redirect.js (loaded right after this file, in its own IIFE) reads several
// identifiers — POPULAR_COINS, holdings, futuresPositions, selectedAsset, showToast,
// escapeHtml — as bare/ambient names, resolved through the shared top-level scope of the
// bundle (exactly like 01-state.js does for bundle-home.js). So everything
// 14-buy-sell-redirect.js needs is declared here at TOP LEVEL, not inside an IIFE — an easy
// mistake (an IIFE would hide them and break the redirect buttons).
// This page doesn't track a portfolio itself (that's trade.html / account.html), so holdings/
// futuresPositions stay empty arrays — the redirect still works fine with an empty set.

const POPULAR_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'TRX', 'LTC', 'SHIB', 'SUI', 'PEPE'];
const holdings = [];
const futuresPositions = [];
let selectedAsset = { baseAsset: 'BTC' };

const ESCAPE_HTML_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_HTML_MAP[ch]);
}
function fmtUsd(n, opts) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return `$${n.toLocaleString(undefined, opts || { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function priceFmt(price) {
    return price < 1 ? { minimumFractionDigits: 4, maximumFractionDigits: 6 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
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
    msgEl.innerText = message;
    el.appendChild(iconEl);
    el.appendChild(msgEl);
    const container = document.getElementById('toast-container');
    if (!container) return;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('toast-leave'); setTimeout(() => el.remove(), 300); }, 4000);
}

async function fetchWithTimeout(url, ms = 9000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); }
}

function setFeedStatus(state, label) {
    const dot = document.getElementById('feed-dot');
    const text = document.getElementById('feed-status-text');
    if (dot) dot.className = `status-dot status-${state === 'live' ? 'live' : state === 'error' ? 'error' : 'connecting'}`;
    if (text) text.innerText = label;
}

// ---------- Page UI (this part is safely IIFE-scoped — nothing else needs these names) ----------
(function () {
    const symbolInput = document.getElementById('invest-symbol-input');
    const symbolList = document.getElementById('invest-symbol-list');
    const popularChips = document.getElementById('invest-popular-chips');
    const priceEl = document.getElementById('invest-live-price');
    const changeEl = document.getElementById('invest-live-change');
    const nameEl = document.getElementById('invest-asset-name');
    const buyBtn = document.getElementById('invest-buy-btn');
    const sellBtn = document.getElementById('invest-sell-btn');

    let validSymbols = new Set();

    async function bootstrapSymbols() {
        try {
            const res = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/price');
            const arr = await res.json();
            if (Array.isArray(arr)) {
                arr.forEach(row => {
                    if (row.symbol && row.symbol.endsWith('USDT')) validSymbols.add(row.symbol.replace('USDT', ''));
                });
            }
            if (symbolList) {
                symbolList.innerHTML = Array.from(validSymbols).sort().map(s => `<option value="${s}">`).join('');
            }
            setFeedStatus('live', 'Live');
        } catch (err) {
            setFeedStatus('error', 'Unavailable');
        }
    }

    async function refreshSelectedPrice() {
        const symbol = (symbolInput?.value || 'BTC').toUpperCase().trim();
        if (!symbol) return;
        try {
            const res = await fetchWithTimeout(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
            if (!res.ok) throw new Error('not found');
            const row = await res.json();
            const price = parseFloat(row.lastPrice);
            const change = parseFloat(row.priceChangePercent);
            if (priceEl) priceEl.innerText = fmtUsd(price, priceFmt(price));
            if (changeEl) {
                changeEl.innerText = isNaN(change) ? '--' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                changeEl.className = `block text-[11px] font-mono font-bold ${change > 0 ? 'text-[#14d38a]' : change < 0 ? 'text-[#ff4d6a]' : 'text-gray-500'}`;
            }
            if (nameEl) nameEl.innerText = symbol;
            selectedAsset = { baseAsset: symbol };
            setFeedStatus('live', 'Live');
        } catch (err) {
            if (priceEl) priceEl.innerText = '--';
            if (changeEl) changeEl.innerText = 'not found';
            setFeedStatus('error', 'Retry pending…');
        }
    }

    function renderPopularChips() {
        if (!popularChips) return;
        popularChips.innerHTML = POPULAR_COINS.slice(0, 10).map(sym => `
            <button type="button" class="invest-chip-btn text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:text-[#14d38a] hover:border-[#14d38a]/40 transition-all cursor-pointer" data-symbol="${escapeHtml(sym)}">${escapeHtml(sym)}</button>
        `).join('');
        popularChips.querySelectorAll('.invest-chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                symbolInput.value = btn.dataset.symbol;
                refreshSelectedPrice();
            });
        });
    }

    symbolInput?.addEventListener('change', refreshSelectedPrice);
    symbolInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') refreshSelectedPrice(); });

    buyBtn?.addEventListener('click', () => {
        const symbol = (symbolInput?.value || 'BTC').toUpperCase().trim();
        window.openBuySellRedirect?.('BUY', symbol);
    });
    sellBtn?.addEventListener('click', () => {
        const symbol = (symbolInput?.value || 'BTC').toUpperCase().trim();
        window.openBuySellRedirect?.('SELL', symbol);
    });

    renderPopularChips();
    bootstrapSymbols();
    refreshSelectedPrice();
    setInterval(refreshSelectedPrice, 8000);

    // Footer year, shared tiny touch used across every page's footer.
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.innerText = new Date().getFullYear();
})();