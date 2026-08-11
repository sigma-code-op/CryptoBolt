// ---------- Trading Account: a self-contained practice buy/sell simulator. ----------
// Runs on trade.html only (not the main terminal). Virtual cash + holdings + trade log all
// live in localStorage under 'cw_paper_*' keys, kept deliberately separate from the manual
// holdings tracker on the terminal (cw_holdings) so the two never collide. Prices come straight
// from Binance's public REST API — no backend, no account, no real money anywhere in this file.

(function () {
    const FEE_RATE = 0.001; // 0.10% simulated trading fee, applied on both buy and sell notional
    const STARTING_BALANCE = 10000;
    const EQUITY_POINT_INTERVAL_MS = 60000; // snapshot equity at most once a minute on its own
    const MAX_EQUITY_POINTS = 500;
    const PRICE_POLL_MS = 5000;
    const POPULAR_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'TRX', 'LTC', 'SHIB', 'SUI', 'PEPE'];

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
    let trades = safeJSONParse(localStorage.getItem('cw_paper_trades'), []); // [{id, ts, symbol, side, type, qty, price, value, fee, realizedPnl}]
    let pendingOrders = safeJSONParse(localStorage.getItem('cw_paper_orders'), []); // [{id, ts, symbol, side, qty, limitPrice}]
    let equityCurve = safeJSONParse(localStorage.getItem('cw_paper_equity_curve'), []); // [{ts, equity}]

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
    }

    // ---------- Live prices ----------
    let priceMap = {};       // BASE -> price (USDT pairs only)
    let changeMap = {};      // BASE -> 24h % change, filled lazily per selected symbol
    let validSymbols = new Set();
    let lastEquitySnapshot = 0;

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
        const pairs = Array.from(needed).filter(Boolean).map(b => `${b}USDT`);
        if (pairs.length === 0) return;
        try {
            const symbolsParam = encodeURIComponent(JSON.stringify(pairs));
            const res = await fetchWithTimeout(`https://api.binance.com/api/v3/ticker/price?symbols=${symbolsParam}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const arr = await res.json();
            if (Array.isArray(arr)) {
                arr.forEach(row => {
                    if (row.symbol && row.symbol.endsWith('USDT')) {
                        priceMap[row.symbol.replace('USDT', '')] = parseFloat(row.price) || 0;
                    }
                });
            }
            setFeedStatus('live', 'Live');
            checkPendingOrders();
            renderAll();
            maybeSnapshotEquity();
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
    const sideButtons = document.querySelectorAll('.order-side-btn');
    const typeButtons = document.querySelectorAll('.order-type-btn');
    const limitPriceRow = document.getElementById('limit-price-row');
    const limitPriceInput = document.getElementById('order-limit-price-input');
    const amountInput = document.getElementById('order-amount-input');
    const amountUnitSelect = document.getElementById('order-amount-unit');
    const amountHint = document.getElementById('order-amount-hint');
    const availableHint = document.getElementById('order-available-hint');
    const submitBtn = document.getElementById('submit-order-btn');
    const summaryFeeEl = document.getElementById('order-summary-fee');
    const summaryTotalEl = document.getElementById('order-summary-total');
    const summaryLabelEl = document.getElementById('order-summary-label');
    const livePriceEl = document.getElementById('order-live-price');
    const liveChangeEl = document.getElementById('order-live-change');

    let currentSide = 'buy';
    let currentType = 'market';

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
        if (currentSide === 'buy') {
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

    function renderOrderSummary() {
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

    function setSide(side) {
        currentSide = side;
        sideButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-side') === side));
        submitBtn.innerText = `Place ${side === 'buy' ? 'Buy' : 'Sell'} Order`;
        submitBtn.className = `w-full text-sm font-bold uppercase py-2.5 rounded transition-all cursor-pointer ${side === 'buy' ? 'bg-[#14d38a] text-[#0b0e11] hover:opacity-90' : 'bg-[#ff4d6a] text-white hover:opacity-90'}`;
        renderAvailableHint();
        renderOrderSummary();
    }
    function setType(type) {
        currentType = type;
        typeButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-type') === type));
        limitPriceRow.classList.toggle('hidden', type !== 'limit');
        renderOrderSummary();
    }

    sideButtons.forEach(b => b.addEventListener('click', () => setSide(b.getAttribute('data-side'))));
    typeButtons.forEach(b => b.addEventListener('click', () => setType(b.getAttribute('data-type'))));
    orderSymbolInput.addEventListener('change', onSymbolChange);
    orderSymbolInput.addEventListener('blur', onSymbolChange);
    [amountInput, amountUnitSelect, limitPriceInput].forEach(el => el.addEventListener('input', renderOrderSummary));
    document.querySelectorAll('.order-pct-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const pct = parseFloat(btn.getAttribute('data-pct'));
            const symbol = orderSymbolInput.value.toUpperCase().trim();
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

    // ---------- Trade execution ----------
    function executeBuy(symbol, qty, price, type) {
        const value = qty * price;
        const fee = value * FEE_RATE;
        const totalCost = value + fee;
        if (totalCost > cash + 1e-9) { showToast(`Not enough cash — need ${fmtUsd(totalCost)}, have ${fmtUsd(cash)}.`, 'error'); return false; }
        cash -= totalCost;
        let h = findHolding(symbol);
        if (h) {
            const newQty = h.qty + qty;
            h.avgCost = (h.qty * h.avgCost + value + fee) / newQty;
            h.qty = newQty;
        } else {
            holdings.push({ symbol, qty, avgCost: (value + fee) / qty });
        }
        trades.unshift({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), symbol, side: 'buy', type, qty, price, value, fee, realizedPnl: null });
        showToast(`Bought ${fmtQty(qty)} ${symbol} at ${fmtUsd(price, priceFmt(price))}.`, 'success');
        return true;
    }

    function executeSell(symbol, qty, price, type) {
        const h = findHolding(symbol);
        if (!h || qty > h.qty + 1e-9) { showToast(`You only hold ${h ? fmtQty(h.qty) : '0'} ${symbol}.`, 'error'); return false; }
        const value = qty * price;
        const fee = value * FEE_RATE;
        const proceeds = value - fee;
        const costBasis = qty * h.avgCost;
        const realizedPnl = proceeds - costBasis;
        cash += proceeds;
        h.qty -= qty;
        if (h.qty <= 1e-9) holdings = holdings.filter(x => x !== h);
        trades.unshift({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), symbol, side: 'sell', type, qty, price, value, fee, realizedPnl });
        showToast(`Sold ${fmtQty(qty)} ${symbol} at ${fmtUsd(price, priceFmt(price))} — ${realizedPnl >= 0 ? 'profit' : 'loss'} of ${fmtSigned(realizedPnl)}.`, realizedPnl >= 0 ? 'success' : 'info');
        return true;
    }

    submitBtn.addEventListener('click', () => {
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
            if (currentSide === 'buy') {
                const totalCost = qty * limitPrice * (1 + FEE_RATE);
                if (totalCost > cash + 1e-9) { showToast(`Not enough cash reserved for this limit order — need ${fmtUsd(totalCost)}.`, 'error'); return; }
            } else {
                const h = findHolding(symbol);
                if (!h || qty > h.qty + 1e-9) { showToast(`You only hold ${h ? fmtQty(h.qty) : '0'} ${symbol}.`, 'error'); return; }
            }
            pendingOrders.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), symbol, side: currentSide, qty, limitPrice });
            showToast(`Limit ${currentSide} order placed: ${fmtQty(qty)} ${symbol} @ ${fmtUsd(limitPrice, priceFmt(limitPrice))}.`, 'success');
            amountInput.value = '';
            persist(); renderAll(); maybeSnapshotEquity(true);
            return;
        }

        const { qty, price } = amountToQtyAndValue();
        if (!price) { showToast('Live price unavailable for that asset right now.', 'error'); return; }
        if (!qty || qty <= 0) { showToast('Enter a valid amount.', 'error'); return; }

        const ok = currentSide === 'buy' ? executeBuy(symbol, qty, price, 'market') : executeSell(symbol, qty, price, 'market');
        if (ok) {
            amountInput.value = '';
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
            const ok = o.side === 'buy' ? executeBuy(o.symbol, o.qty, o.limitPrice, 'limit') : executeSell(o.symbol, o.qty, o.limitPrice, 'limit');
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
        const realized = trades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
        const fees = trades.reduce((sum, t) => sum + (t.fee || 0), 0);
        const equity = cash + holdingsValue;
        const totalPnl = equity - totalDeposited;
        const sells = trades.filter(t => t.side === 'sell');
        const wins = sells.filter(t => (t.realizedPnl || 0) > 0).length;
        const winRate = sells.length ? (wins / sells.length) * 100 : null;
        return { holdingsValue, unrealized, realized, fees, equity, totalPnl, totalTrades: trades.length, winRate };
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
            return `
                <tr class="hover:bg-gray-800/40 transition-colors">
                    <td class="py-2 px-3 font-bold text-white">${escapeHtml(h.symbol)}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${fmtQty(h.qty)}</td>
                    <td class="py-2 px-3 text-right text-gray-400">${fmtUsd(h.avgCost, priceFmt(h.avgCost))}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${price ? fmtUsd(price, priceFmt(price)) : '<span class="text-gray-600">--</span>'}</td>
                    <td class="py-2 px-3 text-right text-gray-200">${fmtUsd(value)}</td>
                    <td class="py-2 px-3 text-right text-gray-500">${alloc.toFixed(1)}%</td>
                    <td class="py-2 px-3 text-right ${pnlColorClass(pnl)}">${fmtSigned(pnl)}<br><span class="text-[10px]">${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</span></td>
                    <td class="py-2 px-3 text-center"><button class="quick-sell-btn text-[10px] px-2 py-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-[#ff4d6a] hover:border-[#ff4d6a]/40 cursor-pointer" data-symbol="${escapeHtml(h.symbol)}">Sell</button></td>
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
                    <td class="py-2 px-3 text-center"><button class="cancel-order-btn text-gray-500 hover:text-[#ff4d6a] cursor-pointer" data-id="${o.id}">✕</button></td>
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
            const sideColor = t.side === 'buy' ? 'text-[#14d38a] bg-[#14d38a]/10 border-[#14d38a]/30' : 'text-[#ff4d6a] bg-[#ff4d6a]/10 border-[#ff4d6a]/30';
            return `
                <tr class="hover:bg-gray-800/40 transition-colors">
                    <td class="py-2 px-3 text-gray-500">${new Date(t.ts).toLocaleString()}</td>
                    <td class="py-2 px-3 font-bold text-white">${escapeHtml(t.symbol)}</td>
                    <td class="py-2 px-3"><span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${sideColor}">${t.side}</span></td>
                    <td class="py-2 px-3 text-gray-500 uppercase text-[10px]">${t.type}</td>
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
        renderOrders();
        renderTrades();
        renderOrderTicketPrice();
        renderAvailableHint();
        renderOrderSummary();
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

    // ---------- Reset / add funds ----------
    const resetModal = document.getElementById('reset-modal');
    document.getElementById('reset-account-btn').addEventListener('click', () => resetModal.classList.add('cw-visible'));
    document.getElementById('reset-modal-close').addEventListener('click', () => resetModal.classList.remove('cw-visible'));
    document.getElementById('reset-modal-cancel').addEventListener('click', () => resetModal.classList.remove('cw-visible'));
    document.getElementById('reset-modal-confirm').addEventListener('click', () => {
        cash = STARTING_BALANCE;
        totalDeposited = STARTING_BALANCE;
        holdings = []; trades = []; pendingOrders = [];
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
    document.getElementById('trades-csv-btn').addEventListener('click', () => {
        if (trades.length === 0) { showToast('No trades to export.', 'error'); return; }
        const lines = [['Time', 'Asset', 'Side', 'Type', 'Qty', 'Price', 'Value', 'Fee', 'RealizedPnL'].join(',')];
        trades.forEach(t => {
            lines.push([new Date(t.ts).toISOString(), t.symbol, t.side, t.type, t.qty, t.price, t.value.toFixed(2), t.fee.toFixed(2), t.realizedPnl === null ? '' : t.realizedPnl.toFixed(2)].join(','));
        });
        downloadCSV(lines.join('\n'), `paper_trades_${Date.now()}.csv`);
    });

    // ---------- Boot ----------
    document.getElementById('footer-year').innerText = new Date().getFullYear();
    setSide('buy');
    setType('market');
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
        setInterval(refreshNeededPrices, PRICE_POLL_MS);
    })();
})();
