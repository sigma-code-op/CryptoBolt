// ---------- 7D/30D performance stats, trade journal notes, funding-rate polling, 24h range bar. ----------
    function resetPerformanceBar() {
        document.getElementById('perf-7d').innerText = '--';
        document.getElementById('perf-7d').className = 'text-xs font-mono font-bold text-gray-400';
        document.getElementById('perf-30d').innerText = '--';
        document.getElementById('perf-30d').className = 'text-xs font-mono font-bold text-gray-400';
    }

    async function fetchLongTermPerformance(asset) {
        resetPerformanceBar();
        try {
            const endpoint = asset.isFutures
                ? `https://fapi.binance.com/fapi/v1/klines?symbol=${asset.symbol}&interval=1d&limit=31`
                : `https://api.binance.com/api/v3/klines?symbol=${asset.symbol}&interval=1d&limit=31`;
            const res = await fetchWithTimeout(endpoint, 10000);
            if (!res.ok || !selectedAsset || selectedAsset.id !== asset.id) return;
            const data = await res.json();
            if (!Array.isArray(data) || data.length < 2 || !selectedAsset || selectedAsset.id !== asset.id) return;

            const closes = data.map(d => parseFloat(d[4]));
            const latest = closes[closes.length - 1];

            const render = (elId, daysAgo) => {
                const idx = closes.length - 1 - daysAgo;
                const el = document.getElementById(elId);
                if (idx < 0) { el.innerText = 'n/a'; return; }
                const past = closes[idx];
                const pct = ((latest - past) / past) * 100;
                el.innerText = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
                el.className = `text-xs font-mono font-bold ${pct >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}`;
            };
            render('perf-7d', 7);
            render('perf-30d', 30);
        } catch (e) { /* leave as -- on failure */ }
    }

    // ---------- Asset notes / trade journal ----------
    function renderNotesPanel() {
        const label = document.getElementById('notes-asset-label');
        const textarea = document.getElementById('notes-textarea');
        const status = document.getElementById('notes-save-status');
        status.innerText = '';
        if (!selectedAsset) {
            label.innerText = '';
            textarea.value = '';
            textarea.disabled = true;
            return;
        }
        textarea.disabled = false;
        label.innerText = `— ${selectedAsset.baseAsset}/USDT`;
        textarea.value = assetNotes[selectedAsset.id] || '';
    }

    document.getElementById('notes-textarea').addEventListener('input', (e) => {
        if (!selectedAsset) return;
        const status = document.getElementById('notes-save-status');
        status.innerText = 'Saving...';
        if (notesSaveTimer) clearTimeout(notesSaveTimer);
        notesSaveTimer = setTimeout(() => {
            const text = e.target.value;
            if (text.trim()) assetNotes[selectedAsset.id] = text;
            else delete assetNotes[selectedAsset.id];
            localStorage.setItem('cw_notes', JSON.stringify(assetNotes));
            status.innerText = `Saved ${new Date().toLocaleTimeString(undefined, { hour12: false })}`;
        }, 600);
    });

    // ---------- Multi-timeframe trend confluence ----------
    // Answers "does the higher-timeframe picture agree with what I'm looking at right now?" —
    // fetches a handful of closes on three higher timeframes and reads direction off each via
    // a simple SMA(10) slope + net move check. Cheap (3 REST calls, ~30 candles each), only run
    // when an asset is selected, and cached for reuse by the AI Insight context builder so the
    // AI doesn't have to re-derive it from scratch.
    const MTF_TIMEFRAMES = ['1h', '4h', '1d'];

    function trendFromCloses(closes) {
        if (!closes || closes.length < 12) return { trend: 'neutral', pct: 0 };
        const sma = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
        const smaEarly = sma(closes.slice(0, 10));
        const smaLate = sma(closes.slice(-10));
        const pct = smaEarly ? ((smaLate - smaEarly) / smaEarly) * 100 : 0;
        let trend = 'neutral';
        if (pct > 0.3) trend = 'bullish';
        else if (pct < -0.3) trend = 'bearish';
        return { trend, pct };
    }

    async function fetchMultiTimeframeTrend(asset) {
        const badge = document.getElementById('mtf-badge');
        if (badge) badge.classList.add('hidden');
        try {
            const base = asset.isFutures ? 'https://fapi.binance.com/fapi/v1/klines' : 'https://api.binance.com/api/v3/klines';
            const results = await Promise.all(MTF_TIMEFRAMES.map(tf =>
                fetchWithTimeout(`${base}?symbol=${asset.symbol}&interval=${tf}&limit=30`, 8000)
                    .then(res => res.ok ? res.json() : null)
                    .catch(() => null)
            ));
            if (!selectedAsset || selectedAsset.id !== asset.id) return;

            const timeframes = MTF_TIMEFRAMES.map((tf, i) => {
                const data = results[i];
                if (!Array.isArray(data) || data.length < 12) return { tf, trend: 'unknown', pct: 0 };
                const closes = data.map(d => parseFloat(d[4]));
                return { tf, ...trendFromCloses(closes) };
            });

            mtfTrendCache = { assetId: asset.id, timeframes, fetchedAt: Date.now() };
            renderMTFBadge(timeframes);
        } catch (e) { /* badge just stays hidden — non-critical */ }
    }

    function renderMTFBadge(timeframes) {
        const badge = document.getElementById('mtf-badge');
        if (!badge) return;
        const known = timeframes.filter(t => t.trend !== 'unknown');
        if (known.length === 0) { badge.classList.add('hidden'); return; }
        const bullish = known.filter(t => t.trend === 'bullish').length;
        const bearish = known.filter(t => t.trend === 'bearish').length;
        let label, colorClass, icon;
        if (bullish >= 2 && bullish > bearish) { label = `MTF ${bullish}/${known.length} Bullish`; colorClass = 'text-[#14d38a] bg-[#14d38a]/10 border-[#14d38a]/30'; icon = '▲'; }
        else if (bearish >= 2 && bearish > bullish) { label = `MTF ${bearish}/${known.length} Bearish`; colorClass = 'text-[#ff4d6a] bg-[#ff4d6a]/10 border-[#ff4d6a]/30'; icon = '▼'; }
        else { label = 'MTF Mixed'; colorClass = 'text-gray-300 bg-gray-800 border-gray-700'; icon = '◆'; }
        const tooltip = timeframes.map(t => `${t.tf}: ${t.trend}${t.trend !== 'unknown' ? ` (${t.pct >= 0 ? '+' : ''}${t.pct.toFixed(2)}%)` : ''}`).join(' · ');
        badge.innerText = `${icon} ${label}`;
        badge.title = `Higher-timeframe agreement (1h/4h/1d): ${tooltip}`;
        badge.className = `text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${colorClass}`;
        badge.classList.remove('hidden');
    }


    function stopFundingPolling() {
        if (fundingPollTimer) { clearInterval(fundingPollTimer); fundingPollTimer = null; }
        lastFundingRatePct = null;
        lastFundingNextMins = null;
        document.getElementById('hud-funding-wrap').classList.add('hidden');
    }

    async function pollFundingRate() {
        if (!selectedAsset || !selectedAsset.isFutures) return;
        const mySymbol = selectedAsset.symbol;
        try {
            const res = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${mySymbol}`, 8000);
            if (!res.ok || !selectedAsset || selectedAsset.symbol !== mySymbol) return;
            const data = await res.json();
            if (!selectedAsset || selectedAsset.symbol !== mySymbol) return;
            const rate = parseFloat(data.lastFundingRate) * 100;
            const nextTime = parseInt(data.nextFundingTime, 10);
            const mins = Math.max(0, Math.round((nextTime - Date.now()) / 60000));
            lastFundingRatePct = rate;
            lastFundingNextMins = mins;
            const h = Math.floor(mins / 60), m = mins % 60;
            const el = document.getElementById('hud-funding');
            el.innerText = `${rate >= 0 ? '+' : ''}${rate.toFixed(4)}% / ${h}h ${m}m`;
            el.className = `text-sm font-mono font-bold ${rate >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}`;
            document.getElementById('hud-funding-wrap').classList.remove('hidden');
        } catch (e) { /* transient — next tick retries */ }
    }

    function startFundingPolling() {
        stopFundingPolling();
        if (!selectedAsset || !selectedAsset.isFutures) return;
        pollFundingRate();
        fundingPollTimer = setInterval(pollFundingRate, 30000);
    }

    // ---------- 24h range position bar ----------
    function updateRangeBar(item) {
        const low = item.low || 0, high = item.high || 0, price = item.price || 0;
        const precision = price < 1 ? 5 : 2;
        document.getElementById('range-low-label').innerText = `$${low.toLocaleString(undefined, priceFmt(low))}`;
        document.getElementById('range-high-label').innerText = `$${high.toLocaleString(undefined, priceFmt(high))}`;
        let pct = 50;
        if (high > low) pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
        document.getElementById('range-marker').style.left = `${pct}%`;
    }

