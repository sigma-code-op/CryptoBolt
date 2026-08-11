// ---------- Spot/futures WebSocket ticker streams, reconnect scheduling, live row + HUD updates. ----------
    function connectGlobalPriceTickerStreams() {
        connectSpotTicker();
        connectFuturesTicker();
    }

    function connectSpotTicker() {
        if (spotTickerSocket) { spotTickerSocket.onclose = null; try { spotTickerSocket.close(); } catch (e) {} }
        setStatus('spot', 'connecting', 'Connecting');
        try {
            spotTickerSocket = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
        } catch (e) {
            setStatus('spot', 'error', 'Failed');
            scheduleSpotReconnect();
            return;
        }
        spotTickerSocket.onopen = () => { setStatus('spot', 'live', 'Live'); spotBackoff = 3000; resetWatchdog('spot'); };
        spotTickerSocket.onmessage = (event) => {
            touchWatchdog('spot');
            let data;
            try { data = JSON.parse(event.data); } catch (e) { return; }
            if (!Array.isArray(data)) return;
            data.forEach(tick => {
                const idKey = `${tick.s.toUpperCase()}_S`;
                if (marketMap[idKey]) {
                    const asset = marketMap[idKey];
                    const oldPrice = asset.price;
                    asset.price = parseFloat(tick.c);
                    asset.changePct = parseFloat(tick.P);
                    asset.high = parseFloat(tick.h);
                    asset.low = parseFloat(tick.l);
                    asset.volume = parseFloat(tick.q);
                    updateDOMRowRealtime(asset, oldPrice);
                    if (selectedAsset && selectedAsset.id === idKey) updateHUDDisplayValues(asset);
                    checkPriceAlerts(asset);
                    checkPositionRiskTriggers(asset);
                }
            });
        };
        spotTickerSocket.onerror = () => { try { spotTickerSocket.close(); } catch (e) {} };
        spotTickerSocket.onclose = () => { setStatus('spot', 'error', 'Reconnecting'); scheduleSpotReconnect(); };
    }

    function connectFuturesTicker() {
        if (futuresTickerSocket) { futuresTickerSocket.onclose = null; try { futuresTickerSocket.close(); } catch (e) {} }
        setStatus('futures', 'connecting', 'Connecting');
        try {
            futuresTickerSocket = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');
        } catch (e) {
            setStatus('futures', 'error', 'Failed');
            scheduleFuturesReconnect();
            return;
        }
        futuresTickerSocket.onopen = () => { setStatus('futures', 'live', 'Live'); futuresBackoff = 3000; resetWatchdog('futures'); };
        futuresTickerSocket.onmessage = (event) => {
            touchWatchdog('futures');
            let data;
            try { data = JSON.parse(event.data); } catch (e) { return; }
            if (!Array.isArray(data)) return;
            data.forEach(tick => {
                const idKey = `${tick.s.toUpperCase()}_F`; 
                if (marketMap[idKey]) {
                    const asset = marketMap[idKey];
                    const oldPrice = asset.price;
                    asset.price = parseFloat(tick.c);
                    asset.changePct = parseFloat(tick.P);
                    asset.high = parseFloat(tick.h);
                    asset.low = parseFloat(tick.l);
                    asset.volume = parseFloat(tick.q);
                    updateDOMRowRealtime(asset, oldPrice);
                    if (selectedAsset && selectedAsset.id === idKey) updateHUDDisplayValues(asset);
                    checkPriceAlerts(asset);
                    checkPositionRiskTriggers(asset);
                }
            });
        };
        futuresTickerSocket.onerror = () => { try { futuresTickerSocket.close(); } catch (e) {} };
        futuresTickerSocket.onclose = () => { setStatus('futures', 'error', 'Reconnecting'); scheduleFuturesReconnect(); };
    }

    // Adds up to ±20% random jitter to a backoff delay, so reconnect attempts across
    // browser tabs/users don't all land on Binance at the exact same moment.
    function withJitter(delayMs) {
        const jitter = delayMs * 0.2 * (Math.random() * 2 - 1);
        return Math.max(1000, Math.round(delayMs + jitter));
    }

    function scheduleSpotReconnect() {
        if (globalReconnectTimeout) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setStatus('spot', 'error', 'Offline');
            return; // resumed by the 'online' listener in js/12-events-init.js
        }
        globalReconnectTimeout = setTimeout(() => {
            globalReconnectTimeout = null;
            connectSpotTicker();
        }, withJitter(Math.min(spotBackoff *= 1.5, 30000)));
    }
    function scheduleFuturesReconnect() {
        if (futuresReconnectPending) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setStatus('futures', 'error', 'Offline');
            return; // resumed by the 'online' listener in js/12-events-init.js
        }
        futuresReconnectPending = true;
        setTimeout(() => {
            futuresReconnectPending = false;
            connectFuturesTicker();
        }, withJitter(Math.min(futuresBackoff *= 1.5, 30000)));
    }
    let futuresReconnectPending = false;

    function updateDOMRowRealtime(asset, oldPrice) {
        const row = document.getElementById(asset.domId);
        if (!row) return;

        const priceCell = row.querySelector('.price-cell');
        const changeCell = row.querySelector('.change-cell');
        const volumeCell = row.querySelector('.volume-cell');

        if (priceCell && changeCell) {
            priceCell.innerText = `$${asset.price.toLocaleString(undefined, priceFmt(asset.price))}`;
            changeCell.innerText = `${asset.changePct >= 0 ? '+' : ''}${asset.changePct.toFixed(2)}%`;
            changeCell.className = `py-3 px-4 text-right font-bold change-cell ${asset.changePct >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}`;
            if (volumeCell) volumeCell.innerText = `$${formatCompact(asset.volume)}`;

            if (asset.price > oldPrice) {
                priceCell.className = "py-3 px-3 text-right font-mono price-cell text-[#14d38a] flash-green";
                setTimeout(() => priceCell.className = "py-3 px-3 text-right font-mono price-cell text-gray-100", 400);
            } else if (asset.price < oldPrice) {
                priceCell.className = "py-3 px-3 text-right font-mono price-cell text-[#ff4d6a] flash-red";
                setTimeout(() => priceCell.className = "py-3 px-3 text-right font-mono price-cell text-gray-100", 400);
            }
        }

        if (!asset.isFutures && holdings.some(h => h.symbol === asset.baseAsset)) renderPortfolio();
        if (asset.isFutures && futuresPositions.some(p => p.symbol === asset.baseAsset)) renderFuturesPositions();
    }

    // ---------- Asset selection ----------
    function selectAsset(item) {
        selectedAsset = item;
        updateHUDDisplayValues(item);
        localStorage.setItem('cw_last_selection', JSON.stringify({ id: item.id, interval: currentInterval }));
        
        document.querySelectorAll('#crypto-rows tr').forEach(r => r.classList.remove('active-row'));
        const activeRow = document.getElementById(item.domId);
        if (activeRow) activeRow.classList.add('active-row');

        initializeAssetChartEngine();
        connectOrderBookStream();
        connectTradesStream();
        startBookAndTradesPolling();
        renderAlertsList();
        startFundingPolling();
        clearCompareOverlay(true);
        renderPopularCoinsStrip();
        resetAIInsightPanel();
        fetchLongTermPerformance(item);
        fetchMultiTimeframeTrend(item);
        renderNotesPanel();
        if (typeof syncRiskCalcForAsset === 'function') syncRiskCalcForAsset();
    }

    function updateHUDDisplayValues(item) {
        const precision = item.price < 1 ? 5 : 2;
        document.getElementById('hud-price').innerText = `$${item.price.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: 6 })}`;
        
        const changeEl = document.getElementById('hud-change');
        changeEl.innerText = `${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(2)}%`;
        changeEl.className = `text-sm font-mono font-bold ${item.changePct >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}`;

        document.getElementById('hud-high').innerText = `$${(item.high || 0).toLocaleString(undefined, priceFmt(item.high || 0))}`;
        document.getElementById('hud-low').innerText = `$${(item.low || 0).toLocaleString(undefined, priceFmt(item.low || 0))}`;
        document.getElementById('hud-volume').innerText = `$${formatCompact(item.volume)}`;

        const badge = document.getElementById('chart-market-badge');
        badge.innerText = item.isFutures ? 'Perpetual Futures' : 'Spot Cash';
        badge.className = item.isFutures ? 'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

        updateRangeBar(item);
    }

    // ---------- Indicator math ----------
