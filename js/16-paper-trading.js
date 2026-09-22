// ---------- Trading Account: a self-contained practice buy/sell simulator. ----------
// Runs on trade.html only (not the main terminal). Virtual cash + holdings + trade log all
// live in localStorage under 'cw_paper_*' keys, kept deliberately separate from the manual
// holdings tracker on the terminal (cw_holdings) so the two never collide. Prices come straight
// from Binance's public REST API — no backend, no account, no real money anywhere in this file.

// ---------- Pure math, deliberately kept OUTSIDE the IIFE below (same script-global scope, so
// the IIFE still calls them exactly as before) purely so server/test/paper-trading-math.test.js
// can load this exact file with vm and test the real shipped formulas — no separate copy to
// drift out of sync with production. Every function here is a pure function of its arguments:
// no DOM, no localStorage, no closure state. ----------

const PT_MAINTENANCE_MARGIN_RATE = 0.004; // 0.4% — see note on estimateLiqPrice below

// side is 'long' or 'short'. Long liquidates on the way down, short on the way up — the
// distance from entry to liq price shrinks as leverage rises because there's less margin
// cushioning each dollar of notional exposure. Simplified isolated-margin model: a single flat
// maintenance-margin rate stands in for Binance's real tiered maintenance-margin table (which
// varies by symbol and notional size). Good enough for a practice account to teach "higher
// leverage = closer liquidation", not a promise of matching real-exchange liquidation prices.
function estimateLiqPrice(side, entryPrice, leverage) {
    const cushion = (1 / leverage) - PT_MAINTENANCE_MARGIN_RATE;
    if (cushion <= 0) return side === 'long' ? entryPrice * 1.001 : entryPrice * 0.999; // extreme leverage edge case
    return side === 'long' ? entryPrice * (1 - cushion) : entryPrice * (1 + cushion);
}
function futuresPnl(position, markPrice) {
    return position.side === 'long'
        ? (markPrice - position.entryPrice) * position.qty
        : (position.entryPrice - markPrice) * position.qty;
}
// Fee charged on one side of a trade (buy or sell notional).
function computeFee(value, feeRate) {
    return value * feeRate;
}
// Weighted-average cost after adding `addQty` more units for `addValue` (+ its fee) on top of an
// existing position. Used by executeBuy — both for opening a fresh holding (existingQty = 0) and
// topping one up.
function computeBuyAvgCost(existingQty, existingAvgCost, addQty, addValue, addFee) {
    const newQty = existingQty + addQty;
    return (existingQty * existingAvgCost + addValue + addFee) / newQty;
}
// Realized P&L on a sell: what you received (net of fee) minus what those units cost you
// on average when you bought them.
function computeRealizedPnl(proceeds, costBasis) {
    return proceeds - costBasis;
}

// ---------- Execution realism: spread + size-scaled slippage ----------
// Real exchanges never fill a market order at the exact last-trade price — you cross the
// spread (pay the ask / receive the bid) and, past a certain size, walk the book, paying more
// (or receiving less) the bigger the order is relative to available liquidity. This models
// that with a simple square-root market-impact curve (a common rough approximation used in
// real transaction-cost-analysis tools: impact grows with the square root of order size, not
// linearly) on top of the live bid/ask — good enough for a practice account to teach "big
// orders and illiquid pairs cost more to trade", not a promise of matching any specific
// exchange's real order-book depth.
const PT_MIN_SLIPPAGE_BPS = 2; // 0.02% floor — stands in for half-spread on a liquid pair
const PT_SLIPPAGE_REF_NOTIONAL_USD = 5000; // order size at which slippage starts climbing above the floor
const PT_MAX_SLIPPAGE_BPS = 150; // 1.5% cap so an extreme paper order size can't run away

function computeSlippageBps(notionalUsd) {
    if (!(notionalUsd > 0)) return PT_MIN_SLIPPAGE_BPS;
    const scaled = PT_MIN_SLIPPAGE_BPS * Math.sqrt(notionalUsd / PT_SLIPPAGE_REF_NOTIONAL_USD);
    return Math.min(PT_MAX_SLIPPAGE_BPS, Math.max(PT_MIN_SLIPPAGE_BPS, scaled));
}

// side is 'buy' (pays the ask, plus slippage) or 'sell' (receives the bid, minus slippage).
// bid/ask bracket the reference (last-trade) price; either can be missing/stale, in which case
// this falls back to referencePrice itself so a fill is never blocked by a quote gap.
function estimateFillPrice(side, referencePrice, bid, ask, notionalUsd) {
    const slippageBps = computeSlippageBps(notionalUsd);
    const baseline = side === 'buy'
        ? (ask && ask > 0 ? ask : referencePrice)
        : (bid && bid > 0 ? bid : referencePrice);
    if (!baseline) return baseline;
    const slip = baseline * (slippageBps / 10000);
    return side === 'buy' ? baseline + slip : Math.max(0, baseline - slip);
}

(function () {
    const FEE_RATE = 0.001; // 0.10% simulated trading fee, applied on both buy and sell notional
    const STARTING_BALANCE = 10000;
    const EQUITY_POINT_INTERVAL_MS = 60000; // snapshot equity at most once a minute on its own
    const MAX_EQUITY_POINTS = 500;
    const PRICE_POLL_MS = 5000;
    const POPULAR_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'TRX', 'LTC', 'SHIB', 'SUI', 'PEPE'];

    // ---------- Futures constants ----------
    const MAX_LEVERAGE = 50;
    const MIN_LEVERAGE = 1;
    const DEFAULT_LEVERAGE = 10;

    // ---------- Small utilities (duplicated here so this page has zero dependency on the terminal's JS modules) ----------
    function safeJSONParse(str, fallback) {
        try {
            const val = JSON.parse(str);
            return val === null || val === undefined ? fallback : val;
        } catch (e) { return fallback; }
    }
    const ESCAPE_HTML_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_HTML_MAP[ch]);
    }
    function fmtUsd(n, opts) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        return `$${n.toLocaleString(undefined, opts || { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    function fmtSigned(n) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        return `${n >= 0 ? '+' : ''}${fmtUsd(n)}`;
    }
    function fmtQty(n) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
    }
    function priceFmt(price) {
        return price < 1 ? { minimumFractionDigits: 4, maximumFractionDigits: 6 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    }
    function pnlColorClass(n) {
        if (n === null || n === undefined || isNaN(n) || n === 0) return 'text-gray-400';
        return n > 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]';
    }
    function showToast(message, tone = 'info') {
        const toneMap = {
            success: { color: 'var(--cw-green)', icon: '<i data-lucide="check" width="14" height="14" stroke-width="2.5"></i>' },
            error: { color: 'var(--cw-red)', icon: '<i data-lucide="x" width="14" height="14" stroke-width="2.5"></i>' },
            info: { color: 'var(--cw-cyan)', icon: '<i data-lucide="info" width="14" height="14" stroke-width="2.3"></i>' },
        };
        const { color, icon } = toneMap[tone] || toneMap.info;
        const el = document.createElement('div');
        el.className = 'toast-enter cw-toast rounded-lg pr-4 py-2.5 text-xs shadow-2xl max-w-xs border border-gray-800';
        el.style.setProperty('--cw-tone', color);
        const iconEl = document.createElement('span');
        iconEl.className = 'cw-toast-icon text-[13px]';
        iconEl.innerHTML = icon; // icon is always a fixed string from toneMap above, never user input
        const msgEl = document.createElement('span');
        msgEl.className = 'font-mono leading-snug pt-px';
        msgEl.style.color = color;
        msgEl.innerText = message;
        el.appendChild(iconEl);
        el.appendChild(msgEl);
        document.getElementById('toast-container').appendChild(el);
        setTimeout(() => { el.style.transition = 'opacity 0.4s, transform 0.4s'; el.style.opacity = '0'; el.style.transform = 'translateX(16px)'; setTimeout(() => el.remove(), 400); }, 4500);
    }
    function downloadCSV(csvText, filename) {
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        showToast(`Exported to ${filename}`, 'success');
    }

    // ---------- State ----------
    let cash = safeJSONParse(localStorage.getItem('cw_paper_cash'), null);
    let totalDeposited = safeJSONParse(localStorage.getItem('cw_paper_deposited'), null);
    let holdings = safeJSONParse(localStorage.getItem('cw_paper_holdings'), []); // [{symbol, qty, avgCost}]
    let trades = safeJSONParse(localStorage.getItem('cw_paper_trades'), []); // [{id, ts, symbol, side, type, qty, price, value, fee, realizedPnl, leverage?}]
    let pendingOrders = safeJSONParse(localStorage.getItem('cw_paper_orders'), []); // [{id, ts, symbol, side, qty, limitPrice}]
    let equityCurve = safeJSONParse(localStorage.getItem('cw_paper_equity_curve'), []); // [{ts, equity}]
    // Kept entirely separate from the terminal's manual futures tracker (cw_futures_positions
    // in 01-state.js) — that one is a hand-entered log with no cash account behind it, this one
    // is funded from (and settles back into) this page's own paper cash balance.
    let futuresPositions = safeJSONParse(localStorage.getItem('cw_paper_futures'), []); // [{id, ts, symbol, side, entryPrice, qty, leverage, margin, notional, liqPrice}]

    if (cash === null || totalDeposited === null) {
        cash = STARTING_BALANCE;
        totalDeposited = STARTING_BALANCE;
        equityCurve = [{ ts: Date.now(), equity: STARTING_BALANCE }];
    }

    function persist() {
        localStorage.setItem('cw_paper_cash', JSON.stringify(cash));
        localStorage.setItem('cw_paper_deposited', JSON.stringify(totalDeposited));
        localStorage.setItem('cw_paper_holdings', JSON.stringify(holdings));
        localStorage.setItem('cw_paper_trades', JSON.stringify(trades));
        localStorage.setItem('cw_paper_orders', JSON.stringify(pendingOrders));
        localStorage.setItem('cw_paper_equity_curve', JSON.stringify(equityCurve));
        localStorage.setItem('cw_paper_futures', JSON.stringify(futuresPositions));
    }

    // ---------- Live prices ----------
    let priceMap = {};       // BASE -> price (USDT pairs only)
    let bidMap = {};         // BASE -> best bid (live order-book top), used for realistic sell fills
    let askMap = {};         // BASE -> best ask (live order-book top), used for realistic buy fills
    let changeMap = {};      // BASE -> 24h % change, filled lazily per selected symbol
    let validSymbols = new Set();
    let lastEquitySnapshot = 0;

    // Best bid/ask for a symbol, falling back to the last-trade price (both sides) if a fresh
    // quote hasn't loaded yet — keeps every call site safe even before the first bookTicker poll.
    function getBidAsk(symbol) {
        const last = priceMap[symbol] || 0;
        return { bid: bidMap[symbol] || last, ask: askMap[symbol] || last };
    }

    function findHolding(symbol) { return holdings.find(h => h.symbol === symbol); }

    async function fetchWithTimeout(url, ms = 9000) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        try { return await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); }
    }

    // One-time full snapshot: seeds priceMap + the set of valid tradable symbols.
    async function bootstrapPrices() {
        try {
            const res = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/price');
            const arr = await res.json();
            if (Array.isArray(arr)) {
                arr.forEach(row => {
                    if (row.symbol && row.symbol.endsWith('USDT')) {
                        const base = row.symbol.replace('USDT', '');
                        priceMap[base] = parseFloat(row.price) || 0;
                        validSymbols.add(base);
                    }
                });
            }
            setFeedStatus('live', 'Live');
        } catch (err) {
            console.warn('Price bootstrap failed:', err.message);
            setFeedStatus('error', 'Unavailable');
        }
    }

    // Targeted refresh: only the symbols currently on screen (selected asset + holdings + pending orders).
    async function refreshNeededPrices() {
        const symbol = orderSymbolInput.value.toUpperCase().trim();
        const needed = new Set([symbol]);
        holdings.forEach(h => needed.add(h.symbol));
        pendingOrders.forEach(o => needed.add(o.symbol));
        futuresPositions.forEach(p => needed.add(p.symbol));
        const pairs = Array.from(needed).filter(Boolean).map(b => `${b}USDT`);
        if (pairs.length === 0) return;
        try {
            const symbolsParam = encodeURIComponent(JSON.stringify(pairs));
            const [priceRes, bookRes] = await Promise.all([
                fetchWithTimeout(`https://api.binance.com/api/v3/ticker/price?symbols=${symbolsParam}`),
                // Best bid/ask top-of-book — this is what makes fills realistic (spread), not just
                // the last-trade price. Best-effort: if this call fails we simply fall back to
                // last-trade for both sides (see getBidAsk) rather than blocking the price refresh.
                fetchWithTimeout(`https://api.binance.com/api/v3/ticker/bookTicker?symbols=${symbolsParam}`).catch(() => null),
            ]);
            if (!priceRes.ok) throw new Error(`HTTP ${priceRes.status}`);
            const arr = await priceRes.json();
            if (Array.isArray(arr)) {
                arr.forEach(row => {
                    if (row.symbol && row.symbol.endsWith('USDT')) {
                        priceMap[row.symbol.replace('USDT', '')] = parseFloat(row.price) || 0;
                    }
                });
            }
            if (bookRes && bookRes.ok) {
                const bookArr = await bookRes.json();
                if (Array.isArray(bookArr)) {
                    bookArr.forEach(row => {
                        if (row.symbol && row.symbol.endsWith('USDT')) {
                            const base = row.symbol.replace('USDT', '');
                            bidMap[base] = parseFloat(row.bidPrice) || 0;
                            askMap[base] = parseFloat(row.askPrice) || 0;
                        }
                    });
                }
            }
            setFeedStatus('live', 'Live');
            checkPendingOrders();
            checkHoldingsTpSl();
            checkFuturesTpSl();
            checkFuturesLiquidations();
            renderAll();
            maybeSnapshotEquity();
            updateChartLiveCandle();
        } catch (err) {
            setFeedStatus('error', 'Retry pending…');
        }
    }

    async function refresh24hChange(symbol) {
        if (!symbol) return;
        try {
            const res = await fetchWithTimeout(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
            if (!res.ok) throw new Error('not found');
            const row = await res.json();
            changeMap[symbol] = parseFloat(row.priceChangePercent);
            renderOrderTicketPrice();
        } catch (err) {
            changeMap[symbol] = null;
        }
    }

    function setFeedStatus(state, label) {
        const dot = document.getElementById('feed-dot');
        const text = document.getElementById('feed-status-text');
        if (dot) dot.className = `status-dot status-${state === 'live' ? 'live' : state === 'error' ? 'error' : 'connecting'}`;
        if (text) text.innerText = label;
    }

    function getPrice(symbol) { return priceMap[symbol] || 0; }

    // ---------- DOM refs ----------
    const orderSymbolInput = document.getElementById('order-symbol-input');
    const orderSymbolList = document.getElementById('order-symbol-list');
    const popularChips = document.getElementById('popular-coin-chips');
    const marketModeButtons = document.querySelectorAll('.market-mode-btn');
    const sideButtons = document.querySelectorAll('.order-side-btn');
    const typeButtons = document.querySelectorAll('.order-type-btn:not(.market-mode-btn)');
    const orderTypeRow = document.getElementById('order-type-row');
    const limitPriceRow = document.getElementById('limit-price-row');
    const limitPriceInput = document.getElementById('order-limit-price-input');
    const amountLabelEl = document.getElementById('amount-label');
    const amountInput = document.getElementById('order-amount-input');
    const amountUnitSelect = document.getElementById('order-amount-unit');
    const amountHint = document.getElementById('order-amount-hint');
    const availableHint = document.getElementById('order-available-hint');
    const submitBtn = document.getElementById('submit-order-btn');
    const orderFeeNote = document.getElementById('order-fee-note');
    const spotSummaryRows = document.getElementById('spot-summary-rows');
    const summaryFeeEl = document.getElementById('order-summary-fee');
    const summaryTotalEl = document.getElementById('order-summary-total');
    const summaryLabelEl = document.getElementById('order-summary-label');
    const futuresSummaryRows = document.getElementById('futures-summary-rows');
    const futuresSummaryNotionalEl = document.getElementById('futures-summary-notional');
    const futuresSummaryFeeEl = document.getElementById('futures-summary-fee');
    const futuresSummaryLiqEl = document.getElementById('futures-summary-liq');
    const futuresSummaryMarginEl = document.getElementById('futures-summary-margin');
    const leverageRow = document.getElementById('leverage-row');
    const leverageSlider = document.getElementById('leverage-slider');
    const leverageValueEl = document.getElementById('leverage-value');
    const leverageButtons = document.querySelectorAll('.leverage-btn');
    const tpslRow = document.getElementById('tpsl-row');
    const tpInput = document.getElementById('order-tp-input');
    const slInput = document.getElementById('order-sl-input');
    const tpslHint = document.getElementById('tpsl-hint');
    const livePriceEl = document.getElementById('order-live-price');
    const liveChangeEl = document.getElementById('order-live-change');

    let currentMarket = 'spot'; // 'spot' | 'futures'
    let currentSide = 'buy';    // 'buy'/'sell' — read as 'long'/'short' when currentMarket is 'futures'
    let currentType = 'market';
    let currentLeverage = DEFAULT_LEVERAGE;

    // ---------- Symbol list / chips ----------
    function populateSymbolList() {
        const all = Array.from(validSymbols).sort();
        orderSymbolList.innerHTML = all.map(s => `<option value="${escapeHtml(s)}">`).join('');
    }
    function renderChips() {
        popularChips.innerHTML = POPULAR_COINS.map(sym =>
            `<button type="button" class="coin-chip" data-sym="${sym}">${sym}</button>`
        ).join('');
        popularChips.querySelectorAll('.coin-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                orderSymbolInput.value = btn.getAttribute('data-sym');
                onSymbolChange();
            });
        });
    }
    function highlightActiveChip() {
        const sym = orderSymbolInput.value.toUpperCase().trim();
        popularChips.querySelectorAll('.coin-chip').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-sym') === sym);
        });
    }

    function onSymbolChange() {
        const symbol = orderSymbolInput.value.toUpperCase().trim();
        orderSymbolInput.value = symbol;
        highlightActiveChip();
        refresh24hChange(symbol);
        refreshNeededPrices();
        renderOrderTicketPrice();
        renderAvailableHint();
        renderOrderSummary();
        loadPriceChart();
    }

    // ---------- Order ticket rendering ----------
    function renderOrderTicketPrice() {
        const symbol = orderSymbolInput.value.toUpperCase().trim();
        const price = getPrice(symbol);
        if (!symbol || !price) { livePriceEl.innerText = '--'; liveChangeEl.innerText = '--'; return; }
        livePriceEl.innerText = fmtUsd(price, priceFmt(price));
        const chg = changeMap[symbol];
        if (chg === null || chg === undefined || isNaN(chg)) {
            liveChangeEl.innerText = '24h --';
            liveChangeEl.className = 'block text-[10px] font-mono font-bold text-gray-500';
        } else {
            liveChangeEl.innerText = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}% (24h)`;
            liveChangeEl.className = `block text-[10px] font-mono font-bold ${chg >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}`;
        }
    }

    function renderAvailableHint() {
        const symbol = orderSymbolInput.value.toUpperCase().trim();
        if (currentMarket === 'futures') {
            // Margin for a long or a short both come out of free cash, so the hint doesn't
            // depend on side the way spot's "held qty" hint does.
            availableHint.innerText = `Free cash: ${fmtUsd(cash)}`;
        } else if (currentSide === 'buy') {
            availableHint.innerText = `Cash: ${fmtUsd(cash)}`;
        } else {
            const h = findHolding(symbol);
            availableHint.innerText = `Held: ${h ? fmtQty(h.qty) : '0'} ${symbol || ''}`;
        }
    }

    function amountToQtyAndValue() {
        const symbol = orderSymbolInput.value.toUpperCase().trim();
        const price = currentType === 'limit' && parseFloat(limitPriceInput.value) > 0
            ? parseFloat(limitPriceInput.value)
            : getPrice(symbol);
        const raw = parseFloat(amountInput.value);
        if (!price || isNaN(raw) || raw <= 0) return { qty: 0, value: 0, price };
        const unit = amountUnitSelect.value;
        const qty = unit === 'usd' ? raw / price : raw;
        const value = qty * price;
        return { qty, value, price };
    }

    // Futures sizing always treats the amount field as a USD margin figure — the position size
    // (notional) is margin × leverage, not the raw amount typed in.
    function futuresAmountToPosition() {
        const price = currentType === 'limit' && parseFloat(limitPriceInput.value) > 0
            ? parseFloat(limitPriceInput.value)
            : getPrice(orderSymbolInput.value.toUpperCase().trim());
        const margin = parseFloat(amountInput.value);
        if (!price || isNaN(margin) || margin <= 0) return { margin: 0, leverage: currentLeverage, notional: 0, qty: 0, price };
        const notional = margin * currentLeverage;
        const qty = notional / price;
        return { margin, leverage: currentLeverage, notional, qty, price };
    }

    function renderOrderSummary() {
        if (currentMarket === 'futures') {
            const { margin, leverage, notional, qty, price } = futuresAmountToPosition();
            const fee = notional * FEE_RATE;
            const side = currentSide === 'buy' ? 'long' : 'short';
            const liq = price ? estimateLiqPrice(side, price, leverage) : null;
            futuresSummaryNotionalEl.innerText = fmtUsd(notional);
            futuresSummaryFeeEl.innerText = fmtUsd(fee);
            futuresSummaryLiqEl.innerText = liq ? fmtUsd(liq, priceFmt(liq)) : '--';
            futuresSummaryMarginEl.innerText = fmtUsd(margin + fee);
            const symbol = orderSymbolInput.value.toUpperCase().trim();
            if (!price || qty <= 0) { amountHint.innerHTML = '&nbsp;'; }
            else amountHint.innerText = `≈ ${fmtQty(qty)} ${symbol} position @ ${leverage}x`;
            return;
        }
        const { qty, value, price } = amountToQtyAndValue();
        const fee = value * FEE_RATE;
        summaryFeeEl.innerText = fmtUsd(fee);
        if (currentSide === 'buy') {
            summaryLabelEl.innerText = 'Total cost';
            summaryTotalEl.innerText = fmtUsd(value + fee);
        } else {
            summaryLabelEl.innerText = 'You receive';
            summaryTotalEl.innerText = fmtUsd(Math.max(0, value - fee));
        }
        const symbol = orderSymbolInput.value.toUpperCase().trim();
        if (!price || qty <= 0) { amountHint.innerHTML = '&nbsp;'; }
        else amountHint.innerText = amountUnitSelect.value === 'usd'
            ? `≈ ${fmtQty(qty)} ${symbol}`
            : `≈ ${fmtUsd(value)}`;
    }

    function updateSideLabels() {
        const isFutures = currentMarket === 'futures';
        document.getElementById('side-buy-btn').innerText = isFutures ? 'Long' : 'Buy';
        document.getElementById('side-sell-btn').innerText = isFutures ? 'Short' : 'Sell';
        submitBtn.innerText = isFutures
            ? `Open ${currentSide === 'buy' ? 'Long' : 'Short'} Position`
            : `Place ${currentSide === 'buy' ? 'Buy' : 'Sell'} Order`;
        submitBtn.className = `w-full text-sm font-bold uppercase py-2.5 rounded transition-all cursor-pointer ${currentSide === 'buy' ? 'bg-[#14d38a] text-[#0b0e11] hover:opacity-90' : 'bg-[#ff4d6a] text-white hover:opacity-90'}`;
    }

    function updateTpSlVisibility() {
        // TP/SL are entry-attached exit triggers: for spot they only make sense on a Buy (an
        // immediate Sell is already an exit, so there's nothing for it to protect); for futures
        // they apply to either side since Long and Short are both entries.
        const show = currentMarket === 'futures' || currentSide === 'buy';
        tpslRow.classList.toggle('hidden', !show);
        if (!show) { tpInput.value = ''; slInput.value = ''; }
    }

    function setSide(side) {
        currentSide = side;
        sideButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-side') === side));
        updateSideLabels();
        updateTpSlVisibility();
        renderAvailableHint();
        renderOrderSummary();
    }
    function setType(type) {
        currentType = type;
        typeButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-type') === type));
        limitPriceRow.classList.toggle('hidden', type !== 'limit');
        renderOrderSummary();
    }
    function setLeverage(lev) {
        currentLeverage = Math.max(MIN_LEVERAGE, Math.min(MAX_LEVERAGE, Math.round(lev) || DEFAULT_LEVERAGE));
        leverageSlider.value = currentLeverage;
        leverageValueEl.innerText = `${currentLeverage}x`;
        leverageButtons.forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-lev'), 10) === currentLeverage));
        renderOrderSummary();
    }
    function setMarket(market) {
        currentMarket = market;
        marketModeButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-market') === market));
        leverageRow.classList.toggle('hidden', market !== 'futures');
        // Futures orders in this practice account fill at the live market price only —
        // no pending limit entries for futures yet, so hide the type toggle entirely.
        orderTypeRow.classList.toggle('hidden', market === 'futures');
        if (market === 'futures') setType('market');
        spotSummaryRows.classList.toggle('hidden', market === 'futures');
        futuresSummaryRows.classList.toggle('hidden', market !== 'futures');
        amountUnitSelect.classList.toggle('hidden', market === 'futures');
        if (market === 'futures') amountUnitSelect.value = 'usd';
        amountLabelEl.innerText = market === 'futures' ? 'Margin (USD)' : 'Amount';
        orderFeeNote.innerText = market === 'futures' ? '0.10% simulated taker fee' : '0.10% simulated fee';
        updateSideLabels();
        updateTpSlVisibility();
        renderAvailableHint();
        renderOrderSummary();
        loadPriceChart();
    }

    marketModeButtons.forEach(b => b.addEventListener('click', () => setMarket(b.getAttribute('data-market'))));
    sideButtons.forEach(b => b.addEventListener('click', () => setSide(b.getAttribute('data-side'))));
    typeButtons.forEach(b => b.addEventListener('click', () => setType(b.getAttribute('data-type'))));
    leverageSlider.addEventListener('input', () => setLeverage(parseInt(leverageSlider.value, 10)));
    leverageButtons.forEach(b => b.addEventListener('click', () => setLeverage(parseInt(b.getAttribute('data-lev'), 10))));
    orderSymbolInput.addEventListener('change', onSymbolChange);
    orderSymbolInput.addEventListener('blur', onSymbolChange);
    [amountInput, amountUnitSelect, limitPriceInput].forEach(el => el.addEventListener('input', renderOrderSummary));
    document.querySelectorAll('.order-pct-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const pct = parseFloat(btn.getAttribute('data-pct'));
            const symbol = orderSymbolInput.value.toUpperCase().trim();
            if (currentMarket === 'futures') {
                // Margin sizing always draws from free cash regardless of long/short. The open
                // fee is charged on notional (margin × leverage), not on margin alone, so the
                // "Max" case has to divide out (1 + leverage × feeRate), not (1 + feeRate) —
                // otherwise higher leverage tiers would ask for slightly more than cash covers.
                const marginBudget = cash * pct / (1 + currentLeverage * FEE_RATE);
                amountUnitSelect.value = 'usd';
                amountInput.value = marginBudget > 0 ? marginBudget.toFixed(2) : '';
                renderOrderSummary();
                return;
            }
            const price = currentType === 'limit' && parseFloat(limitPriceInput.value) > 0 ? parseFloat(limitPriceInput.value) : getPrice(symbol);
            if (currentSide === 'buy') {
                const usdBudget = cash * pct / (1 + FEE_RATE);
                amountUnitSelect.value = 'usd';
                amountInput.value = usdBudget > 0 ? usdBudget.toFixed(2) : '';
            } else {
                const h = findHolding(symbol);
                amountUnitSelect.value = 'coins';
                amountInput.value = h ? (h.qty * pct).toFixed(8) : '';
            }
            renderOrderSummary();
        });
    });

    // ---------- Take profit / stop loss ----------
    // dir is 'buy'/'long' (protects against price falling, profits as it rises) or
    // 'sell'/'short' (the reverse). refPrice is the price the position will actually enter at
    // (limit price for a pending limit order, live price for anything filling now).
    function readTpSl(dir, refPrice) {
        const isLongDir = dir === 'buy' || dir === 'long';
        let tpPrice = tpInput.value.trim() === '' ? null : parseFloat(tpInput.value);
        let slPrice = slInput.value.trim() === '' ? null : parseFloat(slInput.value);
        if (tpPrice !== null && (isNaN(tpPrice) || tpPrice <= 0)) tpPrice = null;
        if (slPrice !== null && (isNaN(slPrice) || slPrice <= 0)) slPrice = null;
        let error = null;
        if (tpPrice !== null) {
            if (isLongDir && tpPrice <= refPrice) error = 'Take profit must be above the entry price for a buy/long.';
            else if (!isLongDir && tpPrice >= refPrice) error = 'Take profit must be below the entry price for a short.';
        }
        if (!error && slPrice !== null) {
            if (isLongDir && slPrice >= refPrice) error = 'Stop loss must be below the entry price for a buy/long.';
            else if (!isLongDir && slPrice <= refPrice) error = 'Stop loss must be above the entry price for a short.';
        }
        return { tpPrice, slPrice, error };
    }
    function clearTpSlInputs() { tpInput.value = ''; slInput.value = ''; }

    // ---------- Trade execution ----------
    function executeBuy(symbol, qty, price, type, tpPrice, slPrice) {
        const value = qty * price;
        const fee = computeFee(value, FEE_RATE);
        const totalCost = value + fee;
        if (totalCost > cash + 1e-9) { showToast(`Not enough cash — need ${fmtUsd(totalCost)}, have ${fmtUsd(cash)}.`, 'error'); return false; }
        cash -= totalCost;
        let h = findHolding(symbol);
        if (h) {
            const newQty = h.qty + qty;
            h.avgCost = computeBuyAvgCost(h.qty, h.avgCost, qty, value, fee);
            h.qty = newQty;
            // A new TP/SL on a top-up order replaces the old one — only one active exit target
            // per symbol. Leaving both blank on the top-up keeps whatever was already set.
            if (tpPrice !== undefined) h.tpPrice = tpPrice;
            if (slPrice !== undefined) h.slPrice = slPrice;
        } else {
            holdings.push({ symbol, qty, avgCost: computeBuyAvgCost(0, 0, qty, value, fee), tpPrice: tpPrice || null, slPrice: slPrice || null });
        }
        trades.unshift({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), symbol, side: 'buy', type, qty, price, value, fee, realizedPnl: null });
        showToast(`Bought ${fmtQty(qty)} ${symbol} at ${fmtUsd(price, priceFmt(price))}.`, 'success');
        return true;
    }

    function executeSell(symbol, qty, price, type) {
        const h = findHolding(symbol);
        if (!h || qty > h.qty + 1e-9) { showToast(`You only hold ${h ? fmtQty(h.qty) : '0'} ${symbol}.`, 'error'); return false; }
        const value = qty * price;
        const fee = computeFee(value, FEE_RATE);
        const proceeds = value - fee;
        const costBasis = qty * h.avgCost;
        const realizedPnl = computeRealizedPnl(proceeds, costBasis);
        cash += proceeds;
        h.qty -= qty;
        if (h.qty <= 1e-9) holdings = holdings.filter(x => x !== h);
        trades.unshift({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), symbol, side: 'sell', type, qty, price, value, fee, realizedPnl });
        const reasonLabel = type === 'tp' ? 'take-profit hit' : type === 'sl' ? 'stop-loss hit' : (realizedPnl >= 0 ? 'profit' : 'loss');
        showToast(`Sold ${fmtQty(qty)} ${symbol} at ${fmtUsd(price, priceFmt(price))} — ${reasonLabel} of ${fmtSigned(realizedPnl)}.`, realizedPnl >= 0 ? 'success' : 'info');
        return true;
    }

    // Checked every price refresh: any holding with an active TP/SL that the live price has
    // reached gets sold in full at that price.
    function checkHoldingsTpSl() {
        if (holdings.length === 0) return;
        let filledAny = false;
        holdings.slice().forEach(h => {
            if (!h.tpPrice && !h.slPrice) return;
            const price = getPrice(h.symbol);
            if (!price) return;
            // Take-profit behaves like a resting limit order: it fills at exactly the price you
            // set. Stop-loss is a forced market exit once triggered, so it crosses the spread and
            // takes size-scaled slippage on top of wherever price already is by the time it fires.
            if (h.tpPrice && price >= h.tpPrice) { if (executeSell(h.symbol, h.qty, h.tpPrice, 'tp')) filledAny = true; return; }
            if (h.slPrice && price <= h.slPrice) {
                const { bid, ask } = getBidAsk(h.symbol);
                const fillPrice = estimateFillPrice('sell', price, bid, ask, h.qty * price);
                if (executeSell(h.symbol, h.qty, fillPrice, 'sl')) filledAny = true;
            }
        });
        if (filledAny) { persist(); renderAll(); maybeSnapshotEquity(true); }
    }

    // ---------- Futures execution ----------
    async function handleFuturesSubmit() {
        const symbol = orderSymbolInput.value.toUpperCase().trim();
        if (!symbol) { showToast('Enter an asset symbol, e.g. BTC.', 'error'); return; }
        if (!validSymbols.has(symbol) && !getPrice(symbol)) { showToast(`${symbol} isn't a tracked USDT market.`, 'error'); return; }
        const refPrice = getPrice(symbol);
        if (!refPrice) { showToast('Live price unavailable for that asset right now.', 'error'); return; }
        const margin = parseFloat(amountInput.value);
        if (isNaN(margin) || margin <= 0) { showToast('Enter a valid margin amount.', 'error'); return; }
        const leverage = currentLeverage;
        const side = currentSide === 'buy' ? 'long' : 'short';
        const { tpPrice, slPrice, error } = readTpSl(side, refPrice);
        if (error) { showToast(error, 'error'); return; }
        const notional = margin * leverage;
        const fee = notional * FEE_RATE;
        const totalRequired = margin + fee;
        if (totalRequired > cash + 1e-9) { showToast(`Not enough free cash — need ${fmtUsd(totalRequired)} (margin + fee), have ${fmtUsd(cash)}.`, 'error'); return; }

        await simulateExecutionLatency(submitBtn);

        // A leveraged position opens with a market order too — same spread + slippage model,
        // applied to the notional (margin × leverage), not just the margin. Opening a long
        // "buys" (crosses the ask); opening a short "sells" (crosses the bid).
        const { bid, ask } = getBidAsk(symbol);
        const entryPrice = estimateFillPrice(side === 'long' ? 'buy' : 'sell', refPrice, bid, ask, notional);
        if (!entryPrice) { showToast('Live price unavailable for that asset right now.', 'error'); return; }
        const qty = notional / entryPrice;
        const liqPrice = estimateLiqPrice(side, entryPrice, leverage);
        // A stop loss tighter than the liquidation price would never fire — liquidation gets
        // there first and the margin is forfeited instead of a controlled, partial-loss close.
        if (slPrice !== null) {
            const slPastLiq = side === 'long' ? slPrice <= liqPrice : slPrice >= liqPrice;
            if (slPastLiq) { showToast(`Stop loss is past the estimated liquidation price (${fmtUsd(liqPrice, priceFmt(liqPrice))}) — liquidation would trigger first.`, 'error'); return; }
        }

        cash -= totalRequired;
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        futuresPositions.push({ id, ts: Date.now(), symbol, side, entryPrice, qty, leverage, margin, notional, liqPrice, tpPrice, slPrice });
        trades.unshift({ id: `${id}_open`, ts: Date.now(), symbol, side, type: 'open', qty, price: entryPrice, value: notional, fee, realizedPnl: null, leverage });
        showToast(`Opened ${leverage}x ${side.toUpperCase()} on ${symbol} @ ${fmtUsd(entryPrice, priceFmt(entryPrice))}. Est. liq. ${fmtUsd(liqPrice, priceFmt(liqPrice))}.`, 'success');
        amountInput.value = '';
        clearTpSlInputs();
        persist(); renderAll(); maybeSnapshotEquity(true);
    }

    function closeFuturesPosition(id, reason) {
        const p = futuresPositions.find(x => x.id === id);
        if (!p) return;
        // Closing a long means selling (hits the bid); closing a short means buying (hits the
        // ask). Take-profit behaves like a limit order — it fills at the exact price you set,
        // never worse. Stop-loss and a manual close are both forced market exits, so they cross
        // the live spread and take size-scaled slippage on top of wherever price already is.
        let markPrice;
        if (reason === 'tp') {
            markPrice = p.tpPrice;
        } else {
            const live = getPrice(p.symbol) || (reason === 'sl' ? p.slPrice : null);
            if (live) {
                const { bid, ask } = getBidAsk(p.symbol);
                markPrice = estimateFillPrice(p.side === 'long' ? 'sell' : 'buy', live, bid, ask, p.notional);
            }
        }
        if (!markPrice) { showToast('Live price unavailable — try again in a moment.', 'error'); return; }
        const pnl = futuresPnl(p, markPrice);
        const closeNotional = p.qty * markPrice;
        const fee = closeNotional * FEE_RATE;
        const netPnl = pnl - fee;
        // Margin is returned alongside net P&L; floored at 0 as a safety net in case an
        // extreme, un-liquidated move (e.g. a price gap between polls) pushes the loss past
        // the margin itself — real exchanges liquidate before that happens, which is what the
        // checkFuturesLiquidations() sweep below is for.
        const proceeds = Math.max(0, p.margin + netPnl);
        cash += proceeds;
        futuresPositions = futuresPositions.filter(x => x.id !== id);
        const type = reason === 'tp' ? 'tp' : reason === 'sl' ? 'sl' : 'close';
        trades.unshift({ id: `${p.id}_close_${Date.now()}`, ts: Date.now(), symbol: p.symbol, side: p.side, type, qty: p.qty, price: markPrice, value: closeNotional, fee, realizedPnl: netPnl, leverage: p.leverage });
        const reasonLabel = reason === 'tp' ? 'take-profit hit' : reason === 'sl' ? 'stop-loss hit' : (netPnl >= 0 ? 'profit' : 'loss');
        showToast(`Closed ${p.leverage}x ${p.side.toUpperCase()} ${p.symbol} — ${reasonLabel} of ${fmtSigned(netPnl)}.`, netPnl >= 0 ? 'success' : 'info');
        persist(); renderAll(); maybeSnapshotEquity(true);
    }

    // Checked every price refresh, ahead of liquidation: any position with an active TP/SL
    // that the live price has reached gets closed at that trigger price.
    function checkFuturesTpSl() {
        if (futuresPositions.length === 0) return;
        futuresPositions.slice().forEach(p => {
            const mark = getPrice(p.symbol);
            if (!mark) return;
            const tpHit = p.tpPrice && (p.side === 'long' ? mark >= p.tpPrice : mark <= p.tpPrice);
            const slHit = p.slPrice && (p.side === 'long' ? mark <= p.slPrice : mark >= p.slPrice);
            if (tpHit) closeFuturesPosition(p.id, 'tp');
            else if (slHit) closeFuturesPosition(p.id, 'sl');
        });
    }

    function checkFuturesLiquidations() {
        if (futuresPositions.length === 0) return;
        const survivors = [];
        let liquidatedAny = false;
        futuresPositions.forEach(p => {
            const mark = getPrice(p.symbol);
            if (!mark) { survivors.push(p); return; }
            const hit = p.side === 'long' ? mark <= p.liqPrice : mark >= p.liqPrice;
            if (!hit) { survivors.push(p); return; }
            // Liquidated: the position is force-closed at (roughly) the liquidation price and
            // the margin is forfeited entirely — no proceeds credited back, and no separate fee
            // charged (the forfeited margin already absorbs the loss) — matching how
            // isolated-margin liquidation works on real exchanges.
            trades.unshift({ id: `${p.id}_liq_${Date.now()}`, ts: Date.now(), symbol: p.symbol, side: p.side, type: 'liquidated', qty: p.qty, price: p.liqPrice, value: p.notional, fee: 0, realizedPnl: -p.margin, leverage: p.leverage });
            showToast(`${p.symbol} ${p.side.toUpperCase()} position liquidated near ${fmtUsd(p.liqPrice, priceFmt(p.liqPrice))}.`, 'error');
            liquidatedAny = true;
        });
        futuresPositions = survivors;
        if (liquidatedAny) { persist(); renderAll(); maybeSnapshotEquity(true); }
    }

    document.getElementById('futures-rows').addEventListener('click', (e) => {
        const btn = e.target.closest('.close-position-btn');
        if (!btn) return;
        closeFuturesPosition(btn.getAttribute('data-id'));
    });

    // Simulated order-routing latency for a market order — a real exchange round-trip isn't
    // instant, and a chart that fills the same millisecond a button is clicked teaches "trading
    // has no timing risk", which isn't true. Deliberately short and randomized rather than a
    // fixed delay, and the button is disabled for its duration so a double-click can't double-fill.
    function simulateExecutionLatency(btn) {
        const original = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'Submitting…';
        btn.classList.add('opacity-60', 'cursor-wait');
        const ms = 180 + Math.random() * 320;
        return new Promise(resolve => setTimeout(() => {
            btn.disabled = false;
            btn.innerText = original;
            btn.classList.remove('opacity-60', 'cursor-wait');
            resolve();
        }, ms));
    }

    submitBtn.addEventListener('click', async () => {
        if (currentMarket === 'futures') { await handleFuturesSubmit(); return; }
        const symbol = orderSymbolInput.value.toUpperCase().trim();
        if (!symbol) { showToast('Enter an asset symbol, e.g. BTC.', 'error'); return; }
        if (!validSymbols.has(symbol) && !getPrice(symbol)) { showToast(`${symbol} isn't a tracked USDT market.`, 'error'); return; }

        if (currentType === 'limit') {
            const limitPrice = parseFloat(limitPriceInput.value);
            if (isNaN(limitPrice) || limitPrice <= 0) { showToast('Enter a valid limit price.', 'error'); return; }
            const unit = amountUnitSelect.value;
            const raw = parseFloat(amountInput.value);
            if (isNaN(raw) || raw <= 0) { showToast('Enter a valid amount.', 'error'); return; }
            const qty = unit === 'usd' ? raw / limitPrice : raw;
            let tpPrice = null, slPrice = null;
            if (currentSide === 'buy') {
                const totalCost = qty * limitPrice * (1 + FEE_RATE);
                if (totalCost > cash + 1e-9) { showToast(`Not enough cash reserved for this limit order — need ${fmtUsd(totalCost)}.`, 'error'); return; }
                const r = readTpSl('buy', limitPrice);
                if (r.error) { showToast(r.error, 'error'); return; }
                tpPrice = r.tpPrice; slPrice = r.slPrice;
            } else {
                const h = findHolding(symbol);
                if (!h || qty > h.qty + 1e-9) { showToast(`You only hold ${h ? fmtQty(h.qty) : '0'} ${symbol}.`, 'error'); return; }
            }
            pendingOrders.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), symbol, side: currentSide, qty, limitPrice, tpPrice, slPrice });
            showToast(`Limit ${currentSide} order placed: ${fmtQty(qty)} ${symbol} @ ${fmtUsd(limitPrice, priceFmt(limitPrice))}.`, 'success');
            amountInput.value = '';
            clearTpSlInputs();
            persist(); renderAll(); maybeSnapshotEquity(true);
            return;
        }

        const { qty, price: refPrice } = amountToQtyAndValue();
        if (!refPrice) { showToast('Live price unavailable for that asset right now.', 'error'); return; }
        if (!qty || qty <= 0) { showToast('Enter a valid amount.', 'error'); return; }

        // TP/SL trigger prices are validated against the reference (last-trade) price the
        // ticket was showing, before slippage is applied to the actual fill below.
        if (currentSide === 'buy') {
            const rCheck = readTpSl('buy', refPrice);
            if (rCheck.error) { showToast(rCheck.error, 'error'); return; }
        }

        await simulateExecutionLatency(submitBtn);

        // Realistic fill: cross the live spread and pay/receive size-scaled slippage instead of
        // filling exactly at the reference price (see estimateFillPrice above).
        const { bid, ask } = getBidAsk(symbol);
        const notional = qty * refPrice;
        const fillPrice = estimateFillPrice(currentSide === 'buy' ? 'buy' : 'sell', refPrice, bid, ask, notional);
        if (!fillPrice) { showToast('Live price unavailable for that asset right now.', 'error'); return; }

        let ok;
        if (currentSide === 'buy') {
            const r = readTpSl('buy', refPrice);
            ok = executeBuy(symbol, qty, fillPrice, 'market', r.tpPrice, r.slPrice);
        } else {
            ok = executeSell(symbol, qty, fillPrice, 'market');
        }
        if (ok) {
            amountInput.value = '';
            clearTpSlInputs();
            persist(); renderAll(); maybeSnapshotEquity(true);
        }
    });

    function checkPendingOrders() {
        if (pendingOrders.length === 0) return;
        const stillPending = [];
        let filledAny = false;
        pendingOrders.forEach(o => {
            const price = getPrice(o.symbol);
            if (!price) { stillPending.push(o); return; }
            const shouldFill = o.side === 'buy' ? price <= o.limitPrice : price >= o.limitPrice;
            if (!shouldFill) { stillPending.push(o); return; }
            const ok = o.side === 'buy' ? executeBuy(o.symbol, o.qty, o.limitPrice, 'limit', o.tpPrice, o.slPrice) : executeSell(o.symbol, o.qty, o.limitPrice, 'limit');
            if (!ok) { stillPending.push(o); return; } // couldn't fill (e.g. cash/holding changed since placed) — keep trying
            filledAny = true;
        });
        pendingOrders = stillPending;
        if (filledAny) { persist(); maybeSnapshotEquity(true); }
    }

    document.getElementById('orders-rows').addEventListener('click', (e) => {
        const btn = e.target.closest('.cancel-order-btn');
        if (!btn) return;
        pendingOrders = pendingOrders.filter(o => o.id !== btn.getAttribute('data-id'));
        persist(); renderAll();
        showToast('Order cancelled.', 'info');
    });

    document.getElementById('holdings-rows').addEventListener('click', (e) => {
        const btn = e.target.closest('.quick-sell-btn');
        if (!btn) return;
        const symbol = btn.getAttribute('data-symbol');
        orderSymbolInput.value = symbol;
        setSide('sell');
        setType('market');
        onSymbolChange();
        document.getElementById('order-amount-unit').value = 'coins';
        const h = findHolding(symbol);
        amountInput.value = h ? h.qty : '';
        renderOrderSummary();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ---------- Account stats + equity curve ----------
    function computeStats() {
        let holdingsValue = 0, unrealized = 0;
        holdings.forEach(h => {
            const price = getPrice(h.symbol);
            holdingsValue += price * h.qty;
            unrealized += (price - h.avgCost) * h.qty;
        });
        let marginLocked = 0, futuresUnrealized = 0;
        futuresPositions.forEach(p => {
            marginLocked += p.margin;
            futuresUnrealized += futuresPnl(p, getPrice(p.symbol) || p.entryPrice);
        });
        // realized/fees pull straight from the trade log, which already carries futures
        // open/close/liquidation entries alongside spot ones — no separate accumulator needed.
        const realized = trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
        const fees = trades.reduce((sum, t) => sum + (t.fee || 0), 0);
        const equity = cash + holdingsValue + marginLocked + futuresUnrealized;
        const totalPnl = equity - totalDeposited;
        const closedTrades = trades.filter(t => t.side === 'sell' || t.type === 'close' || t.type === 'liquidated');
        const wins = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
        const winRate = closedTrades.length ? (wins / closedTrades.length) * 100 : null;
        return { holdingsValue, unrealized, realized, fees, equity, totalPnl, totalTrades: trades.length, winRate, marginLocked, futuresUnrealized };
    }

    function maybeSnapshotEquity(force) {
        const { equity } = computeStats();
        const now = Date.now();
        if (force || now - lastEquitySnapshot > EQUITY_POINT_INTERVAL_MS) {
            equityCurve.push({ ts: now, equity });
            if (equityCurve.length > MAX_EQUITY_POINTS) equityCurve = equityCurve.slice(-MAX_EQUITY_POINTS);
            lastEquitySnapshot = now;
            persist();
            updateEquityChart();
        }
    }

    function renderStats() {
        const s = computeStats();
        document.getElementById('stat-equity').innerText = fmtUsd(s.equity);
        const pnlEl = document.getElementById('stat-total-pnl');
        const pnlPct = totalDeposited ? (s.totalPnl / totalDeposited) * 100 : 0;
        pnlEl.innerText = `${fmtSigned(s.totalPnl)} (${s.totalPnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`;
        pnlEl.className = `text-sm font-mono font-bold ${pnlColorClass(s.totalPnl)}`;

        document.getElementById('stat-cash').innerText = fmtUsd(cash);
        document.getElementById('stat-holdings-value').innerText = fmtUsd(s.holdingsValue);
        const unrealEl = document.getElementById('stat-unrealized');
        unrealEl.innerText = fmtSigned(s.unrealized); unrealEl.className = `text-sm font-mono font-bold ${pnlColorClass(s.unrealized)}`;
        const realEl = document.getElementById('stat-realized');
        realEl.innerText = fmtSigned(s.realized); realEl.className = `text-sm font-mono font-bold ${pnlColorClass(s.realized)}`;
        document.getElementById('stat-deposited').innerText = fmtUsd(totalDeposited);
        document.getElementById('stat-trade-count').innerText = s.totalTrades;
        document.getElementById('stat-winrate').innerText = s.winRate === null ? '--' : `${s.winRate.toFixed(0)}%`;
        document.getElementById('stat-fees').innerText = fmtUsd(s.fees);
        document.getElementById('stat-margin-locked').innerText = fmtUsd(s.marginLocked);
        const futUnrealEl = document.getElementById('stat-futures-unrealized');
        futUnrealEl.innerText = fmtSigned(s.futuresUnrealized); futUnrealEl.className = `text-sm font-mono font-bold ${pnlColorClass(s.futuresUnrealized)}`;
    }

    function renderFuturesPositions() {
        const tbody = document.getElementById('futures-rows');
        if (futuresPositions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-gray-600 text-[11px]">No open positions — open a long or short above to get started.</td></tr>`;
            return;
        }
        tbody.innerHTML = futuresPositions.slice().sort((a, b) => b.ts - a.ts).map(p => {
            const mark = getPrice(p.symbol);
            const pnl = mark ? futuresPnl(p, mark) : 0;
            const roe = p.margin ? (pnl / p.margin) * 100 : 0;
            const sideColor = p.side === 'long' ? 'text-[#14d38a] bg-[#14d38a]/10 border-[#14d38a]/30' : 'text-[#ff4d6a] bg-[#ff4d6a]/10 border-[#ff4d6a]/30';
            const tpSlNote = (p.tpPrice || p.slPrice)
                ? `<div class="text-[9px] font-normal mt-0.5">${p.tpPrice ? `<span class="text-[#14d38a]">TP ${fmtUsd(p.tpPrice, priceFmt(p.tpPrice))}</span>` : ''}${p.tpPrice && p.slPrice ? ' <span class="text-gray-700">·</span> ' : ''}${p.slPrice ? `<span class="text-[#ff4d6a]">SL ${fmtUsd(p.slPrice, priceFmt(p.slPrice))}</span>` : ''}</div>`
                : '';
            return `
                <tr class="hover:bg-gray-800/40 transition-colors">
                    <td class="py-2 px-3 font-bold text-white">${escapeHtml(p.symbol)}${tpSlNote}</td>
                    <td class="py-2 px-3"><span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${sideColor}">${p.side}</span></td>
                    <td class="py-2 px-3 text-right text-gray-400">${p.leverage}x</td>
                    <td class="py-2 px-3 text-right text-gray-300">${fmtQty(p.qty)}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${fmtUsd(p.entryPrice, priceFmt(p.entryPrice))}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${mark ? fmtUsd(mark, priceFmt(mark)) : '<span class="text-gray-600">--</span>'}</td>
                    <td class="py-2 px-3 text-right text-gray-400">${fmtUsd(p.margin)}</td>
                    <td class="py-2 px-3 text-right text-amber-400/80">${fmtUsd(p.liqPrice, priceFmt(p.liqPrice))}</td>
                    <td class="py-2 px-3 text-right ${pnlColorClass(pnl)}">${fmtSigned(pnl)}<br><span class="text-[10px]">${pnl >= 0 ? '+' : ''}${roe.toFixed(1)}%</span></td>
                    <td class="py-2 px-3 text-center whitespace-nowrap">
                        <button class="pt-ai-btn text-[10px] px-1.5 py-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-[#c084fc] hover:border-[#a855f7]/40 cursor-pointer" data-id="${p.id}" title="Ask AI about this position"><i data-lucide="bot" width="12" height="12" stroke-width="2.2"></i></button>
                        <button class="close-position-btn text-[10px] px-2 py-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-[#ff4d6a] hover:border-[#ff4d6a]/40 cursor-pointer" data-id="${p.id}">Close</button>
                    </td>
                </tr>`;
        }).join('');
    }

    function renderHoldings() {
        const tbody = document.getElementById('holdings-rows');
        if (holdings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-gray-600 text-[11px]">No holdings yet — place a buy order to get started.</td></tr>`;
            return;
        }
        const s = computeStats();
        tbody.innerHTML = holdings.slice().sort((a, b) => (getPrice(b.symbol) * b.qty) - (getPrice(a.symbol) * a.qty)).map(h => {
            const price = getPrice(h.symbol);
            const value = price * h.qty;
            const pnl = (price - h.avgCost) * h.qty;
            const pnlPct = h.avgCost ? ((price - h.avgCost) / h.avgCost) * 100 : 0;
            const alloc = s.equity > 0 ? (value / s.equity) * 100 : 0;
            const tpSlNote = (h.tpPrice || h.slPrice)
                ? `<div class="text-[9px] font-normal mt-0.5">${h.tpPrice ? `<span class="text-[#14d38a]">TP ${fmtUsd(h.tpPrice, priceFmt(h.tpPrice))}</span>` : ''}${h.tpPrice && h.slPrice ? ' <span class="text-gray-700">·</span> ' : ''}${h.slPrice ? `<span class="text-[#ff4d6a]">SL ${fmtUsd(h.slPrice, priceFmt(h.slPrice))}</span>` : ''}</div>`
                : '';
            return `
                <tr class="hover:bg-gray-800/40 transition-colors">
                    <td class="py-2 px-3 font-bold text-white">${escapeHtml(h.symbol)}${tpSlNote}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${fmtQty(h.qty)}</td>
                    <td class="py-2 px-3 text-right text-gray-400">${fmtUsd(h.avgCost, priceFmt(h.avgCost))}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${price ? fmtUsd(price, priceFmt(price)) : '<span class="text-gray-600">--</span>'}</td>
                    <td class="py-2 px-3 text-right text-gray-200">${fmtUsd(value)}</td>
                    <td class="py-2 px-3 text-right text-gray-500">${alloc.toFixed(1)}%</td>
                    <td class="py-2 px-3 text-right ${pnlColorClass(pnl)}">${fmtSigned(pnl)}<br><span class="text-[10px]">${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</span></td>
                    <td class="py-2 px-3 text-center whitespace-nowrap">
                        <button class="pt-ai-btn text-[10px] px-1.5 py-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-[#c084fc] hover:border-[#a855f7]/40 cursor-pointer" data-symbol="${escapeHtml(h.symbol)}" title="Ask AI about this holding"><i data-lucide="bot" width="12" height="12" stroke-width="2.2"></i></button>
                        <button class="quick-sell-btn text-[10px] px-2 py-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-[#ff4d6a] hover:border-[#ff4d6a]/40 cursor-pointer" data-symbol="${escapeHtml(h.symbol)}">Sell</button>
                    </td>
                </tr>`;
        }).join('');
    }

    function renderOrders() {
        const tbody = document.getElementById('orders-rows');
        document.getElementById('pending-orders-count').innerText = `${pendingOrders.length} open`;
        if (pendingOrders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-gray-600 text-[11px]">No pending limit orders.</td></tr>`;
            return;
        }
        tbody.innerHTML = pendingOrders.slice().sort((a, b) => b.ts - a.ts).map(o => {
            const sideColor = o.side === 'buy' ? 'text-[#14d38a] bg-[#14d38a]/10 border-[#14d38a]/30' : 'text-[#ff4d6a] bg-[#ff4d6a]/10 border-[#ff4d6a]/30';
            return `
                <tr class="hover:bg-gray-800/40 transition-colors">
                    <td class="py-2 px-3 font-bold text-white">${escapeHtml(o.symbol)}</td>
                    <td class="py-2 px-3"><span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${sideColor}">${o.side}</span></td>
                    <td class="py-2 px-3 text-right text-gray-300">${fmtQty(o.qty)}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${fmtUsd(o.limitPrice, priceFmt(o.limitPrice))}</td>
                    <td class="py-2 px-3 text-right text-gray-500">${new Date(o.ts).toLocaleTimeString()}</td>
                    <td class="py-2 px-3 text-center"><button class="cancel-order-btn text-gray-500 hover:text-[#ff4d6a] cursor-pointer" data-id="${o.id}"><i data-lucide="x" width="12" height="12" stroke-width="2.4"></i></button></td>
                </tr>`;
        }).join('');
    }

    function renderTrades() {
        const tbody = document.getElementById('trades-rows');
        if (trades.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-gray-600 text-[11px]">No trades yet.</td></tr>`;
            return;
        }
        tbody.innerHTML = trades.slice(0, 100).map(t => {
            const isGreenSide = t.side === 'buy' || t.side === 'long';
            const sideColor = isGreenSide ? 'text-[#14d38a] bg-[#14d38a]/10 border-[#14d38a]/30' : 'text-[#ff4d6a] bg-[#ff4d6a]/10 border-[#ff4d6a]/30';
            const assetLabel = t.leverage ? `${escapeHtml(t.symbol)} <span class="text-gray-500">${t.leverage}x</span>` : escapeHtml(t.symbol);
            const typeLabel = t.type === 'liquidated' ? '<span class="text-[#ff4d6a]">liquidated</span>' : t.type;
            return `
                <tr class="hover:bg-gray-800/40 transition-colors">
                    <td class="py-2 px-3 text-gray-500">${new Date(t.ts).toLocaleString()}</td>
                    <td class="py-2 px-3 font-bold text-white">${assetLabel}</td>
                    <td class="py-2 px-3"><span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${sideColor}">${t.side}</span></td>
                    <td class="py-2 px-3 text-gray-500 uppercase text-[10px]">${typeLabel}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${fmtQty(t.qty)}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${fmtUsd(t.price, priceFmt(t.price))}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${fmtUsd(t.value)}</td>
                    <td class="py-2 px-3 text-right text-gray-600">${fmtUsd(t.fee)}</td>
                    <td class="py-2 px-3 text-right ${t.realizedPnl === null ? 'text-gray-600' : pnlColorClass(t.realizedPnl)}">${t.realizedPnl === null ? '--' : fmtSigned(t.realizedPnl)}</td>
                </tr>`;
        }).join('');
    }

    function renderAll() {
        renderStats();
        renderHoldings();
        renderFuturesPositions();
        renderOrders();
        renderTrades();
        renderOrderTicketPrice();
        renderAvailableHint();
        renderOrderSummary();
        updateChartOverlays();
    }

    // ---------- Equity chart (TradingView Lightweight Charts, same lib the terminal uses) ----------
    let equityChart = null, equitySeries = null;
    function initEquityChart() {
        if (typeof LightweightCharts === 'undefined') {
            console.warn('Lightweight Charts failed to load — equity curve will stay hidden.');
            document.getElementById('equity-chart').innerHTML = '<div class="flex items-center justify-center h-full text-[10px] text-gray-600">Chart library unavailable — everything else on this page still works.</div>';
            return;
        }
        const container = document.getElementById('equity-chart');
        equityChart = LightweightCharts.createChart(container, {
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8b93a7', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
            grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
            rightPriceScale: { borderVisible: false },
            timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
            crosshair: { horzLine: { labelBackgroundColor: '#14d38a' }, vertLine: { labelBackgroundColor: '#14d38a' } },
            handleScroll: false, handleScale: false,
        });
        equitySeries = equityChart.addAreaSeries({
            lineColor: '#14d38a', topColor: 'rgba(20, 211, 138, 0.28)', bottomColor: 'rgba(20, 211, 138, 0.02)',
            lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
        });
        new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            equityChart.resize(width, height);
        }).observe(container);
    }
    function updateEquityChart() {
        if (!equitySeries) return;
        const seen = new Set();
        const data = equityCurve
            .map(p => ({ time: Math.floor(p.ts / 1000), value: p.equity }))
            .filter(p => (seen.has(p.time) ? false : (seen.add(p.time), true)))
            .sort((a, b) => a.time - b.time);
        if (data.length === 1) data.push({ time: data[0].time + 1, value: data[0].value });
        equitySeries.setData(data);
        equityChart.timeScale().fitContent();
    }

    // ---------- Live price chart (candles for the symbol on the order ticket, plus this
    // account's own entries/exits and active TP/SL/liq levels drawn straight on top) ----------
    const CHART_INTERVALS = ['15m', '1h', '4h', '1d'];
    let priceChart = null, priceCandleSeries = null;
    let chartInterval = '1h';
    let chartSymbol = null, chartIsFutures = false;
    let chartCandles = [];       // cached candles for the symbol currently on the chart
    let chartRequestToken = 0;   // guards against a slow earlier fetch overwriting a newer one

    function klinesUrl(symbol, isFutures, interval, limit) {
        return isFutures
            ? `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`
            : `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`;
    }

    function initPriceChart() {
        const container = document.getElementById('pt-price-chart');
        if (!container || typeof LightweightCharts === 'undefined') return;
        priceChart = LightweightCharts.createChart(container, {
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8b93a7', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
            grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
            rightPriceScale: { borderVisible: false },
            timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        });
        priceCandleSeries = priceChart.addCandlestickSeries({
            upColor: '#14d38a', downColor: '#ff4d6a', borderVisible: false,
            wickUpColor: '#14d38a', wickDownColor: '#ff4d6a',
        });
        new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            priceChart.resize(width, height);
        }).observe(container);
    }

    // Full reload: called when the symbol, market (spot/futures), or timeframe changes.
    async function loadPriceChart() {
        if (!priceCandleSeries) return;
        const symbol = orderSymbolInput.value.toUpperCase().trim();
        const isFutures = currentMarket === 'futures';
        if (!symbol) return;
        chartSymbol = symbol; chartIsFutures = isFutures;
        const myToken = ++chartRequestToken;
        const statusEl = document.getElementById('pt-chart-status');
        if (statusEl) statusEl.innerText = 'Loading…';
        try {
            const res = await fetchWithTimeout(klinesUrl(symbol, isFutures, chartInterval, 250), 12000);
            if (myToken !== chartRequestToken) return;
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (myToken !== chartRequestToken) return;
            if (!Array.isArray(data) || data.length === 0) throw new Error('No candle data.');
            chartCandles = data.map(d => ({
                time: Math.floor(d[0] / 1000), open: parseFloat(d[1]), high: parseFloat(d[2]),
                low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
            }));
            priceCandleSeries.setData(chartCandles);
            priceChart.timeScale().fitContent();
            updateChartOverlays();
            if (statusEl) statusEl.innerText = `${symbol}/USDT · ${isFutures ? 'Futures' : 'Spot'} · ${chartInterval}`;
        } catch (err) {
            if (myToken !== chartRequestToken) return;
            if (statusEl) statusEl.innerText = 'Chart data unavailable — everything else on this page still works.';
        }
    }

    // Lightweight per-poll update: patches the live (in-progress) candle from the latest ticker
    // price instead of refetching the whole series every 5s. Keeps the chart moving in near
    // real time without hammering the klines endpoint.
    function updateChartLiveCandle() {
        if (!priceCandleSeries || chartCandles.length === 0) return;
        const symbol = orderSymbolInput.value.toUpperCase().trim();
        if (symbol !== chartSymbol || (currentMarket === 'futures') !== chartIsFutures) return;
        const price = getPrice(symbol);
        if (!price) return;
        const last = chartCandles[chartCandles.length - 1];
        last.close = price;
        if (price > last.high) last.high = price;
        if (price < last.low) last.low = price;
        priceCandleSeries.update(last);
    }

    // Markers for this account's own trades in the symbol on screen, plus price lines for any
    // active holding (spot) or open position (futures) in it — entry/avg cost, TP, SL, and for
    // futures, the estimated liquidation price. This is the "AI/you can see your live trades on
    // the chart" link between the order ticket, the trade log, and the chart itself.
    let chartPriceLines = [];
    function updateChartOverlays() {
        if (!priceCandleSeries || !chartSymbol) return;
        chartPriceLines.forEach(line => { try { priceCandleSeries.removePriceLine(line); } catch (e) {} });
        chartPriceLines = [];

        const candleTimes = chartCandles.map(c => c.time);
        const minTime = candleTimes[0], maxTime = candleTimes[candleTimes.length - 1];
        // Snap a trade's timestamp onto the nearest loaded candle so old trades still show up
        // pinned to the edge of the visible range instead of silently vanishing.
        function snapTime(ts) {
            const t = Math.floor(ts / 1000);
            if (t <= minTime) return minTime;
            if (t >= maxTime) return maxTime;
            return candleTimes.reduce((best, cand) => Math.abs(cand - t) < Math.abs(best - t) ? cand : best, candleTimes[0]);
        }

        const relevantTrades = trades.filter(t => t.symbol === chartSymbol && (t.leverage ? chartIsFutures : !chartIsFutures));
        const markers = relevantTrades.slice(0, 200).map(t => {
            const isEntry = t.side === 'buy' || t.type === 'open';
            const isBad = typeof t.realizedPnl === 'number' && t.realizedPnl < 0;
            const color = isEntry ? '#4fd8e8' : (isBad ? '#ff4d6a' : '#14d38a');
            const text = t.type === 'tp' ? 'TP' : t.type === 'sl' ? 'SL' : t.type === 'liquidated' ? 'LIQ' : (isEntry ? (t.side === 'short' ? 'Short' : (t.side === 'long' ? 'Long' : 'Buy')) : 'Sell');
            return { time: snapTime(t.ts), position: isEntry ? 'belowBar' : 'aboveBar', color, shape: isEntry ? 'arrowUp' : 'arrowDown', text };
        }).sort((a, b) => a.time - b.time);
        priceCandleSeries.setMarkers(markers);

        if (!chartIsFutures) {
            const h = findHolding(chartSymbol);
            if (h) {
                chartPriceLines.push(priceCandleSeries.createPriceLine({ price: h.avgCost, color: '#8b93a7', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Avg cost' }));
                if (h.tpPrice) chartPriceLines.push(priceCandleSeries.createPriceLine({ price: h.tpPrice, color: '#14d38a', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'TP' }));
                if (h.slPrice) chartPriceLines.push(priceCandleSeries.createPriceLine({ price: h.slPrice, color: '#ff4d6a', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'SL' }));
            }
        } else {
            const p = futuresPositions.find(x => x.symbol === chartSymbol);
            if (p) {
                chartPriceLines.push(priceCandleSeries.createPriceLine({ price: p.entryPrice, color: '#8b93a7', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `Entry (${p.side})` }));
                if (p.tpPrice) chartPriceLines.push(priceCandleSeries.createPriceLine({ price: p.tpPrice, color: '#14d38a', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'TP' }));
                if (p.slPrice) chartPriceLines.push(priceCandleSeries.createPriceLine({ price: p.slPrice, color: '#ff4d6a', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'SL' }));
                chartPriceLines.push(priceCandleSeries.createPriceLine({ price: p.liqPrice, color: '#e5b324', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'Liq.' }));
            }
        }
    }

    document.querySelectorAll('.pt-chart-tf-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            chartInterval = btn.getAttribute('data-tf');
            document.querySelectorAll('.pt-chart-tf-btn').forEach(b => b.classList.toggle('active', b === btn));
            loadPriceChart();
        });
    });

    // ---------- AI trade read: send this account's own live position in an asset, alongside
    // fresh technicals, to the same backend the Terminal's AI Insight panel uses. Shares its
    // API-key storage (sessionStorage/localStorage keys) so a key saved on the Terminal or AI
    // Research page already works here — nothing new to set up. ----------
    function getStoredGroqKey() { return sessionStorage.getItem('cw_groq_api_key') || ''; }
    function getAiKeyMode() { return localStorage.getItem('cw_ai_key_mode') === 'house' ? 'house' : 'own'; }
    function setAiKeyMode(mode) { localStorage.setItem('cw_ai_key_mode', mode === 'house' ? 'house' : 'own'); }
    function resolveApiUrl(path) {
        const base = (CW_CONFIG.apiBaseUrl || '').replace(/\/$/, '');
        return /^https?:\/\//i.test(path) ? path : `${base}${path}`;
    }

    function sma(values, n) {
        if (values.length < n) return null;
        const slice = values.slice(-n);
        return slice.reduce((a, b) => a + b, 0) / n;
    }
    function rsi14FromCloses(closes) {
        if (closes.length < 15) return null;
        let gains = 0, losses = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) gains += diff; else losses -= diff;
        }
        const avgGain = gains / 14, avgLoss = losses / 14;
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + avgGain / avgLoss));
    }
    async function fetch24hStats(symbol, isFutures) {
        const url = isFutures
            ? `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}USDT`
            : `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`;
        const res = await fetchWithTimeout(url, 9000);
        if (!res.ok) throw new Error('24h stats unavailable right now.');
        const row = await res.json();
        return {
            price: parseFloat(row.lastPrice), change24hPct: parseFloat(row.priceChangePercent),
            high24h: parseFloat(row.highPrice), low24h: parseFloat(row.lowPrice), volume24hUSDT: parseFloat(row.quoteVolume),
        };
    }

    async function buildAiContext(symbol, isFutures, position) {
        const [stats, klines] = await Promise.all([
            fetch24hStats(symbol, isFutures),
            fetchWithTimeout(klinesUrl(symbol, isFutures, '1h', 60), 12000).then(r => {
                if (!r.ok) throw new Error('Chart data unavailable right now.');
                return r.json();
            }),
        ]);
        const candles = klines.map(d => ({ high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]) }));
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high).slice(-30);
        const lows = candles.map(c => c.low).slice(-30);
        const ctx = {
            asset: symbol, market: isFutures ? 'perpetual futures' : 'spot', interval: '1h',
            price: stats.price, change24hPct: stats.change24hPct, high24h: stats.high24h,
            low24h: stats.low24h, volume24hUSDT: stats.volume24hUSDT,
            ma7: sma(closes, 7), ma25: sma(closes, 25), rsi14: rsi14FromCloses(closes),
            recentSwingHigh: Math.max(...highs), recentSwingLow: Math.min(...lows),
            recentClosesTrend: closes.slice(-30),
        };
        if (isFutures) {
            // fapi's 24hr ticker doesn't return a funding rate — leaving fundingRatePct unset is
            // fine, the backend's prompt builder only mentions funding when the number is present.
        }
        if (position) ctx.position = position;
        return ctx;
    }

    // When using CryptoBolt's shared house key, attach the visitor's own Supabase session (if
    // they're signed in) so the backend can rate-limit per account instead of per IP address —
    // otherwise unrelated visitors sharing a Wi-Fi network or mobile carrier's NAT would land
    // in the same bucket and rate-limit each other. Signing in was never required to use the
    // house key and still isn't: this only upgrades the key when it can, and any failure here
    // (not signed in, auth not configured, a hiccup fetching the session) just falls back to
    // IP-based limiting server-side, same as before.
    async function getHouseKeyAuthHeader() {
        try {
            const client = window.cwAuth && window.cwAuth.isConfigured() && window.cwAuth.getClient();
            if (!client) return {};
            const { data } = await client.auth.getSession();
            const token = data?.session?.access_token;
            return token ? { authorization: `Bearer ${token}` } : {};
        } catch (err) {
            return {};
        }
    }

    async function requestAiPositionRead(ctx) {
        const useHouseKey = getAiKeyMode() === 'house';
        const apiKey = getStoredGroqKey();
        if (!useHouseKey && !apiKey) { const e = new Error('NEEDS_KEY'); e.code = 'NEEDS_KEY'; throw e; }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
            const headers = { 'content-type': 'application/json' };
            if (useHouseKey) { headers['x-use-house-key'] = '1'; Object.assign(headers, await getHouseKeyAuthHeader()); }
            else headers['x-groq-key'] = apiKey;
            const res = await fetch(resolveApiUrl(CW_CONFIG.aiInsightUrl), {
                method: 'POST', headers, body: JSON.stringify({ context: ctx }), signal: controller.signal,
            });
            if (res.status === 401) throw new Error('Invalid API key — re-check the key saved in the AI panel.');
            if (res.status === 429) throw new Error('Rate limited — wait a moment and try again.');
            if (!res.ok) {
                const errBody = await res.json().catch(() => null);
                throw new Error(errBody?.error || `AI service responded with status ${res.status}`);
            }
            const data = await res.json();
            if (!data?.result) throw new Error('AI service returned an unexpected response.');
            return data.result;
        } finally {
            clearTimeout(timer);
        }
    }

    const aiPanel = document.getElementById('pt-ai-panel');
    const aiPanelBody = document.getElementById('pt-ai-panel-body');
    const aiPanelTitle = document.getElementById('pt-ai-panel-title');
    document.getElementById('pt-ai-panel-close')?.addEventListener('click', () => aiPanel.classList.add('hidden'));
    aiPanel?.addEventListener('click', (e) => { if (e.target === aiPanel) aiPanel.classList.add('hidden'); });

    function renderAiPanelLoading(label) {
        aiPanelTitle.innerHTML = `<i data-lucide="bot" width="13" height="13" stroke-width="2.2" style="vertical-align:-2px;"></i> AI read — ${label}`;
        aiPanelBody.innerHTML = `<div class="flex items-center gap-2 text-gray-500 text-xs py-6 justify-center"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-[#a855f7]"></div>Reading live technicals + your open position…</div>`;
        aiPanel.classList.remove('hidden');
    }
    function renderAiPanelNeedsKey(retry) {
        aiPanelBody.innerHTML = `
            <p class="text-xs text-gray-400 mb-3">Needs a Groq API key to generate a read (free at <a href="https://console.groq.com/keys" target="_blank" rel="noopener" class="text-[#4fd8e8] hover:underline">console.groq.com</a>), or use CryptoBolt's shared key.</p>
            <div class="flex items-center gap-2 mb-2">
                <input id="pt-ai-key-input" type="password" placeholder="gsk_..." class="flex-1 bg-gray-900 border border-gray-800 rounded text-xs px-2 py-1.5 text-gray-200 font-mono focus:outline-none focus:border-[#a855f7]">
                <button id="pt-ai-key-save-btn" class="text-[10px] font-bold px-2 py-1.5 rounded bg-[#a855f7]/20 text-[#c084fc] cursor-pointer">Save &amp; Retry</button>
            </div>
            <button id="pt-ai-key-house-btn" class="text-[10px] text-gray-500 hover:text-[#4fd8e8] cursor-pointer underline">Use CryptoBolt's shared key instead</button>
        `;
        document.getElementById('pt-ai-key-save-btn').addEventListener('click', () => {
            const key = document.getElementById('pt-ai-key-input').value.trim();
            if (!key) { showToast('Paste a valid Groq API key first.', 'error'); return; }
            sessionStorage.setItem('cw_groq_api_key', key);
            setAiKeyMode('own');
            retry();
        });
        document.getElementById('pt-ai-key-house-btn').addEventListener('click', () => { setAiKeyMode('house'); retry(); });
    }
    function renderAiPanelError(message, retry) {
        aiPanelBody.innerHTML = `<p class="text-xs text-[#ff4d6a] mb-3">${escapeHtml(message)}</p><button id="pt-ai-retry-btn" class="text-[10px] font-bold px-2 py-1.5 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-[#a855f7] cursor-pointer">Try again</button>`;
        document.getElementById('pt-ai-retry-btn').addEventListener('click', retry);
    }
    function renderAiPanelResult(result) {
        const trendColor = result.trend === 'bullish' ? 'text-[#14d38a]' : result.trend === 'bearish' ? 'text-[#ff4d6a]' : 'text-gray-400';
        aiPanelBody.innerHTML = `
            <div class="flex items-center gap-2 mb-2 text-xs">
                <span class="font-bold uppercase ${trendColor}">${escapeHtml(result.trend || '--')}</span>
                <span class="text-gray-600">·</span>
                <span class="text-gray-400">${escapeHtml(result.momentum || '--')} momentum</span>
                ${result.confidence ? `<span class="text-gray-600">·</span><span class="text-gray-500">${escapeHtml(result.confidence)} confidence</span>` : ''}
            </div>
            ${result.positionNote ? `<div class="rounded border border-[#a855f7]/30 bg-[#a855f7]/10 px-3 py-2 mb-3"><span class="text-[9px] font-bold uppercase text-[#c084fc] block mb-1">On your open position</span><p class="text-xs text-gray-300 leading-snug">${escapeHtml(result.positionNote)}</p></div>` : ''}
            <p class="text-xs text-gray-400 leading-snug mb-2">${escapeHtml(result.summary || '')}</p>
            ${result.keyRisk ? `<p class="text-[11px] text-gray-500 leading-snug"><span class="text-gray-400 font-bold">Key risk:</span> ${escapeHtml(result.keyRisk)}</p>` : ''}
            <p class="text-[9px] text-gray-600 mt-3"><i data-lucide="triangle-alert" width="10" height="10" stroke-width="2.2" style="vertical-align:-1px;"></i> AI-generated, can be wrong — not financial advice, and this account is practice money regardless of what it says.</p>
        `;
    }

    async function openAiPositionRead(symbol, isFutures, position, label) {
        renderAiPanelLoading(label);
        const attempt = async () => {
            renderAiPanelLoading(label);
            try {
                const ctx = await buildAiContext(symbol, isFutures, position);
                const result = await requestAiPositionRead(ctx);
                renderAiPanelResult(result);
            } catch (err) {
                if (err.code === 'NEEDS_KEY') { renderAiPanelNeedsKey(attempt); return; }
                renderAiPanelError(err.message || 'Something went wrong generating the read.', attempt);
            }
        };
        attempt();
    }

    document.getElementById('holdings-rows').addEventListener('click', (e) => {
        const btn = e.target.closest('.pt-ai-btn');
        if (!btn) return;
        const symbol = btn.getAttribute('data-symbol');
        const h = findHolding(symbol);
        if (!h) return;
        const price = getPrice(symbol) || h.avgCost;
        const position = {
            side: 'long', entryPrice: h.avgCost, qty: h.qty,
            unrealizedPnlPct: h.avgCost ? ((price - h.avgCost) / h.avgCost) * 100 : 0,
            tpPrice: h.tpPrice || undefined, slPrice: h.slPrice || undefined,
        };
        openAiPositionRead(symbol, false, position, `${symbol} holding`);
    });

    document.getElementById('futures-rows').addEventListener('click', (e) => {
        const btn = e.target.closest('.pt-ai-btn');
        if (!btn) return;
        const p = futuresPositions.find(x => x.id === btn.getAttribute('data-id'));
        if (!p) return;
        const mark = getPrice(p.symbol) || p.entryPrice;
        const position = {
            side: p.side, entryPrice: p.entryPrice, qty: p.qty, leverage: p.leverage,
            unrealizedPnlPct: p.margin ? (futuresPnl(p, mark) / p.margin) * 100 : 0,
            tpPrice: p.tpPrice || undefined, slPrice: p.slPrice || undefined, liqPrice: p.liqPrice,
        };
        openAiPositionRead(p.symbol, true, position, `${p.symbol} ${p.leverage}x ${p.side}`);
    });

    // ---------- Reset / add funds ----------
    const resetModal = document.getElementById('reset-modal');
    document.getElementById('reset-account-btn').addEventListener('click', () => resetModal.classList.add('cw-visible'));
    document.getElementById('reset-modal-close').addEventListener('click', () => resetModal.classList.remove('cw-visible'));
    document.getElementById('reset-modal-cancel').addEventListener('click', () => resetModal.classList.remove('cw-visible'));
    document.getElementById('reset-modal-confirm').addEventListener('click', () => {
        cash = STARTING_BALANCE;
        totalDeposited = STARTING_BALANCE;
        holdings = []; trades = []; pendingOrders = []; futuresPositions = [];
        equityCurve = [{ ts: Date.now(), equity: STARTING_BALANCE }];
        lastEquitySnapshot = Date.now();
        persist(); renderAll(); updateEquityChart();
        resetModal.classList.remove('cw-visible');
        showToast('Account reset to $10,000.00.', 'success');
    });
    resetModal.addEventListener('click', (e) => { if (e.target === resetModal) resetModal.classList.remove('cw-visible'); });

    const fundsModal = document.getElementById('funds-modal');
    document.getElementById('add-funds-btn').addEventListener('click', () => fundsModal.classList.add('cw-visible'));
    document.getElementById('funds-modal-close').addEventListener('click', () => fundsModal.classList.remove('cw-visible'));
    fundsModal.addEventListener('click', (e) => { if (e.target === fundsModal) fundsModal.classList.remove('cw-visible'); });
    function addFunds(amount) {
        if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }
        cash += amount; totalDeposited += amount;
        persist(); renderAll(); maybeSnapshotEquity(true);
        fundsModal.classList.remove('cw-visible');
        showToast(`Added ${fmtUsd(amount)} to your account.`, 'success');
    }
    document.querySelectorAll('.funds-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => addFunds(parseFloat(btn.getAttribute('data-amount'))));
    });
    document.getElementById('funds-custom-add-btn').addEventListener('click', () => {
        const val = parseFloat(document.getElementById('funds-custom-input').value);
        addFunds(val);
        document.getElementById('funds-custom-input').value = '';
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        resetModal.classList.remove('cw-visible');
        fundsModal.classList.remove('cw-visible');
        aiPanel?.classList.add('hidden');
    });

    // ---------- CSV exports ----------
    document.getElementById('holdings-csv-btn').addEventListener('click', () => {
        if (holdings.length === 0) { showToast('No holdings to export.', 'error'); return; }
        const lines = [['Asset', 'Qty', 'AvgCost', 'Price', 'Value', 'PnL'].join(',')];
        holdings.forEach(h => {
            const price = getPrice(h.symbol);
            lines.push([h.symbol, h.qty, h.avgCost.toFixed(6), price || '', (price * h.qty).toFixed(2), ((price - h.avgCost) * h.qty).toFixed(2)].join(','));
        });
        downloadCSV(lines.join('\n'), `paper_holdings_${Date.now()}.csv`);
    });
    document.getElementById('futures-csv-btn').addEventListener('click', () => {
        if (futuresPositions.length === 0) { showToast('No open positions to export.', 'error'); return; }
        const lines = [['Asset', 'Side', 'Leverage', 'Qty', 'Entry', 'Mark', 'Margin', 'LiqPrice', 'PnL'].join(',')];
        futuresPositions.forEach(p => {
            const mark = getPrice(p.symbol);
            const pnl = mark ? futuresPnl(p, mark) : '';
            lines.push([p.symbol, p.side, p.leverage, p.qty, p.entryPrice, mark || '', p.margin.toFixed(2), p.liqPrice.toFixed(6), pnl === '' ? '' : pnl.toFixed(2)].join(','));
        });
        downloadCSV(lines.join('\n'), `paper_futures_positions_${Date.now()}.csv`);
    });
    document.getElementById('trades-csv-btn').addEventListener('click', () => {
        if (trades.length === 0) { showToast('No trades to export.', 'error'); return; }
        const lines = [['Time', 'Asset', 'Side', 'Type', 'Qty', 'Price', 'Value', 'Fee', 'RealizedPnL'].join(',')];
        trades.forEach(t => {
            lines.push([new Date(t.ts).toISOString(), t.symbol, t.side, t.type, t.qty, t.price, t.value.toFixed(2), t.fee.toFixed(2), t.realizedPnl === null ? '' : t.realizedPnl.toFixed(2)].join(','));
        });
        downloadCSV(lines.join('\n'), `paper_trades_${Date.now()}.csv`);
    });
    // Accessor for other modules on this page. getEquity() is read by js/22-leaderboard.js;
    // must be assigned unconditionally at boot (not inside any button handler) so the
    // leaderboard can read live equity from the moment the page loads. addBonusCash() is used
    // by js/24-referrals.js to deposit a referral bonus without going through the "Add Funds"
    // modal (it doesn't count toward totalDeposited, since it's a bonus, not a deposit).
    window.cwPaperTrading = {
        getEquity: () => computeStats().equity,
        addBonusCash: (amount) => {
            if (!(amount > 0)) return;
            cash += amount;
            persist(); renderAll(); maybeSnapshotEquity(true);
        },
    };

    // ---------- Boot ----------
    document.getElementById('footer-year').innerText = new Date().getFullYear();
    setMarket('spot');
    setSide('buy');
    setType('market');
    setLeverage(DEFAULT_LEVERAGE);
    renderChips();
    renderAll();

    (async function boot() {
        await bootstrapPrices();
        populateSymbolList();
        highlightActiveChip();
        await refresh24hChange(orderSymbolInput.value.toUpperCase().trim());
        await refreshNeededPrices();
        initEquityChart();
        updateEquityChart();
        initPriceChart();
        loadPriceChart();
        setInterval(refreshNeededPrices, PRICE_POLL_MS);
    })();
})();