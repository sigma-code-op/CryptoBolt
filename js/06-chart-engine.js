// ---------- TradingView Lightweight Charts setup, RSI/MACD sub-panels, order book + trades streams. ----------
    function applyLiveCandle(liveCandle) {
        if (!candlestickSeries || !volumeSeries) return;
        candlestickSeries.update(liveCandle);
        if (lineSeries) lineSeries.update({ time: liveCandle.time, value: liveCandle.close });
        volumeSeries.update({
            time: liveCandle.time, value: liveCandle.volume,
            color: liveCandle.close >= liveCandle.open ? 'rgba(20, 211, 138, 0.2)' : 'rgba(255, 77, 106, 0.2)'
        });

        const matchIndex = cachedCandlesArray.findIndex(c => c.time === liveCandle.time);
        if (matchIndex !== -1) {
            cachedCandlesArray[matchIndex] = liveCandle;
        } else {
            cachedCandlesArray.push(liveCandle);
            if (cachedCandlesArray.length > 400) cachedCandlesArray.shift();
        }

        // Recompute the (cheap, <=400 candle) Heikin Ashi series so the current bar reflects the
        // live update; historical HA bars are deterministic from raw OHLC so recompute is safe.
        haCandlesArray = computeHeikinAshiSeries(cachedCandlesArray);
        if (currentChartType === 'heikinashi' && candlestickSeries && haCandlesArray.length) {
            candlestickSeries.update(haCandlesArray[haCandlesArray.length - 1]);
        }

        updateIndicatorsData();
        updateLegendText(liveCandle);
    }

    // ---------- REST polling fallback ----------
    // Some networks/browsers silently block persistent WebSocket connections while ordinary
    // HTTPS requests go through fine — the page loads once and then just never updates, which
    // looks identical to "the chart is frozen." Polling doesn't depend on a long-lived
    // connection at all, so it works even when WebSockets can't. It runs *in addition to* the
    // WebSocket paths above (harmless if both are active — poll updates are idempotent) and is
    // what actually guarantees the price keeps moving without a manual refresh.
    let chartPollTimer = null;
    let gridPollTimer = null;
    let bookPollTimer = null;
    let tradesPollTimer = null;

    function startChartPolling() {
        if (chartPollTimer) clearInterval(chartPollTimer);
        const myToken = chartRequestToken;
        chartPollTimer = setInterval(async () => {
            if (myToken !== chartRequestToken || !selectedAsset) { clearInterval(chartPollTimer); return; }
            try {
                const endpoint = selectedAsset.isFutures
                    ? `https://fapi.binance.com/fapi/v1/klines?symbol=${selectedAsset.symbol}&interval=${currentInterval}&limit=2`
                    : `https://api.binance.com/api/v3/klines?symbol=${selectedAsset.symbol}&interval=${currentInterval}&limit=2`;
                const res = await fetchWithTimeout(endpoint, 8000);
                if (myToken !== chartRequestToken || !res.ok) return;
                const data = await res.json();
                if (myToken !== chartRequestToken || !Array.isArray(data) || data.length === 0) return;
                const d = data[data.length - 1];
                applyLiveCandle({
                    time: Math.floor(d[0] / 1000),
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4]),
                    volume: parseFloat(d[5])
                });
                touchWatchdog('chart');
                const feedDot = document.getElementById('chart-feed-dot');
                if (feedDot && feedDot.className.indexOf('status-live') === -1) feedDot.className = 'status-dot status-live';
            } catch (e) { /* transient network hiccup — next tick will retry */ }
        }, 4000);
    }

    async function refreshMarketSnapshots() {
        if (Object.keys(marketMap).length === 0) return;
        try {
            const [spotRaw, futuresRaw] = await Promise.all([fetchSpotSnapshot(), fetchFuturesSnapshot()]);
            const apply = (arr, isFutures) => {
                if (!Array.isArray(arr)) return;
                arr.filter(item => item && typeof item.symbol === 'string' && item.symbol.endsWith('USDT')).forEach(item => {
                    const idKey = `${item.symbol.toUpperCase()}_${isFutures ? 'F' : 'S'}`;
                    const asset = marketMap[idKey];
                    if (!asset) return;
                    const oldPrice = asset.price;
                    asset.price = parseFloat(item.lastPrice) || asset.price;
                    asset.changePct = parseFloat(item.priceChangePercent) || asset.changePct;
                    asset.high = parseFloat(item.highPrice) || asset.high;
                    asset.low = parseFloat(item.lowPrice) || asset.low;
                    asset.volume = parseFloat(item.quoteVolume) || asset.volume;
                    updateDOMRowRealtime(asset, oldPrice);
                    if (selectedAsset && selectedAsset.id === idKey) updateHUDDisplayValues(asset);
                    checkPriceAlerts(asset);
                });
            };
            apply(spotRaw, false);
            apply(futuresRaw, true);
        } catch (e) { /* transient — next tick will retry */ }
    }

    function startBookAndTradesPolling() {
        if (bookPollTimer) clearInterval(bookPollTimer);
        if (tradesPollTimer) clearInterval(tradesPollTimer);
        const myAssetId = selectedAsset ? selectedAsset.id : null;
        if (!myAssetId) return;

        bookPollTimer = setInterval(async () => {
            if (!selectedAsset || selectedAsset.id !== myAssetId) { clearInterval(bookPollTimer); return; }
            try {
                const endpoint = selectedAsset.isFutures
                    ? `https://fapi.binance.com/fapi/v1/depth?symbol=${selectedAsset.symbol}&limit=10`
                    : `https://api.binance.com/api/v3/depth?symbol=${selectedAsset.symbol}&limit=10`;
                const res = await fetchWithTimeout(endpoint, 8000);
                if (!res.ok || !selectedAsset || selectedAsset.id !== myAssetId) return;
                const data = await res.json();
                if (!selectedAsset || selectedAsset.id !== myAssetId) return;
                renderOrderBook(data.bids || [], data.asks || []);
                touchWatchdog('depth');
                const dot = document.getElementById('depth-status');
                if (dot && dot.className.indexOf('status-live') === -1) dot.className = 'status-dot status-live';
            } catch (e) { /* ignore, retry next tick */ }
        }, 3000);

        tradesPollTimer = setInterval(async () => {
            if (!selectedAsset || selectedAsset.id !== myAssetId) { clearInterval(tradesPollTimer); return; }
            try {
                const endpoint = selectedAsset.isFutures
                    ? `https://fapi.binance.com/fapi/v1/trades?symbol=${selectedAsset.symbol}&limit=5`
                    : `https://api.binance.com/api/v3/trades?symbol=${selectedAsset.symbol}&limit=5`;
                const res = await fetchWithTimeout(endpoint, 8000);
                if (!res.ok || !selectedAsset || selectedAsset.id !== myAssetId) return;
                const data = await res.json();
                if (!Array.isArray(data) || !selectedAsset || selectedAsset.id !== myAssetId) return;
                data.forEach(t => renderTrade({ p: t.price, q: t.qty, m: t.isBuyerMaker, T: t.time }));
                touchWatchdog('trades');
                const dot = document.getElementById('trades-status');
                if (dot && dot.className.indexOf('status-live') === -1) dot.className = 'status-dot status-live';
            } catch (e) { /* ignore, retry next tick */ }
        }, 5000);
    }

    setInterval(refreshMarketSnapshots, 10000);


    async function initializeAssetChartEngine() {
        if (!selectedAsset) return;
        const myToken = ++chartRequestToken;
        if (chartReconnectTimeout) clearTimeout(chartReconnectTimeout);
        if (chartSocket) { chartSocket.onclose = null; try { chartSocket.close(); } catch (e) {} chartSocket = null; }
        if (compareSocket) { compareSocket.onclose = null; try { compareSocket.close(); } catch (e) {} compareSocket = null; }
        compareSeries = null; compareCandles = []; compareSymbol = null;
        const compareClearBtn = document.getElementById('compare-clear-btn');
        if (compareClearBtn) compareClearBtn.classList.add('hidden');

        document.getElementById('chart-title').innerText = `${selectedAsset.baseAsset}/USDT`;
        document.getElementById('chart-ticker-sym').innerText = `Matrix engine tracking: ${selectedAsset.symbol} (${currentInterval})`;
        document.getElementById('legend-sym').innerText = selectedAsset.symbol;

        const restEndpoint = selectedAsset.isFutures
            ? `https://fapi.binance.com/fapi/v1/klines?symbol=${selectedAsset.symbol}&interval=${currentInterval}&limit=300`
            : `https://api.binance.com/api/v3/klines?symbol=${selectedAsset.symbol}&interval=${currentInterval}&limit=300`;

        try {
            container.innerHTML = `<div class="flex flex-col items-center gap-2 text-gray-500 text-xs"><div class="animate-spin rounded-full h-5 w-5 border-b-2 border-[#14d38a]"></div>Loading ${selectedAsset.symbol} ${selectedAsset.isFutures ? 'futures' : 'spot'} candles...</div>`;

            const res = await fetchWithTimeout(restEndpoint, 12000);
            if (myToken !== chartRequestToken) return; // a newer selection superseded this request

            if (!res.ok) throw new Error(`Kline API responded with status ${res.status}`);
            const data = await res.json();
            if (myToken !== chartRequestToken) return;

            if (data && !Array.isArray(data) && data.code) {
                throw new Error(`Kline API error ${data.code}: ${data.msg || 'unknown error'}`);
            }
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No candle data returned for this symbol/interval.');
            }

            cachedCandlesArray = data.map(d => ({
                time: Math.floor(d[0] / 1000),
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5])
            }));
            haCandlesArray = computeHeikinAshiSeries(cachedCandlesArray);

            if (chartInstance) {
                if (resizeObserver) resizeObserver.disconnect();
                chartInstance.remove();
                chartInstance = null;
            }
            if (rsiChartInstance) { rsiChartInstance.remove(); rsiChartInstance = null; }
            if (macdChartInstance) { macdChartInstance.remove(); macdChartInstance = null; }

            container.innerHTML = '';
            ohlvLegend.classList.remove('hidden');

            chartInstance = LightweightCharts.createChart(container, {
                layout: { background: { color: '#12141c' }, textColor: '#848e9c', fontSize: 11, fontFamily: 'monospace' },
                grid: { vertLines: { color: '#2b2f3a' }, horzLines: { color: '#2b2f3a' } },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                    vertLine: { labelBackgroundColor: '#474d57', color: '#5e6673', style: 3 },
                    horzLine: { labelBackgroundColor: '#474d57', color: '#5e6673', style: 3 },
                },
                rightPriceScale: { borderColor: '#2b2f3a', autoScale: true, mode: isLogScale ? LightweightCharts.PriceScaleMode.Logarithmic : LightweightCharts.PriceScaleMode.Normal },
                leftPriceScale: { borderColor: '#2b2f3a', visible: false },
                timeScale: { borderColor: '#2b2f3a', timeVisible: true },
                watermark: { visible: true, text: selectedAsset.symbol, fontSize: 42, color: 'rgba(255,255,255,0.045)', horzAlign: 'center', vertAlign: 'center' },
            });

            candlestickSeries = chartInstance.addCandlestickSeries({
                upColor: '#14d38a', downColor: '#ff4d6a', borderVisible: false,
                wickUpColor: '#14d38a', wickDownColor: '#ff4d6a',
                visible: currentChartType === 'candles' || currentChartType === 'heikinashi'
            });
            candlestickSeries.setData(currentChartType === 'heikinashi' ? haCandlesArray : cachedCandlesArray);

            lineSeries = chartInstance.addLineSeries({
                color: '#14d38a', lineWidth: 2, priceLineVisible: false, crosshairMarkerVisible: true,
                visible: currentChartType === 'line'
            });
            lineSeries.setData(cachedCandlesArray.map(c => ({ time: c.time, value: c.close })));

            // Tech Overlays Integration Pipeline
            // lastValueVisible:false — without it, every active overlay stamps its own
            // colored "last value" badge on the right price axis (in addition to its
            // line on the chart). With several overlays on at once these badges stack
            // up and collide with each other and with the axis's own price ticks —
            // the "labels overlapping the price scale" glitch. The line + the toolbar
            // pill already identify each overlay, so the axis badge is redundant.
            ma7Series = chartInstance.addLineSeries({ color: '#e5b324', lineWidth: 1.5, title: 'MA(7)', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            ma25Series = chartInstance.addLineSeries({ color: '#24a0e5', lineWidth: 1.5, title: 'MA(25)', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            ema12Series = chartInstance.addLineSeries({ color: '#ec4899', lineWidth: 1.5, title: 'EMA(12)', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            ema26Series = chartInstance.addLineSeries({ color: '#22d3ee', lineWidth: 1.5, title: 'EMA(26)', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            vwapSeries = chartInstance.addLineSeries({ color: '#fbbf24', lineWidth: 1.5, lineStyle: 2, title: 'VWAP', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            
            bbUpperSeries = chartInstance.addLineSeries({ color: 'rgba(168, 85, 247, 0.6)', lineWidth: 1, title: 'BB Upper', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            bbBasisSeries = chartInstance.addLineSeries({ color: 'rgba(168, 85, 247, 0.3)', lineWidth: 1, lineStyle: 2, title: 'BB Basis', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            bbLowerSeries = chartInstance.addLineSeries({ color: 'rgba(168, 85, 247, 0.6)', lineWidth: 1, title: 'BB Lower', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

            volumeSeries = chartInstance.addHistogramSeries({ 
                priceFormat: { type: 'volume' }, 
                priceScaleId: 'left', 
                priceLineVisible: false 
            });
            chartInstance.priceScale('left').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
            
            volumeSeries.setData(cachedCandlesArray.map(c => ({
                time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(20, 211, 138, 0.2)' : 'rgba(255, 77, 106, 0.2)'
            })));

            setupRSIPanel();
            setupMACDPanel();
            setupATRPanel();
            setupStochPanel();
            updateIndicatorsData();
            updateChartOverlayLines();

            updateLegendText(cachedCandlesArray[cachedCandlesArray.length - 1]);

            chartInstance.subscribeCrosshairMove(param => {
                if (!param || !param.time || param.point === undefined) {
                    if (cachedCandlesArray.length) updateLegendText(cachedCandlesArray[cachedCandlesArray.length - 1]);
                    return;
                }
                const candle = param.seriesData.get(currentChartType === 'candles' ? candlestickSeries : lineSeries);
                const vol = param.seriesData.get(volumeSeries);
                if (candle && candle.open !== undefined) {
                    updateLegendText({ open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: vol ? vol.value : 0 });
                } else if (candle && candle.value !== undefined) {
                    updateLegendText({ open: candle.value, high: candle.value, low: candle.value, close: candle.value, volume: vol ? vol.value : 0 });
                }
            });

            chartInstance.timeScale().fitContent();

            chartInstance.timeScale().subscribeVisibleLogicalRangeChange(range => {
                if (syncingRange || !range) return;
                syncingRange = true;
                if (rsiChartInstance) rsiChartInstance.timeScale().setVisibleLogicalRange(range);
                if (macdChartInstance) macdChartInstance.timeScale().setVisibleLogicalRange(range);
                syncingRange = false;
            });
            
            resizeObserver = new ResizeObserver(entries => {
                if (chartInstance && entries[0].contentRect.width > 0) {
                    chartInstance.resize(entries[0].contentRect.width, 400);
                    if (rsiChartInstance) rsiChartInstance.resize(entries[0].contentRect.width, 110);
                    if (macdChartInstance) macdChartInstance.resize(entries[0].contentRect.width, 110);
                }
            });
            resizeObserver.observe(container);

            connectLiveChartWebSocket(selectedAsset.symbol, selectedAsset.isFutures);
            startChartPolling();

        } catch (err) {
            if (myToken !== chartRequestToken) return;
            console.error("Historical trace failure:", err);
            container.innerHTML = `<div class="flex flex-col items-center gap-2 text-center px-4"><span class="text-[#ff4d6a] text-xs font-bold">Could not load ${selectedAsset.isFutures ? 'futures' : 'spot'} chart for ${selectedAsset.symbol}</span><span class="text-gray-500 text-[10px]">${(err && err.message) ? err.message : 'Unknown error'} — retrying in 5s</span></div>`;
            chartReconnectTimeout = setTimeout(() => { if (myToken === chartRequestToken) initializeAssetChartEngine(); }, 5000);
        }
    }

    function setupRSIPanel() {
        const rsiPanel = document.getElementById('rsi-panel');
        const rsiWorkspace = document.getElementById('rsi-workspace');
        if (!activeIndicators.rsi) { rsiPanel.classList.add('hidden'); return; }
        rsiPanel.classList.remove('hidden');
        rsiWorkspace.innerHTML = '';

        rsiChartInstance = LightweightCharts.createChart(rsiWorkspace, {
            layout: { background: { color: '#12141c' }, textColor: '#848e9c', fontSize: 10, fontFamily: 'monospace' },
            grid: { vertLines: { color: '#2b2f3a' }, horzLines: { color: '#2b2f3a' } },
            rightPriceScale: { borderColor: '#2b2f3a' },
            timeScale: { borderColor: '#2b2f3a', visible: true, timeVisible: true },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        });

        rsiLineSeries = rsiChartInstance.addLineSeries({ color: '#a855f7', lineWidth: 1.5, priceLineVisible: false });
        rsiLineSeries.createPriceLine({ price: 70, color: '#ff4d6a', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'OB' });
        rsiLineSeries.createPriceLine({ price: 30, color: '#14d38a', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'OS' });

        rsiChartInstance.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (syncingRange || !chartInstance || !range) return;
            syncingRange = true;
            chartInstance.timeScale().setVisibleLogicalRange(range);
            syncingRange = false;
        });
    }

    function setupMACDPanel() {
        const macdPanel = document.getElementById('macd-panel');
        const macdWorkspace = document.getElementById('macd-workspace');
        if (!activeIndicators.macd) { macdPanel.classList.add('hidden'); return; }
        macdPanel.classList.remove('hidden');
        macdWorkspace.innerHTML = '';

        macdChartInstance = LightweightCharts.createChart(macdWorkspace, {
            layout: { background: { color: '#12141c' }, textColor: '#848e9c', fontSize: 10, fontFamily: 'monospace' },
            grid: { vertLines: { color: '#2b2f3a' }, horzLines: { color: '#2b2f3a' } },
            rightPriceScale: { borderColor: '#2b2f3a' },
            timeScale: { borderColor: '#2b2f3a', visible: true, timeVisible: true },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        });

        macdHistSeries = macdChartInstance.addHistogramSeries({ priceLineVisible: false });
        macdLineSeries = macdChartInstance.addLineSeries({ color: '#24a0e5', lineWidth: 1.5, priceLineVisible: false, crosshairMarkerVisible: false });
        macdSignalSeries = macdChartInstance.addLineSeries({ color: '#e5b324', lineWidth: 1.5, priceLineVisible: false, crosshairMarkerVisible: false });

        macdChartInstance.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (syncingRange || !chartInstance || !range) return;
            syncingRange = true;
            chartInstance.timeScale().setVisibleLogicalRange(range);
            syncingRange = false;
        });
    }

    function setupATRPanel() {
        const atrPanel = document.getElementById('atr-panel');
        const atrWorkspace = document.getElementById('atr-workspace');
        if (!activeIndicators.atr) { atrPanel.classList.add('hidden'); return; }
        atrPanel.classList.remove('hidden');
        atrWorkspace.innerHTML = '';

        atrChartInstance = LightweightCharts.createChart(atrWorkspace, {
            layout: { background: { color: '#12141c' }, textColor: '#848e9c', fontSize: 10, fontFamily: 'monospace' },
            grid: { vertLines: { color: '#2b2f3a' }, horzLines: { color: '#2b2f3a' } },
            rightPriceScale: { borderColor: '#2b2f3a' },
            timeScale: { borderColor: '#2b2f3a', visible: true, timeVisible: true },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        });

        atrLineSeries = atrChartInstance.addLineSeries({ color: '#fbbf24', lineWidth: 1.5, priceLineVisible: false });

        atrChartInstance.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (syncingRange || !chartInstance || !range) return;
            syncingRange = true;
            chartInstance.timeScale().setVisibleLogicalRange(range);
            syncingRange = false;
        });
    }

    function setupStochPanel() {
        const stochPanel = document.getElementById('stoch-panel');
        const stochWorkspace = document.getElementById('stoch-workspace');
        if (!activeIndicators.stoch) { stochPanel.classList.add('hidden'); return; }
        stochPanel.classList.remove('hidden');
        stochWorkspace.innerHTML = '';

        stochChartInstance = LightweightCharts.createChart(stochWorkspace, {
            layout: { background: { color: '#12141c' }, textColor: '#848e9c', fontSize: 10, fontFamily: 'monospace' },
            grid: { vertLines: { color: '#2b2f3a' }, horzLines: { color: '#2b2f3a' } },
            rightPriceScale: { borderColor: '#2b2f3a' },
            timeScale: { borderColor: '#2b2f3a', visible: true, timeVisible: true },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        });

        stochKSeries = stochChartInstance.addLineSeries({ color: '#22d3ee', lineWidth: 1.5, priceLineVisible: false });
        stochDSeries = stochChartInstance.addLineSeries({ color: '#ec4899', lineWidth: 1.5, priceLineVisible: false });
        stochKSeries.createPriceLine({ price: 80, color: '#ff4d6a', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'OB' });
        stochKSeries.createPriceLine({ price: 20, color: '#14d38a', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'OS' });

        stochChartInstance.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (syncingRange || !chartInstance || !range) return;
            syncingRange = true;
            chartInstance.timeScale().setVisibleLogicalRange(range);
            syncingRange = false;
        });
    }

    // ---------- On-chart overlay lines: support/resistance, active alerts, AI trade plan ----------
    // Drawn as native chart price lines (not a canvas overlay), so they scale/pan with the
    // chart for free. Redrawn on explicit triggers (asset change, toggle click, alert added/
    // removed, new AI insight) rather than on every live tick, to avoid needless churn.
    function clearOverlayPriceLines() {
        if (!candlestickSeries) return;
        overlayPriceLines.forEach(line => {
            try { candlestickSeries.removePriceLine(line); } catch (e) { /* series may have been torn down already */ }
        });
        overlayPriceLines = [];
    }

    function updateChartOverlayLines() {
        if (!candlestickSeries || !selectedAsset || cachedCandlesArray.length < 20) return;
        clearOverlayPriceLines();

        const srOn = document.getElementById('toggle-sr-lines-btn')?.classList.contains('active');
        const alertsOn = document.getElementById('toggle-alert-lines-btn')?.classList.contains('active');
        const planOn = document.getElementById('toggle-tradeplan-lines-btn')?.classList.contains('active');

        if (srOn) {
            const recent = cachedCandlesArray.slice(-60);
            const resistance = Math.max(...recent.map(c => c.high));
            const support = Math.min(...recent.map(c => c.low));
            overlayPriceLines.push(candlestickSeries.createPriceLine({
                price: resistance, color: '#ff4d6a', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'Resistance'
            }));
            overlayPriceLines.push(candlestickSeries.createPriceLine({
                price: support, color: '#14d38a', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'Support'
            }));
        }

        if (alertsOn) {
            const alerts = priceAlerts[selectedAsset.id] || [];
            alerts.forEach(a => {
                let price = null;
                if (a.direction === 'above' || a.direction === 'below') price = a.target;
                else if (a.direction === 'pct_up') price = a.basePrice * (1 + a.target / 100);
                else if (a.direction === 'pct_down') price = a.basePrice * (1 - a.target / 100);
                if (price === null) return;
                overlayPriceLines.push(candlestickSeries.createPriceLine({
                    price, color: '#e5b324', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: '🔔 Alert'
                }));
            });
        }

        if (planOn && lastRenderedInsight && lastRenderedInsight.ctx && selectedAsset.id === lastRenderedInsight.assetId) {
            const plan = computeTradePlan(lastRenderedInsight.ctx, lastRenderedInsight.parsed.trend);
            if (plan.bias !== 'no-clear-setup') {
                const entryMid = (plan.entryLow + plan.entryHigh) / 2;
                overlayPriceLines.push(candlestickSeries.createPriceLine({ price: entryMid, color: '#e5b324', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '🎯 Entry' }));
                overlayPriceLines.push(candlestickSeries.createPriceLine({ price: plan.invalidation, color: '#ff4d6a', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '🚫 Invalidation' }));
                overlayPriceLines.push(candlestickSeries.createPriceLine({ price: plan.target, color: '#14d38a', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '🏁 Target' }));
            }
        }
    }

    function updateIndicatorsData() {
        if (!chartInstance) return;
        
        if (activeIndicators.ma7) ma7Series.setData(calculateSMA(cachedCandlesArray, 7));
        else ma7Series.setData([]);

        if (activeIndicators.ma25) ma25Series.setData(calculateSMA(cachedCandlesArray, 25));
        else ma25Series.setData([]);

        if (activeIndicators.ema12) ema12Series.setData(calculateEMA(cachedCandlesArray, 12));
        else ema12Series.setData([]);

        if (activeIndicators.ema26) ema26Series.setData(calculateEMA(cachedCandlesArray, 26));
        else ema26Series.setData([]);

        if (activeIndicators.vwap) vwapSeries.setData(calculateVWAP(cachedCandlesArray));
        else vwapSeries.setData([]);

        if (activeIndicators.bb) {
            const bb = calculateBollingerBands(cachedCandlesArray, 20, 2);
            bbUpperSeries.setData(bb.upper);
            bbBasisSeries.setData(bb.basis);
            bbLowerSeries.setData(bb.lower);
        } else {
            bbUpperSeries.setData([]);
            bbBasisSeries.setData([]);
            bbLowerSeries.setData([]);
        }

        if (activeIndicators.rsi && rsiLineSeries) {
            rsiLineSeries.setData(calculateRSI(cachedCandlesArray, 14));
        }

        if (activeIndicators.macd && macdLineSeries && cachedCandlesArray.length >= 35) {
            const macd = calculateMACD(cachedCandlesArray, 12, 26, 9);
            macdLineSeries.setData(macd.macdLine);
            macdSignalSeries.setData(macd.signalLine);
            macdHistSeries.setData(macd.histogram);
        }

        if (activeIndicators.atr && atrLineSeries) {
            atrLineSeries.setData(calculateATR(cachedCandlesArray, 14));
        }

        if (activeIndicators.stoch && stochKSeries && cachedCandlesArray.length >= 30) {
            const stoch = calculateStochRSI(cachedCandlesArray, 14, 14, 3, 3);
            stochKSeries.setData(stoch.k);
            stochDSeries.setData(stoch.d);
        }
    }

    let chartBackoff = 3000;

    function connectLiveChartWebSocket(symbol, isFutures) {
        const myToken = chartRequestToken;
        if (chartReconnectTimeout) clearTimeout(chartReconnectTimeout);
        const feedDot = document.getElementById('chart-feed-dot');
        if (feedDot) feedDot.className = 'status-dot status-connecting';

        const wsEndpoint = isFutures
            ? `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@kline_${currentInterval}`
            : `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${currentInterval}`;

        try {
            chartSocket = new WebSocket(wsEndpoint);
        } catch (e) {
            if (feedDot) feedDot.className = 'status-dot status-error';
            chartReconnectTimeout = setTimeout(() => { if (myToken === chartRequestToken) connectLiveChartWebSocket(symbol, isFutures); }, Math.min(chartBackoff *= 1.5, 20000));
            return;
        }

        chartSocket.onopen = () => {
            if (myToken !== chartRequestToken) return;
            resetWatchdog('chart');
            chartBackoff = 3000;
            if (feedDot) feedDot.className = 'status-dot status-live';
        };

        chartSocket.onmessage = (event) => {
            if (myToken !== chartRequestToken) return;
            touchWatchdog('chart');
            let msg;
            try { msg = JSON.parse(event.data); } catch (e) { return; }
            if (!msg || msg.e !== "kline" || !msg.k || msg.k.i !== currentInterval) return;
            
            const k = msg.k;
            applyLiveCandle({
                time: Math.floor(k.t / 1000),
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v)
            });
        };

        chartSocket.onerror = () => { try { chartSocket.close(); } catch (e) {} };
        chartSocket.onclose = () => {
            if (myToken !== chartRequestToken) return;
            if (feedDot) feedDot.className = 'status-dot status-error';
            chartReconnectTimeout = setTimeout(() => {
                if (myToken === chartRequestToken) connectLiveChartWebSocket(symbol, isFutures);
            }, Math.min(chartBackoff *= 1.5, 20000));
        };
    }

    function intervalToSeconds(interval) {
        const unit = interval.slice(-1);
        const num = parseInt(interval, 10) || 1;
        const mult = unit === 'm' ? 60 : unit === 'h' ? 3600 : unit === 'd' ? 86400 : unit === 'w' ? 604800 : 60;
        return num * mult;
    }

    function updateLegendText(candle) {
        if (!candle) return;
        const precision = candle.close < 1 ? 5 : 2;
        document.getElementById('leg-o').innerText = candle.open.toFixed(precision);
        document.getElementById('leg-h').innerText = candle.high.toFixed(precision);
        document.getElementById('leg-l').innerText = candle.low.toFixed(precision);
        document.getElementById('leg-c').innerText = candle.close.toFixed(precision);
        document.getElementById('leg-v').innerText = candle.volume > 1000000 ? (candle.volume / 1000000).toFixed(2) + 'M' : candle.volume.toLocaleString(undefined, { maximumFractionDigits: 0 });
        
        const colorClass = candle.close >= candle.open ? 'text-[#14d38a]' : 'text-[#ff4d6a]';
        ['leg-o', 'leg-h', 'leg-l', 'leg-c'].forEach(id => document.getElementById(id).className = colorClass);

        candleCloseTimestamp = candle.time + intervalToSeconds(currentInterval);
    }

    // ---------- Order book depth stream ----------
    function connectOrderBookStream() {
        if (depthReconnectTimeout) clearTimeout(depthReconnectTimeout);
        if (depthSocket) { depthSocket.onclose = null; try { depthSocket.close(); } catch (e) {} }
        if (!selectedAsset) return;

        const statusDot = document.getElementById('depth-status');
        statusDot.className = 'status-dot status-connecting';

        const endpoint = selectedAsset.isFutures
            ? `wss://fstream.binance.com/ws/${selectedAsset.symbol.toLowerCase()}@depth20@500ms`
            : `wss://stream.binance.com:9443/ws/${selectedAsset.symbol.toLowerCase()}@depth20@100ms`;

        const myAssetId = selectedAsset.id;
        try {
            depthSocket = new WebSocket(endpoint);
        } catch (e) {
            statusDot.className = 'status-dot status-error';
            return;
        }
        depthSocket.onopen = () => { if (selectedAsset && selectedAsset.id === myAssetId) { statusDot.className = 'status-dot status-live'; resetWatchdog('depth'); } };
        depthSocket.onmessage = (event) => {
            touchWatchdog('depth');
            if (!selectedAsset || selectedAsset.id !== myAssetId) return;
            let data;
            try { data = JSON.parse(event.data); } catch (e) { return; }
            const bids = data.bids || data.b || [];
            const asks = data.asks || data.a || [];
            renderOrderBook(bids, asks);
        };
        depthSocket.onerror = () => { try { depthSocket.close(); } catch (e) {} };
        depthSocket.onclose = () => {
            if (!selectedAsset || selectedAsset.id !== myAssetId) return;
            document.getElementById('depth-status').className = 'status-dot status-error';
            depthReconnectTimeout = setTimeout(() => { if (selectedAsset && selectedAsset.id === myAssetId) connectOrderBookStream(); }, 5000);
        };
    }

    function renderOrderBook(bids, asks) {
        const topBids = bids.slice(0, 10).map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
        const topAsks = asks.slice(0, 10).map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));
        const maxQty = Math.max(...topBids.map(b => b.qty), ...topAsks.map(a => a.qty), 0.0001);

        const precision = selectedAsset && selectedAsset.price < 1 ? 5 : 2;

        document.getElementById('book-bids').innerHTML = topBids.map(b => {
            const width = Math.min(100, (b.qty / maxQty) * 100);
            return `<div class="relative flex justify-between px-1 py-[1px] depth-bar-bid rounded-sm" style="background-size:${width}% 100%; background-repeat:no-repeat;">
                <span class="text-[#14d38a]">${b.price.toFixed(precision)}</span><span class="text-gray-400">${b.qty.toFixed(3)}</span>
            </div>`;
        }).join('') || '<p class="text-gray-600">--</p>';

        document.getElementById('book-asks').innerHTML = topAsks.map(a => {
            const width = Math.min(100, (a.qty / maxQty) * 100);
            return `<div class="relative flex justify-between px-1 py-[1px] depth-bar-ask rounded-sm" style="background-size:${width}% 100%; background-repeat:no-repeat; background-position:right;">
                <span class="text-gray-400">${a.qty.toFixed(3)}</span><span class="text-[#ff4d6a]">${a.price.toFixed(precision)}</span>
            </div>`;
        }).join('') || '<p class="text-gray-600">--</p>';
    }

    // ---------- Recent trades stream ----------
    function connectTradesStream() {
        if (tradesReconnectTimeout) clearTimeout(tradesReconnectTimeout);
        if (tradesSocket) { tradesSocket.onclose = null; try { tradesSocket.close(); } catch (e) {} }
        if (!selectedAsset) return;

        document.getElementById('trades-list').innerHTML = '';
        const statusDot = document.getElementById('trades-status');
        statusDot.className = 'status-dot status-connecting';

        const endpoint = selectedAsset.isFutures
            ? `wss://fstream.binance.com/ws/${selectedAsset.symbol.toLowerCase()}@trade`
            : `wss://stream.binance.com:9443/ws/${selectedAsset.symbol.toLowerCase()}@trade`;

        const myAssetId = selectedAsset.id;
        try {
            tradesSocket = new WebSocket(endpoint);
        } catch (e) {
            statusDot.className = 'status-dot status-error';
            return;
        }
        tradesSocket.onopen = () => { if (selectedAsset && selectedAsset.id === myAssetId) { statusDot.className = 'status-dot status-live'; resetWatchdog('trades'); } };
        tradesSocket.onmessage = (event) => {
            touchWatchdog('trades');
            if (!selectedAsset || selectedAsset.id !== myAssetId) return;
            let t;
            try { t = JSON.parse(event.data); } catch (e) { return; }
            renderTrade(t);
        };
        tradesSocket.onerror = () => { try { tradesSocket.close(); } catch (e) {} };
        tradesSocket.onclose = () => {
            if (!selectedAsset || selectedAsset.id !== myAssetId) return;
            document.getElementById('trades-status').className = 'status-dot status-error';
            tradesReconnectTimeout = setTimeout(() => { if (selectedAsset && selectedAsset.id === myAssetId) connectTradesStream(); }, 5000);
        };
    }

    function renderTrade(t) {
        const price = parseFloat(t.p);
        const qty = parseFloat(t.q);
        const isSell = t.m === true; // buyer is maker => taker sold into bid
        const time = new Date(t.T || t.E || Date.now());
        const timeStr = time.toLocaleTimeString(undefined, { hour12: false });
        const precision = price < 1 ? 5 : 2;

        const row = document.createElement('div');
        row.className = `flex justify-between ${isSell ? 'text-[#ff4d6a]' : 'text-[#14d38a]'}`;
        row.innerHTML = `<span>${price.toFixed(precision)}</span><span class="text-gray-400">${qty.toFixed(4)}</span><span class="text-gray-600">${timeStr}</span>`;

        const list = document.getElementById('trades-list');
        list.prepend(row);
        while (list.children.length > 40) list.removeChild(list.lastChild);
    }

    // ---------- Price alerts ----------
    let notificationPermissionRequested = false;