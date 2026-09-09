// ---------- Market Screener & Strategy Backtester ----------
// Two features sharing one rule builder:
//   1. Live Scan  — runs a set of technical conditions against the current live market
//      (spot and/or futures) and returns every symbol matching all of them right now.
//   2. Backtest   — replays the same rule over historical candles for one symbol and reports
//      how it would have performed (win rate, avg return, an equity curve, and every signal).
//
// Deliberately self-contained and localStorage-only (no backend, no Supabase) — same
// philosophy as watchlist/alerts/paper trading: it works fully offline-of-any-backend and
// never blocks on a network service CryptoBolt doesn't control. It reuses, rather than
// duplicates, three things this file loads after: the indicator math in 05-indicators.js,
// the live market snapshot in globalMarketList/marketMap (01-state.js/02-api.js), and
// fetchWithTimeout for REST calls (02-api.js). Results feed straight back into the existing
// chart (selectAsset), watchlist (cw_watchlist), and price alerts (cw_alerts) — no new
// storage schema for those three.
(function () {
    'use strict';

    // ---------- Condition catalog ----------
    // Every condition type maps to one evaluator in evaluateCondition() below. `kind` decides
    // which input controls the row renders. Periods are capped at {20,50,100,200} so a single
    // fetch (210 candles) is always enough warm-up for every condition, live scan or backtest.
    const PERIODS = [20, 50, 100, 200];
    const CONDITION_DEFS = {
        rsi: { label: 'RSI (14)', kind: 'threshold', defaultOperator: 'below', defaultValue: 30, step: 1, suffix: '' },
        stoch_rsi: { label: 'Stoch RSI %K', kind: 'threshold', defaultOperator: 'below', defaultValue: 20, step: 1, suffix: '' },
        change24h: { label: '24h Change (live scan only)', kind: 'threshold', defaultOperator: 'above', defaultValue: 5, step: 0.5, suffix: '%' },
        volume24h: { label: '24h Quote Volume ≥ (live scan only)', kind: 'min_only', defaultValue: 5000000, step: 500000, suffix: '$' },
        atr_pct: { label: 'ATR Volatility', kind: 'threshold', defaultOperator: 'above', defaultValue: 3, step: 0.25, suffix: '%' },
        price_vs_ema: { label: 'Price vs EMA', kind: 'period_operator', defaultOperator: 'above', defaultPeriod: 50, periods: PERIODS },
        price_vs_sma: { label: 'Price vs SMA', kind: 'period_operator', defaultOperator: 'above', defaultPeriod: 200, periods: PERIODS },
        price_vs_vwap: { label: 'Price vs VWAP (window)', kind: 'operator_only', defaultOperator: 'above' },
        macd_cross: { label: 'MACD Cross', kind: 'direction_only', defaultDirection: 'bullish' },
        bb_position: { label: 'Bollinger Band (20, 2)', kind: 'bb_only', defaultPosition: 'below_lower' },
    };
    const INPUT_CLS = 'bg-gray-900 border border-gray-800 rounded text-[11px] px-1.5 py-1 text-gray-200 focus:outline-none focus:border-[#4fd8e8] font-mono cursor-pointer';
    const TAB_BASE = 'px-3 py-1 rounded cursor-pointer transition-all text-[11px] font-bold';
    const TAB_ACTIVE = TAB_BASE + ' bg-[#14d38a] text-[#0b0e11]';
    const TAB_INACTIVE = TAB_BASE + ' text-gray-400';

    // ---------- State ----------
    let screenerConditions = [
        { id: uid(), type: 'rsi', operator: 'below', value: 30 },
        { id: uid(), type: 'price_vs_ema', operator: 'above', period: 50 },
    ]; // starter rule so the modal isn't empty the first time it opens: "oversold, but still above the 50 EMA"
    let screenerRules = safeJSONParse(localStorage.getItem('cw_screener_rules'), []); // [{id, name, conditions}]
    let lastScanResults = [];
    let scanToken = 0;
    let backtestToken = 0;

    function uid() { return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }

    function defaultConditionForType(type) {
        const def = CONDITION_DEFS[type];
        return {
            id: uid(),
            type,
            operator: def.defaultOperator || 'above',
            value: def.defaultValue,
            period: def.defaultPeriod,
            direction: def.defaultDirection,
            position: def.defaultPosition,
        };
    }

    // ---------- Shared candle fetch (mirrors the endpoint pattern in 06-chart-engine.js) ----------
    async function fetchCandlesForAsset(asset, interval, limit) {
        const endpoint = asset.isFutures
            ? `https://fapi.binance.com/fapi/v1/klines?symbol=${asset.symbol}&interval=${interval}&limit=${limit}`
            : `https://api.binance.com/api/v3/klines?symbol=${asset.symbol}&interval=${interval}&limit=${limit}`;
        const res = await fetchWithTimeout(endpoint, 10000);
        if (!res.ok) throw new Error(`Kline fetch failed for ${asset.symbol} (HTTP ${res.status})`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error(`Unexpected kline payload for ${asset.symbol}`);
        return data.map(d => ({
            time: Math.floor(d[0] / 1000),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
        }));
    }

    // Runs `worker` over `items` with at most `limit` in flight at once. One symbol's failed
    // fetch (rate limit, delisted pair, timeout) never aborts the rest of the scan — the caller
    // is expected to catch inside `worker` itself; anything that escapes here is swallowed too.
    async function mapWithConcurrency(items, limit, worker, onProgress) {
        let nextIndex = 0, completed = 0;
        const total = items.length;
        async function runner() {
            while (nextIndex < total) {
                const i = nextIndex++;
                try { await worker(items[i], i); } catch (e) { /* individual failures are non-fatal */ }
                completed++;
                if (onProgress) onProgress(completed, total);
            }
        }
        const workers = Array.from({ length: Math.max(1, Math.min(limit, total)) }, runner);
        await Promise.all(workers);
    }

    // ---------- MACD cross detection ----------
    // Shared by both live scan (checks the last few candles, since a scan only runs at poll
    // time and shouldn't miss a cross that happened one candle ago) and backtest (checks the
    // exact candle, since a backtest walks every candle in order anyway).
    function macdCrossAt(macdLine, sigByTime, i) {
        if (i < 1) return { bullish: false, bearish: false };
        const curM = macdLine[i].value, curS = sigByTime.get(macdLine[i].time);
        const prevM = macdLine[i - 1].value, prevS = sigByTime.get(macdLine[i - 1].time);
        if (curS == null || prevS == null) return { bullish: false, bearish: false };
        return { bullish: prevM <= prevS && curM > curS, bearish: prevM >= prevS && curM < curS };
    }
    function detectRecentMacdCross(macd, lookback) {
        const sigByTime = new Map(macd.signalLine.map(p => [p.time, p.value]));
        const n = macd.macdLine.length;
        let bullish = false, bearish = false;
        for (let i = Math.max(1, n - lookback); i < n; i++) {
            const c = macdCrossAt(macd.macdLine, sigByTime, i);
            bullish = bullish || c.bullish; bearish = bearish || c.bearish;
        }
        return { bullish, bearish };
    }
    function detectAllMacdCrosses(macd) {
        const sigByTime = new Map(macd.signalLine.map(p => [p.time, p.value]));
        const map = new Map();
        for (let i = 1; i < macd.macdLine.length; i++) map.set(macd.macdLine[i].time, macdCrossAt(macd.macdLine, sigByTime, i));
        return map;
    }

    // ---------- Snapshot: latest indicator values, for live scan ----------
    function computeSnapshot(data, asset) {
        if (!data || data.length < 205) return null; // not enough candles to trust EMA(200)/SMA(200)
        const price = data[data.length - 1].close;
        const rsiSeries = calculateRSI(data, 14);
        const rsi14 = rsiSeries.length ? rsiSeries[rsiSeries.length - 1].value : null;
        const stoch = calculateStochRSI(data);
        const stochK = stoch.k.length ? stoch.k[stoch.k.length - 1].value : null;
        const macd = calculateMACD(data);
        const cross = detectRecentMacdCross(macd, 3);
        const bb = calculateBollingerBands(data, 20, 2);
        const bbUpper = bb.upper.length ? bb.upper[bb.upper.length - 1].value : null;
        const bbLower = bb.lower.length ? bb.lower[bb.lower.length - 1].value : null;
        const atr = calculateATR(data, 14);
        const atrLast = atr.length ? atr[atr.length - 1].value : null;
        const atrPct = atrLast != null ? (atrLast / price) * 100 : null;
        const vwapSeries = calculateVWAP(data);
        const vwapLast = vwapSeries.length ? vwapSeries[vwapSeries.length - 1].value : null;
        const ema = {}; PERIODS.forEach(p => { const s = calculateEMA(data, p); ema[p] = s.length ? s[s.length - 1].value : null; });
        const sma = {}; PERIODS.forEach(p => { const s = calculateSMA(data, p); sma[p] = s.length ? s[s.length - 1].value : null; });
        return {
            price, rsi14, stochK,
            macdCrossBullish: cross.bullish, macdCrossBearish: cross.bearish,
            bbUpper, bbLower, atrPct, vwap: vwapLast, ema, sma,
            changePct: asset.changePct, volume: asset.volume,
        };
    }

    // ---------- Indicator maps + point-in-time snapshot, for backtest ----------
    function buildIndicatorMaps(data) {
        const toMap = (arr) => { const m = new Map(); arr.forEach(p => m.set(p.time, p.value)); return m; };
        const macd = calculateMACD(data);
        const bb = calculateBollingerBands(data, 20, 2);
        const maps = {
            rsi14: toMap(calculateRSI(data, 14)),
            stochK: toMap(calculateStochRSI(data).k),
            macdCross: detectAllMacdCrosses(macd),
            bbUpper: toMap(bb.upper),
            bbLower: toMap(bb.lower),
            atr14: toMap(calculateATR(data, 14)),
            vwap: toMap(calculateVWAP(data)),
            ema: {}, sma: {},
        };
        PERIODS.forEach(p => { maps.ema[p] = toMap(calculateEMA(data, p)); maps.sma[p] = toMap(calculateSMA(data, p)); });
        return maps;
    }
    function snapshotAt(data, i, maps) {
        const t = data[i].time;
        const price = data[i].close;
        const atrLast = maps.atr14.has(t) ? maps.atr14.get(t) : null;
        const cross = maps.macdCross.get(t) || { bullish: false, bearish: false };
        const ema = {}; PERIODS.forEach(p => { ema[p] = maps.ema[p].has(t) ? maps.ema[p].get(t) : null; });
        const sma = {}; PERIODS.forEach(p => { sma[p] = maps.sma[p].has(t) ? maps.sma[p].get(t) : null; });
        return {
            price,
            rsi14: maps.rsi14.has(t) ? maps.rsi14.get(t) : null,
            stochK: maps.stochK.has(t) ? maps.stochK.get(t) : null,
            macdCrossBullish: cross.bullish, macdCrossBearish: cross.bearish,
            bbUpper: maps.bbUpper.has(t) ? maps.bbUpper.get(t) : null,
            bbLower: maps.bbLower.has(t) ? maps.bbLower.get(t) : null,
            atrPct: atrLast != null ? (atrLast / price) * 100 : null,
            vwap: maps.vwap.has(t) ? maps.vwap.get(t) : null,
            ema, sma,
            changePct: null, volume: null, // not knowable per-historical-candle — see evaluateCondition
        };
    }

    // ---------- Condition evaluation ----------
    // `context` is 'scan' or 'backtest'. change24h/volume24h are live-ticker-only concepts (a
    // rolling 24h window against the last snapshot) with no honest historical equivalent per
    // candle, so a backtest treats them as always-true (a no-op filter) rather than silently
    // returning zero signals — the UI warns about this once when a backtest run includes one.
    function evaluateCondition(cond, snap, context) {
        if (!snap) return false;
        switch (cond.type) {
            case 'rsi':
                if (snap.rsi14 == null) return false;
                return cond.operator === 'below' ? snap.rsi14 < cond.value : snap.rsi14 > cond.value;
            case 'stoch_rsi':
                if (snap.stochK == null) return false;
                return cond.operator === 'below' ? snap.stochK < cond.value : snap.stochK > cond.value;
            case 'change24h':
                if (context === 'backtest') return true;
                if (snap.changePct == null) return false;
                return cond.operator === 'above' ? snap.changePct > cond.value : snap.changePct < cond.value;
            case 'volume24h':
                if (context === 'backtest') return true;
                if (snap.volume == null) return false;
                return snap.volume >= cond.value;
            case 'atr_pct':
                if (snap.atrPct == null) return false;
                return cond.operator === 'above' ? snap.atrPct > cond.value : snap.atrPct < cond.value;
            case 'price_vs_ema': {
                const v = snap.ema ? snap.ema[cond.period] : null;
                if (v == null) return false;
                return cond.operator === 'above' ? snap.price > v : snap.price < v;
            }
            case 'price_vs_sma': {
                const v = snap.sma ? snap.sma[cond.period] : null;
                if (v == null) return false;
                return cond.operator === 'above' ? snap.price > v : snap.price < v;
            }
            case 'price_vs_vwap':
                if (snap.vwap == null) return false;
                return cond.operator === 'above' ? snap.price > snap.vwap : snap.price < snap.vwap;
            case 'macd_cross':
                return cond.direction === 'bullish' ? !!snap.macdCrossBullish : !!snap.macdCrossBearish;
            case 'bb_position':
                return cond.position === 'below_lower'
                    ? (snap.bbLower != null && snap.price <= snap.bbLower)
                    : (snap.bbUpper != null && snap.price >= snap.bbUpper);
            default:
                return false;
        }
    }

    // ---------- Rule builder UI ----------
    function conditionRowHtml(cond) {
        const def = CONDITION_DEFS[cond.type];
        const typeOptions = Object.keys(CONDITION_DEFS).map(k =>
            `<option value="${k}" ${k === cond.type ? 'selected' : ''}>${CONDITION_DEFS[k].label}</option>`
        ).join('');
        let fields = '';
        if (def.kind === 'threshold') {
            fields = `
                <select data-role="operator" class="${INPUT_CLS}">
                    <option value="below" ${cond.operator === 'below' ? 'selected' : ''}>below</option>
                    <option value="above" ${cond.operator === 'above' ? 'selected' : ''}>above</option>
                </select>
                <input data-role="value" type="number" step="${def.step}" value="${cond.value}" class="${INPUT_CLS} w-20">
                ${def.suffix ? `<span class="text-gray-600 text-[10px]">${def.suffix}</span>` : ''}`;
        } else if (def.kind === 'min_only') {
            fields = `<input data-role="value" type="number" step="${def.step}" value="${cond.value}" class="${INPUT_CLS} w-28">
                <span class="text-gray-600 text-[10px]">${def.suffix}</span>`;
        } else if (def.kind === 'period_operator') {
            fields = `
                <select data-role="period" class="${INPUT_CLS}">${def.periods.map(p => `<option value="${p}" ${Number(cond.period) === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
                <select data-role="operator" class="${INPUT_CLS}">
                    <option value="above" ${cond.operator === 'above' ? 'selected' : ''}>above</option>
                    <option value="below" ${cond.operator === 'below' ? 'selected' : ''}>below</option>
                </select>`;
        } else if (def.kind === 'operator_only') {
            fields = `
                <select data-role="operator" class="${INPUT_CLS}">
                    <option value="above" ${cond.operator === 'above' ? 'selected' : ''}>above</option>
                    <option value="below" ${cond.operator === 'below' ? 'selected' : ''}>below</option>
                </select>`;
        } else if (def.kind === 'direction_only') {
            fields = `
                <select data-role="direction" class="${INPUT_CLS}">
                    <option value="bullish" ${cond.direction === 'bullish' ? 'selected' : ''}>bullish ▲</option>
                    <option value="bearish" ${cond.direction === 'bearish' ? 'selected' : ''}>bearish ▼</option>
                </select>`;
        } else if (def.kind === 'bb_only') {
            fields = `
                <select data-role="position" class="${INPUT_CLS}">
                    <option value="below_lower" ${cond.position === 'below_lower' ? 'selected' : ''}>price below lower band</option>
                    <option value="above_upper" ${cond.position === 'above_upper' ? 'selected' : ''}>price above upper band</option>
                </select>`;
        }
        return `
            <div class="screener-cond-row flex flex-wrap items-center gap-1.5 bg-gray-900/60 border border-gray-800 rounded px-2 py-1.5" data-id="${cond.id}">
                <select data-role="type" class="${INPUT_CLS} font-bold text-gray-200">${typeOptions}</select>
                ${fields}
                <button data-role="remove" class="ml-auto text-gray-600 hover:text-[#ff4d6a] cursor-pointer text-xs px-1" aria-label="Remove condition">✕</button>
            </div>`;
    }

    function renderConditionBuilder() {
        const list = document.getElementById('screener-cond-list');
        if (!list) return;
        list.innerHTML = screenerConditions.length
            ? screenerConditions.map(conditionRowHtml).join('')
            : '<p class="text-gray-600 text-[10.5px]">No conditions yet — add one below. Every condition must match (AND).</p>';

        list.querySelectorAll('.screener-cond-row').forEach(rowEl => {
            const id = rowEl.getAttribute('data-id');
            const cond = screenerConditions.find(c => c.id === id);
            if (!cond) return;
            rowEl.querySelector('[data-role="type"]').addEventListener('change', (e) => {
                const idx = screenerConditions.findIndex(c => c.id === id);
                if (idx > -1) screenerConditions[idx] = defaultConditionForType(e.target.value);
                renderConditionBuilder();
            });
            const opSel = rowEl.querySelector('[data-role="operator"]');
            if (opSel) opSel.addEventListener('change', (e) => { cond.operator = e.target.value; });
            const perSel = rowEl.querySelector('[data-role="period"]');
            if (perSel) perSel.addEventListener('change', (e) => { cond.period = Number(e.target.value); });
            const dirSel = rowEl.querySelector('[data-role="direction"]');
            if (dirSel) dirSel.addEventListener('change', (e) => { cond.direction = e.target.value; });
            const posSel = rowEl.querySelector('[data-role="position"]');
            if (posSel) posSel.addEventListener('change', (e) => { cond.position = e.target.value; });
            const valInput = rowEl.querySelector('[data-role="value"]');
            if (valInput) valInput.addEventListener('input', (e) => { cond.value = parseFloat(e.target.value); });
            rowEl.querySelector('[data-role="remove"]').addEventListener('click', () => {
                screenerConditions = screenerConditions.filter(c => c.id !== id);
                renderConditionBuilder();
            });
        });
    }

    // ---------- Saved rules ----------
    function saveCurrentRule() {
        const nameInput = document.getElementById('screener-rule-name');
        const name = nameInput.value.trim();
        if (!name) { showToast('Give this rule a name first.', 'error'); return; }
        if (screenerConditions.length === 0) { showToast('Add at least one condition first.', 'error'); return; }
        screenerRules.push({ id: uid(), name, conditions: JSON.parse(JSON.stringify(screenerConditions)) });
        localStorage.setItem('cw_screener_rules', JSON.stringify(screenerRules));
        nameInput.value = '';
        renderSavedRules();
        showToast(`Saved rule "${name}".`, 'success');
    }
    function renderSavedRules() {
        const list = document.getElementById('screener-saved-rules');
        if (!list) return;
        list.innerHTML = screenerRules.length
            ? screenerRules.map(r => `
                <div class="flex items-center gap-1.5 bg-gray-900/60 border border-gray-800 rounded-full pl-3 pr-1.5 py-1 text-[10.5px]">
                    <button data-load="${r.id}" class="text-gray-300 hover:text-[#4fd8e8] cursor-pointer font-bold">${escapeHtml(r.name)}</button>
                    <span class="text-gray-700">(${r.conditions.length})</span>
                    <button data-del="${r.id}" class="text-gray-600 hover:text-[#ff4d6a] cursor-pointer px-1" aria-label="Delete rule">✕</button>
                </div>`).join('')
            : '<p class="text-gray-600 text-[10px]">No saved rules yet.</p>';

        list.querySelectorAll('[data-load]').forEach(btn => btn.addEventListener('click', () => {
            const rule = screenerRules.find(r => r.id === btn.getAttribute('data-load'));
            if (!rule) return;
            screenerConditions = JSON.parse(JSON.stringify(rule.conditions));
            renderConditionBuilder();
            showToast(`Loaded rule "${rule.name}".`, 'success');
        }));
        list.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-del');
            screenerRules = screenerRules.filter(r => r.id !== id);
            localStorage.setItem('cw_screener_rules', JSON.stringify(screenerRules));
            renderSavedRules();
        }));
    }

    // ---------- Result actions: reuse existing watchlist/alert/chart systems as-is ----------
    function addToWatchlistQuick(asset) {
        if (watchlist.includes(asset.id)) { showToast(`${asset.baseAsset} is already on your watchlist.`, 'info'); return; }
        watchlist.push(asset.id);
        localStorage.setItem('cw_watchlist', JSON.stringify(watchlist));
        if (currentFilter === 'watchlist' && typeof renderTableHTMLStructure === 'function') renderTableHTMLStructure();
        showToast(`Added ${asset.baseAsset} to your watchlist.`, 'success');
    }
    function quickAlertPct(asset, pct) {
        if (!priceAlerts[asset.id]) priceAlerts[asset.id] = [];
        priceAlerts[asset.id].push({ id: uid(), direction: 'pct_up', target: pct, triggered: false, basePrice: asset.price });
        localStorage.setItem('cw_alerts', JSON.stringify(priceAlerts));
        if (typeof requestNotificationPermission === 'function') requestNotificationPermission();
        if (selectedAsset && selectedAsset.id === asset.id && typeof renderAlertsList === 'function') renderAlertsList();
        showToast(`Alert set: ${asset.baseAsset} rises ${pct}% from $${asset.price.toLocaleString(undefined, priceFmt(asset.price))}.`, 'success');
    }

    // ---------- Live scan ----------
    function scanResultRowHtml(r) {
        const { asset, snap } = r;
        const chgColor = asset.changePct >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]';
        const rsiTxt = snap.rsi14 != null ? snap.rsi14.toFixed(1) : '--';
        return `
            <tr class="border-b border-gray-800/60 hover:bg-gray-900/40">
                <td class="py-1.5 px-2 font-bold text-gray-200 whitespace-nowrap">${escapeHtml(asset.baseAsset)}<span class="text-gray-600 font-normal">/USDT</span>${asset.isFutures ? ' <span class="text-[8.5px] text-amber-400 border border-amber-500/30 rounded px-1">FUT</span>' : ''}</td>
                <td class="py-1.5 px-2 font-mono text-gray-300 whitespace-nowrap">$${asset.price.toLocaleString(undefined, priceFmt(asset.price))}</td>
                <td class="py-1.5 px-2 font-mono whitespace-nowrap ${chgColor}">${asset.changePct >= 0 ? '+' : ''}${asset.changePct.toFixed(2)}%</td>
                <td class="py-1.5 px-2 font-mono text-gray-400">${rsiTxt}</td>
                <td class="py-1.5 px-2">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <button data-act="chart" data-id="${asset.id}" class="text-[10px] px-1.5 py-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-[#4fd8e8] hover:border-[#4fd8e8]/40 cursor-pointer">📈 Chart</button>
                        <button data-act="watch" data-id="${asset.id}" class="text-[10px] px-1.5 py-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-amber-400 hover:border-amber-400/40 cursor-pointer">★ Watch</button>
                        <button data-act="alert" data-id="${asset.id}" class="text-[10px] px-1.5 py-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-[#14d38a] hover:border-[#14d38a]/40 cursor-pointer">🔔 +3%</button>
                    </div>
                </td>
            </tr>`;
    }
    function renderScanResults(results) {
        const wrap = document.getElementById('screener-scan-results-wrap');
        const empty = document.getElementById('screener-scan-empty');
        const body = document.getElementById('screener-scan-results-body');
        if (!results.length) { wrap.classList.add('hidden'); empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');
        wrap.classList.remove('hidden');
        body.innerHTML = results.map(scanResultRowHtml).join('');
        body.querySelectorAll('button[data-act]').forEach(btn => {
            btn.addEventListener('click', () => {
                const asset = marketMap[btn.getAttribute('data-id')];
                if (!asset) return;
                const act = btn.getAttribute('data-act');
                if (act === 'chart') { selectAsset(asset); closeScreenerModal(); showToast(`Opened ${asset.baseAsset}/USDT on the chart.`, 'success'); }
                else if (act === 'watch') addToWatchlistQuick(asset);
                else if (act === 'alert') quickAlertPct(asset, 3);
            });
        });
    }

    async function runLiveScan() {
        if (screenerConditions.length === 0) { showToast('Add at least one condition first.', 'error'); return; }
        const marketType = document.getElementById('screener-scan-market').value;
        const interval = document.getElementById('screener-scan-interval').value;
        const universeSize = parseInt(document.getElementById('screener-scan-universe').value, 10) || 40;

        let universe = globalMarketList.filter(a => a.volume > 200000); // skip illiquid noise, mirrors 03-ui-table.js gainers/losers floor
        if (marketType === 'spot') universe = universe.filter(a => !a.isFutures);
        else if (marketType === 'futures') universe = universe.filter(a => a.isFutures);
        universe = universe.slice(0, universeSize); // globalMarketList is already sorted by volume desc

        if (universe.length === 0) { showToast('No assets match the selected market filter.', 'error'); return; }

        const runBtn = document.getElementById('screener-scan-run-btn');
        const progressTrack = document.getElementById('screener-scan-progress-track');
        const progressFill = document.getElementById('screener-scan-progress-fill');
        const progressText = document.getElementById('screener-scan-progress-text');
        runBtn.disabled = true; runBtn.innerText = 'Scanning…';
        progressTrack.classList.remove('hidden');
        progressFill.style.width = '0%';

        const myToken = ++scanToken;
        const results = [];
        try {
            await mapWithConcurrency(universe, 6, async (asset) => {
                if (myToken !== scanToken) return;
                const data = await fetchCandlesForAsset(asset, interval, 210);
                if (myToken !== scanToken) return;
                const snap = computeSnapshot(data, asset);
                if (snap && screenerConditions.every(c => evaluateCondition(c, snap, 'scan'))) results.push({ asset, snap });
            }, (done, total) => {
                if (myToken !== scanToken) return;
                progressFill.style.width = `${Math.round((done / total) * 100)}%`;
                progressText.innerText = `Scanning ${done}/${total}…`;
            });

            if (myToken !== scanToken) return; // a newer scan (or modal close) superseded this one
            lastScanResults = results.sort((a, b) => b.asset.volume - a.asset.volume);
            renderScanResults(lastScanResults);
            showToast(`Scan complete: ${results.length} match${results.length === 1 ? '' : 'es'} out of ${universe.length} scanned.`, results.length ? 'success' : 'info');
        } catch (err) {
            console.error('[CryptoBolt] Screener scan failed:', err);
            showToast('Scan failed — check your connection and try again.', 'error');
        } finally {
            if (myToken === scanToken) {
                runBtn.disabled = false; runBtn.innerText = '🔎 Run Live Scan';
                progressTrack.classList.add('hidden');
            }
        }
    }

    // ---------- Backtest ----------
    function simulateSignals(data, maps, conditions, holdPeriod, direction) {
        const signals = [];
        const warmup = 205; // EMA/SMA(200) need ~200 candles of runway before their first real value
        let i = warmup;
        while (i < data.length - 1) {
            const snap = snapshotAt(data, i, maps);
            const matched = snap && conditions.every(c => evaluateCondition(c, snap, 'backtest'));
            if (matched) {
                const entryIdx = i + 1; // enter at the NEXT candle's open — the signal itself is only known at candle i's close
                if (entryIdx >= data.length) break;
                const exitIdx = Math.min(entryIdx + holdPeriod, data.length - 1);
                const entryPrice = data[entryIdx].open;
                const exitPrice = data[exitIdx].close;
                const rawReturn = ((exitPrice - entryPrice) / entryPrice) * 100;
                signals.push({
                    entryTime: data[entryIdx].time, entryPrice,
                    exitTime: data[exitIdx].time, exitPrice,
                    returnPct: direction === 'short' ? -rawReturn : rawReturn,
                });
                i = exitIdx; // one open position at a time — don't stack a new signal inside a trade already in progress
            } else {
                i++;
            }
        }
        return signals;
    }
    function summarizeSignals(signals) {
        if (!signals.length) return null;
        const wins = signals.filter(s => s.returnPct > 0).length;
        const avgReturn = signals.reduce((s, x) => s + x.returnPct, 0) / signals.length;
        const best = Math.max(...signals.map(s => s.returnPct));
        const worst = Math.min(...signals.map(s => s.returnPct));
        let equity = 100;
        const curve = [equity];
        signals.forEach(s => { equity *= (1 + s.returnPct / 100); curve.push(equity); });
        return { count: signals.length, winRate: (wins / signals.length) * 100, avgReturn, best, worst, curve, finalEquity: equity };
    }
    function buildSparklineSVG(values) {
        const width = 600, height = 90;
        if (!values || values.length < 2) return '<p class="text-gray-600 text-[10px]">Not enough signals to draw a curve.</p>';
        const min = Math.min(...values), max = Math.max(...values);
        const range = (max - min) || 1;
        const stepX = width / (values.length - 1);
        const points = values.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(' ');
        const color = values[values.length - 1] >= values[0] ? '#14d38a' : '#ff4d6a';
        return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="w-full h-[90px]"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
    }
    function renderBacktestResults(summary, signals) {
        const box = document.getElementById('screener-backtest-results');
        if (!summary) {
            box.innerHTML = '<p class="text-gray-600 text-[11px] py-6 text-center">No historical signals matched this rule over the selected lookback window. Try a longer lookback, a higher timeframe, or fewer conditions.</p>';
            return;
        }
        const winColor = summary.winRate >= 50 ? 'text-[#14d38a]' : 'text-[#ff4d6a]';
        const avgColor = summary.avgReturn >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]';
        const stat = (label, value, color) => `<div class="bg-gray-900/60 border border-gray-800 rounded px-2.5 py-2"><div class="text-[9px] uppercase text-gray-500 font-bold">${label}</div><div class="font-mono text-sm font-bold ${color || 'text-white'}">${value}</div></div>`;
        box.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                ${stat('Signals', summary.count)}
                ${stat('Win Rate', summary.winRate.toFixed(1) + '%', winColor)}
                ${stat('Avg Return', (summary.avgReturn >= 0 ? '+' : '') + summary.avgReturn.toFixed(2) + '%', avgColor)}
                ${stat('Best', '+' + summary.best.toFixed(2) + '%', 'text-[#14d38a]')}
                ${stat('Worst', summary.worst.toFixed(2) + '%', 'text-[#ff4d6a]')}
            </div>
            <div class="bg-gray-900/60 border border-gray-800 rounded p-2 mb-3">
                <div class="text-[9px] uppercase text-gray-500 font-bold mb-1">Simulated equity (100 → ${summary.finalEquity.toFixed(1)}) — one position at a time, compounding, no fees/slippage modeled</div>
                ${buildSparklineSVG(summary.curve)}
            </div>
            <div class="max-h-[180px] overflow-y-auto">
                <table class="w-full text-[10.5px]">
                    <thead class="text-gray-500 uppercase text-[9px] sticky top-0 bg-[#181a20]"><tr><th class="text-left py-1 px-2">Entry Time</th><th class="text-left py-1 px-2">Entry</th><th class="text-left py-1 px-2">Exit</th><th class="text-right py-1 px-2">Return</th></tr></thead>
                    <tbody>
                        ${signals.slice().reverse().map(s => `
                            <tr class="border-t border-gray-800/60">
                                <td class="py-1 px-2 text-gray-400 whitespace-nowrap">${new Date(s.entryTime * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                <td class="py-1 px-2 font-mono text-gray-300">$${s.entryPrice.toLocaleString(undefined, priceFmt(s.entryPrice))}</td>
                                <td class="py-1 px-2 font-mono text-gray-300">$${s.exitPrice.toLocaleString(undefined, priceFmt(s.exitPrice))}</td>
                                <td class="py-1 px-2 font-mono text-right ${s.returnPct >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}">${s.returnPct >= 0 ? '+' : ''}${s.returnPct.toFixed(2)}%</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    }
    async function runBacktest() {
        if (screenerConditions.length === 0) { showToast('Add at least one condition first.', 'error'); return; }
        const symbolInput = document.getElementById('screener-bt-symbol').value.trim().toUpperCase().replace('USDT', '');
        if (!symbolInput) { showToast('Enter a symbol to backtest (e.g. BTC).', 'error'); return; }
        const marketType = document.getElementById('screener-bt-market').value;
        const asset = marketType === 'futures' ? marketMap[`${symbolInput}USDT_F`] : marketMap[`${symbolInput}USDT_S`];
        if (!asset) { showToast(`${symbolInput}/USDT not found in ${marketType === 'futures' ? 'futures' : 'spot'} listings.`, 'error'); return; }
        const interval = document.getElementById('screener-bt-interval').value;
        const lookback = Math.min(1000, parseInt(document.getElementById('screener-bt-lookback').value, 10) || 500);
        const holdPeriod = Math.max(1, Math.min(200, parseInt(document.getElementById('screener-bt-hold').value, 10) || 10));
        const direction = document.getElementById('screener-bt-direction').value;

        if (screenerConditions.some(c => c.type === 'change24h' || c.type === 'volume24h')) {
            showToast('24h Change / Volume conditions use live ticker data and are skipped during backtest.', 'info');
        }

        const runBtn = document.getElementById('screener-bt-run-btn');
        runBtn.disabled = true; runBtn.innerText = 'Running…';
        const myToken = ++backtestToken;
        try {
            const data = await fetchCandlesForAsset(asset, interval, lookback);
            if (myToken !== backtestToken) return;
            if (data.length < 220) { showToast('Not enough historical candles for this timeframe/lookback — try a larger lookback or a higher timeframe.', 'error'); return; }
            const maps = buildIndicatorMaps(data);
            const signals = simulateSignals(data, maps, screenerConditions, holdPeriod, direction);
            const summary = summarizeSignals(signals);
            renderBacktestResults(summary, signals);
            if (summary) showToast(`Backtest complete: ${summary.count} signal${summary.count === 1 ? '' : 's'} on ${asset.baseAsset}/USDT.`, 'success');
        } catch (err) {
            console.error('[CryptoBolt] Backtest failed:', err);
            showToast(`Backtest failed: ${err.message}`, 'error');
        } finally {
            if (myToken === backtestToken) { runBtn.disabled = false; runBtn.innerText = '⏱ Run Backtest'; }
        }
    }

    // ---------- Modal shell (built in JS and appended to <body>, same pattern 12-events-init.js
    // uses for the keyboard-shortcuts modal and command palette — keeps app.html's own markup
    // untouched aside from the one button that opens this). ----------
    function buildScreenerModal() {
        const backdrop = document.createElement('div');
        backdrop.id = 'screener-modal';
        backdrop.className = 'cw-modal-backdrop';
        backdrop.innerHTML = `
            <div class="cw-modal-card" style="max-width:920px;" role="dialog" aria-modal="true" aria-label="Market screener and backtester">
                <div class="flex items-center justify-between mb-3">
                    <div>
                        <h2 class="text-sm font-bold text-white flex items-center gap-2">🔎 Market Screener &amp; Backtester</h2>
                        <p class="text-[10.5px] text-gray-500 mt-0.5">Build a rule from live indicators, scan the whole market for it, or see how it would have performed historically.</p>
                    </div>
                    <button id="screener-close-btn" class="text-gray-500 hover:text-white cursor-pointer text-lg leading-none" aria-label="Close screener">✕</button>
                </div>

                <div class="bg-[#12141c] border border-gray-800 rounded-lg p-3 mb-3">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Rule (all conditions must match)</span>
                        <button id="screener-add-cond-btn" class="text-[10.5px] font-bold px-2 py-1 rounded bg-gray-900 border border-gray-800 text-[#14d38a] hover:border-[#14d38a]/50 cursor-pointer">+ Add condition</button>
                    </div>
                    <div id="screener-cond-list" class="space-y-1.5"></div>
                    <div class="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-gray-800">
                        <input id="screener-rule-name" type="text" maxlength="40" placeholder="Name this rule (e.g. Oversold Bounce)" class="${INPUT_CLS} flex-1 min-w-[160px]">
                        <button id="screener-save-rule-btn" class="text-[10.5px] font-bold px-2.5 py-1.5 rounded bg-gray-900 border border-gray-800 text-gray-300 hover:text-white cursor-pointer">💾 Save Rule</button>
                    </div>
                    <div id="screener-saved-rules" class="flex flex-wrap gap-1.5 mt-2"></div>
                </div>

                <div class="flex bg-gray-900 border border-gray-800 rounded p-0.5 text-[11px] font-bold w-fit mb-3">
                    <button id="screener-tab-scan" type="button" class="${TAB_ACTIVE}">Live Scan</button>
                    <button id="screener-tab-backtest" type="button" class="${TAB_INACTIVE}">Backtest</button>
                </div>

                <div id="screener-panel-scan">
                    <div class="flex flex-wrap items-end gap-2 mb-3">
                        <div>
                            <label class="block text-[9px] uppercase text-gray-500 font-bold mb-1">Market</label>
                            <select id="screener-scan-market" class="${INPUT_CLS}">
                                <option value="all">Spot + Futures</option>
                                <option value="spot">Spot only</option>
                                <option value="futures">Futures only</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[9px] uppercase text-gray-500 font-bold mb-1">Timeframe</label>
                            <select id="screener-scan-interval" class="${INPUT_CLS}">
                                <option value="15m">15m</option>
                                <option value="1h" selected>1H</option>
                                <option value="4h">4H</option>
                                <option value="1d">1D</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[9px] uppercase text-gray-500 font-bold mb-1">Scan top</label>
                            <select id="screener-scan-universe" class="${INPUT_CLS}">
                                <option value="20">20 by volume</option>
                                <option value="40" selected>40 by volume</option>
                                <option value="80">80 by volume</option>
                            </select>
                        </div>
                        <button id="screener-scan-run-btn" class="text-[11px] font-bold uppercase px-4 py-2 rounded bg-[#14d38a] text-[#0b0e11] hover:opacity-90 transition-all cursor-pointer">🔎 Run Live Scan</button>
                    </div>
                    <div id="screener-scan-progress-track" class="hidden h-1.5 bg-gray-900 rounded-full overflow-hidden mb-3">
                        <div id="screener-scan-progress-fill" class="h-full bg-[#14d38a] transition-all" style="width:0%"></div>
                    </div>
                    <p id="screener-scan-progress-text" class="text-[9.5px] text-gray-600 -mt-2 mb-2"></p>
                    <p id="screener-scan-empty" class="text-gray-600 text-[11px] py-6 text-center">Run a scan to see matching symbols here.</p>
                    <div id="screener-scan-results-wrap" class="hidden max-h-[280px] overflow-y-auto">
                        <table class="w-full text-[11px]">
                            <thead class="text-gray-500 uppercase text-[9px] sticky top-0 bg-[#181a20]"><tr><th class="text-left py-1.5 px-2">Asset</th><th class="text-left py-1.5 px-2">Price</th><th class="text-left py-1.5 px-2">24h</th><th class="text-left py-1.5 px-2">RSI</th><th class="text-left py-1.5 px-2">Actions</th></tr></thead>
                            <tbody id="screener-scan-results-body"></tbody>
                        </table>
                    </div>
                </div>

                <div id="screener-panel-backtest" class="hidden">
                    <div class="flex flex-wrap items-end gap-2 mb-3">
                        <div>
                            <label class="block text-[9px] uppercase text-gray-500 font-bold mb-1">Symbol</label>
                            <input id="screener-bt-symbol" list="screener-bt-symbol-list" type="text" placeholder="BTC" class="${INPUT_CLS} w-24">
                            <datalist id="screener-bt-symbol-list"></datalist>
                        </div>
                        <div>
                            <label class="block text-[9px] uppercase text-gray-500 font-bold mb-1">Market</label>
                            <select id="screener-bt-market" class="${INPUT_CLS}">
                                <option value="spot">Spot</option>
                                <option value="futures">Futures</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[9px] uppercase text-gray-500 font-bold mb-1">Timeframe</label>
                            <select id="screener-bt-interval" class="${INPUT_CLS}">
                                <option value="15m">15m</option>
                                <option value="1h" selected>1H</option>
                                <option value="4h">4H</option>
                                <option value="1d">1D</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[9px] uppercase text-gray-500 font-bold mb-1">Lookback (candles)</label>
                            <select id="screener-bt-lookback" class="${INPUT_CLS}">
                                <option value="300">300</option>
                                <option value="500" selected>500</option>
                                <option value="1000">1000 (max)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[9px] uppercase text-gray-500 font-bold mb-1">Hold (candles)</label>
                            <input id="screener-bt-hold" type="number" min="1" max="200" value="10" class="${INPUT_CLS} w-16">
                        </div>
                        <div>
                            <label class="block text-[9px] uppercase text-gray-500 font-bold mb-1">Direction</label>
                            <select id="screener-bt-direction" class="${INPUT_CLS}">
                                <option value="long">Long</option>
                                <option value="short">Short</option>
                            </select>
                        </div>
                        <button id="screener-bt-run-btn" class="text-[11px] font-bold uppercase px-4 py-2 rounded bg-[#14d38a] text-[#0b0e11] hover:opacity-90 transition-all cursor-pointer">⏱ Run Backtest</button>
                    </div>
                    <p class="text-[9.5px] text-gray-600 mb-3">Enters at the next candle's open after a signal, exits after the hold period. One simulated position at a time. No fees, slippage, or funding modeled — a research tool, not a promise of live results.</p>
                    <div id="screener-backtest-results">
                        <p class="text-gray-600 text-[11px] py-6 text-center">Run a backtest to see results here.</p>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(backdrop);

        // ---- static wiring (elements that exist once, not re-created on every render) ----
        document.getElementById('screener-close-btn').addEventListener('click', closeScreenerModal);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeScreenerModal(); });
        document.getElementById('screener-add-cond-btn').addEventListener('click', () => {
            screenerConditions.push(defaultConditionForType('rsi'));
            renderConditionBuilder();
        });
        document.getElementById('screener-save-rule-btn').addEventListener('click', saveCurrentRule);
        document.getElementById('screener-tab-scan').addEventListener('click', () => switchScreenerTab('scan'));
        document.getElementById('screener-tab-backtest').addEventListener('click', () => switchScreenerTab('backtest'));
        document.getElementById('screener-scan-run-btn').addEventListener('click', runLiveScan);
        document.getElementById('screener-bt-run-btn').addEventListener('click', runBacktest);

        return backdrop;
    }

    function switchScreenerTab(tab) {
        const isScan = tab === 'scan';
        document.getElementById('screener-tab-scan').className = isScan ? TAB_ACTIVE : TAB_INACTIVE;
        document.getElementById('screener-tab-backtest').className = isScan ? TAB_INACTIVE : TAB_ACTIVE;
        document.getElementById('screener-panel-scan').classList.toggle('hidden', !isScan);
        document.getElementById('screener-panel-backtest').classList.toggle('hidden', isScan);
    }

    function populateScreenerSymbolList() {
        const list = document.getElementById('screener-bt-symbol-list');
        if (!list) return;
        const bases = Array.from(new Set(globalMarketList.map(a => a.baseAsset))).sort();
        list.innerHTML = bases.map(b => `<option value="${b}"></option>`).join('');
    }

    let screenerModalEl = null;
    function openScreenerModal() {
        if (!screenerModalEl) screenerModalEl = buildScreenerModal();
        populateScreenerSymbolList();
        renderConditionBuilder();
        renderSavedRules();
        screenerModalEl.classList.add('cw-visible');
    }
    function closeScreenerModal() {
        if (screenerModalEl) screenerModalEl.classList.remove('cw-visible');
        scanToken++; backtestToken++; // cancel any in-flight scan/backtest so a late response can't render after close
    }

    document.getElementById('screener-open-btn')?.addEventListener('click', openScreenerModal);
    document.addEventListener('keydown', (e) => {
        if (screenerModalEl && screenerModalEl.classList.contains('cw-visible') && e.key === 'Escape') closeScreenerModal();
    });

    // Exposed for consistency with the app's other feature modules (window.cwAuth,
    // window.cwPaperTrading, etc.) — not currently called from elsewhere, but lets a future
    // page/link open the screener directly (e.g. `window.cwScreener.open()`).
    window.cwScreener = { open: openScreenerModal };
})();