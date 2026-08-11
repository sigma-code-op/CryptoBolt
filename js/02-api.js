// ---------- REST calls: Binance snapshots, global market pulse (CoinGecko + Fear & Greed), trending coins. ----------
    async function fetchSpotSnapshot() {
        try {
            const res = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr');
            return await parseBinanceJSON(res, 'Spot');
        } catch (err) {
            console.warn('Spot 24hr ticker unavailable:', err.message);
            setStatus('spot', 'error', 'Unavailable');
            return null; // null = hard failure, distinct from [] = fetched but empty
        }
    }

    async function fetchFuturesSnapshot() {
        try {
            const res = await fetchWithTimeout('https://fapi.binance.com/fapi/v1/ticker/24hr');
            return await parseBinanceJSON(res, 'Futures');
        } catch (err) {
            console.warn('Futures 24hr ticker unavailable:', err.message);
            setStatus('futures', 'error', 'Unavailable');
            return null;
        }
    }

    async function initMasterTerminalData() {
        try {
            // Both legs run in parallel, but each is caught inside its own function above —
            // one rejecting never affects the other.
            const [spotRaw, futuresRaw] = await Promise.all([
                fetchSpotSnapshot(),
                fetchFuturesSnapshot()
            ]);

            if (spotRaw === null && futuresRaw === null) {
                throw new Error('Both spot and futures endpoints were unreachable.');
            }
            if (spotRaw === null) {
                showToast('Spot market data unavailable right now. Showing futures only.', 'error');
            }
            if (futuresRaw === null) {
                showToast('Futures market data unavailable right now. Spot data still live.', 'error');
            }

            marketMap = {};

            const processData = (arr, isFutures) => {
                if (!Array.isArray(arr)) return;
                arr.filter(item => item && typeof item.symbol === 'string' && item.symbol.endsWith('USDT')).forEach(item => {
                    const idKey = `${item.symbol.toUpperCase()}_${isFutures ? 'F' : 'S'}`;
                    marketMap[idKey] = {
                        id: idKey,
                        symbol: item.symbol.toUpperCase(),
                        baseAsset: item.symbol.toUpperCase().replace('USDT', ''),
                        price: parseFloat(item.lastPrice) || 0,
                        changePct: parseFloat(item.priceChangePercent) || 0,
                        high: parseFloat(item.highPrice) || 0,
                        low: parseFloat(item.lowPrice) || 0,
                        volume: parseFloat(item.quoteVolume) || 0,
                        isFutures: isFutures,
                        domId: `row_${idKey.replace(/[@#]/g, '_')}`
                    };
                });
            };

            if (spotRaw) processData(spotRaw, false);
            if (futuresRaw) processData(futuresRaw, true);

            if (Object.keys(marketMap).length === 0) {
                throw new Error('No market symbols were returned.');
            }

            refreshArrayDataList();
            renderTableHTMLStructure();
            updateMoverStrip();
            populateSymbolDatalists();
            renderPopularCoinsStrip();
            renderPortfolio();
            renderFuturesPositions();
            setInterval(updateMoverStrip, 15000);

            fetchGlobalMarketPulse();
            fetchTrendingCoins();
            setInterval(fetchGlobalMarketPulse, 60000);
            setInterval(fetchTrendingCoins, 120000);

            loading.classList.add('hidden');
            initError.classList.add('hidden');
            tableContainer.classList.remove('hidden');

            if (globalMarketList.length > 0 && !selectedAsset) {
                let defaultAsset = null;
                if (lastSelection && marketMap[lastSelection.id]) {
                    defaultAsset = marketMap[lastSelection.id];
                    if (lastSelection.interval) currentInterval = lastSelection.interval;
                    syncIntervalButtons();
                } else {
                    defaultAsset = globalMarketList.find(a => a.symbol === 'BTCUSDT' && !a.isFutures) || globalMarketList[0];
                }
                selectAsset(defaultAsset);
            }

            connectGlobalPriceTickerStreams();

        } catch (error) {
            console.error("Initialization pipeline failed, retrying in 5s...", error);
            loading.classList.add('hidden');
            initError.classList.remove('hidden');
            setStatus('spot', 'error', 'Retrying');
            setStatus('futures', 'error', 'Retrying');
            setTimeout(initMasterTerminalData, 5000);
        }
    }

    async function fetchWithTimeout(url, ms = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        // Binance's public REST endpoints allow direct browser calls (CORS-enabled) —
        // no proxy needed here. Only the AI insight endpoint goes through our own backend.
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

    async function parseBinanceJSON(res, label) {
        if (!res.ok) throw new Error(`${label} API responded with status ${res.status}`);
        const data = await res.json();
        if (data && !Array.isArray(data) && data.code) {
            throw new Error(`${label} API error ${data.code}: ${data.msg || 'unknown error'}`);
        }
        if (!Array.isArray(data)) throw new Error(`${label} API returned an unexpected payload.`);
        return data;
    }

    function syncIntervalButtons() {
        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tf') === currentInterval);
        });
    }

    function refreshArrayDataList() {
        globalMarketList = Object.values(marketMap).sort((a, b) => b.volume - a.volume);
    }

    // ---------- Global Market Pulse (CoinGecko + Alternative.me — independent of Binance) ----------
    async function fetchGlobalMarketPulse() {
        try {
            const res = await fetchWithTimeout('https://api.coingecko.com/api/v3/global', 10000);
            if (!res.ok) throw new Error(`CoinGecko global responded ${res.status}`);
            const json = await res.json();
            const d = json.data;
            if (!d) return;

            document.getElementById('pulse-mcap').innerText = `$${formatCompact(d.total_market_cap.usd)}`;
            document.getElementById('pulse-vol').innerText = `$${formatCompact(d.total_volume.usd)}`;
            document.getElementById('pulse-btcdom').innerText = `${d.market_cap_percentage.btc.toFixed(1)}%`;

            const chgEl = document.getElementById('pulse-mcap-chg');
            const chg = d.market_cap_change_percentage_24h_usd;
            if (typeof chg === 'number') {
                chgEl.innerText = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
                chgEl.className = `text-[10px] font-mono font-bold ml-1 ${chg >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}`;
            }
        } catch (e) {
            console.warn('Global market pulse unavailable:', e.message);
        }

        try {
            const res = await fetchWithTimeout('https://api.alternative.me/fng/?limit=1', 10000);
            if (!res.ok) throw new Error(`Fear & Greed API responded ${res.status}`);
            const json = await res.json();
            const entry = json.data && json.data[0];
            if (!entry) return;
            const val = parseInt(entry.value, 10);
            document.getElementById('pulse-fng-value').innerText = val;
            const labelEl = document.getElementById('pulse-fng-label');
            labelEl.innerText = entry.value_classification;
            const color = val <= 24 ? 'text-[#ff4d6a] border-[#ff4d6a]/40' : val <= 44 ? 'text-amber-400 border-amber-400/40' : val <= 55 ? 'text-gray-300 border-gray-600' : val <= 75 ? 'text-[#14d38a] border-[#14d38a]/40' : 'text-[#14d38a] border-[#14d38a]/60';
            labelEl.className = `text-[9px] font-bold uppercase px-2 py-1 rounded border ${color}`;
        } catch (e) {
            console.warn('Fear & Greed index unavailable:', e.message);
        }
    }

    async function fetchTrendingCoins() {
        const strip = document.getElementById('trending-coins-strip');
        try {
            const res = await fetchWithTimeout('https://api.coingecko.com/api/v3/search/trending', 10000);
            if (!res.ok) throw new Error(`Trending API responded ${res.status}`);
            const json = await res.json();
            const coins = (json.coins || []).slice(0, 7).map(c => c.item);
            if (coins.length === 0) { strip.innerHTML = '<span class="text-gray-600 text-[10px]">No trending data.</span>'; return; }

            strip.innerHTML = coins.map(c => {
                const sym = (c.symbol || '').toUpperCase();
                const tracked = !!(marketMap[`${sym}USDT_S`] || marketMap[`${sym}USDT_F`]);
                return `<button class="trending-chip text-[10px] px-2 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${tracked ? 'bg-gray-900 border-gray-800/80 text-gray-300 hover:border-[#14d38a]/50' : 'bg-gray-900/50 border-gray-800/40 text-gray-600 cursor-default'}" data-sym="${sym}" ${tracked ? '' : 'disabled'}>
                    #${c.market_cap_rank || '?'} <span class="font-bold">${sym}</span>
                </button>`;
            }).join('');

            strip.querySelectorAll('.trending-chip:not([disabled])').forEach(chip => {
                chip.addEventListener('click', () => {
                    const sym = chip.getAttribute('data-sym');
                    const asset = marketMap[`${sym}USDT_S`] || marketMap[`${sym}USDT_F`];
                    if (asset) { selectAsset(asset); searchInput.value = ''; renderTableHTMLStructure(); }
                });
            });
        } catch (e) {
            console.warn('Trending coins unavailable:', e.message);
            strip.innerHTML = '<span class="text-gray-600 text-[10px]">Unavailable right now.</span>';
        }
    }

    function updateMoverStrip() {
        if (globalMarketList.length === 0) return;
        const sorted = [...globalMarketList].filter(a => a.volume > 1000000).sort((a, b) => b.changePct - a.changePct);
        const gainers = sorted.slice(0, 6);
        const losers = sorted.slice(-6).reverse();
        const items = [...gainers, ...losers];
        const strip = document.getElementById('mover-strip');
        const buildChip = (item) => {
            const color = item.changePct >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]';
            const tag = item.isFutures ? 'Perp' : 'Spot';
            return `<span class="inline-flex items-center gap-1.5 px-4"><span class="text-gray-300 font-bold">${item.baseAsset}</span><span class="text-gray-600 text-[9px]">${tag}</span><span class="${color} font-bold">${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(2)}%</span></span>`;
        };
        const htmlChunk = items.map(buildChip).join('');
        strip.innerHTML = htmlChunk + htmlChunk; // duplicate for seamless marquee loop
        gridCount.innerText = `${globalMarketList.length} markets tracked`;
    }

