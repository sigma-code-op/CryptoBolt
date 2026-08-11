// ---------- Market table rendering, CSV export, symbol datalists, popular-coin strip, watchlist toggling. ----------
    function renderTableHTMLStructure() {
        const term = searchInput.value.toUpperCase().trim();
        cryptoRows.innerHTML = '';

        let filtered = globalMarketList.filter(item => 
            item.symbol.includes(term) || item.baseAsset.includes(term)
        );

        if (currentFilter === 'spot') filtered = filtered.filter(item => !item.isFutures);
        if (currentFilter === 'futures') filtered = filtered.filter(item => item.isFutures);
        if (currentFilter === 'watchlist') filtered = filtered.filter(item => watchlist.includes(item.id));
        if (currentFilter === 'gainers') filtered = [...filtered].filter(i => i.volume > 500000).sort((a, b) => b.changePct - a.changePct);
        if (currentFilter === 'losers') filtered = [...filtered].filter(i => i.volume > 500000).sort((a, b) => a.changePct - b.changePct);

        filtered.slice(0, 100).forEach(item => {
            const row = document.createElement('tr');
            row.id = item.domId;
            row.className = `hover:bg-gray-800/40 transition-colors border-b border-gray-800/30 ${selectedAsset && selectedAsset.id === item.id ? 'active-row' : ''}`;
            
            const badgeColor = item.isFutures ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
            const isStarred = watchlist.includes(item.id);

            row.innerHTML = `
                <td class="py-3 px-4 text-center star-cell cursor-pointer text-sm select-none ${isStarred ? 'text-amber-400' : 'text-gray-600 hover:text-gray-400'}">
                    ${isStarred ? '★' : '☆'}
                </td>
                <td class="py-3 px-2 main-click-zone">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-white tracking-wide">${item.baseAsset}</span>
                        <span class="text-[9px] font-mono tracking-wider font-bold px-1.5 py-0.5 rounded uppercase ${badgeColor}">
                            ${item.isFutures ? 'Perp' : 'Spot'}
                        </span>
                    </div>
                </td>
                <td class="py-3 px-3 text-right text-gray-100 price-cell main-click-zone">$${item.price.toLocaleString(undefined, priceFmt(item.price))}</td>
                <td class="py-3 px-3 text-right text-gray-500 volume-cell main-click-zone hidden md:table-cell">$${formatCompact(item.volume)}</td>
                <td class="py-3 px-4 text-right font-bold change-cell main-click-zone ${item.changePct >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}">
                    ${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(2)}%
                </td>
            `;

            // Separate Watchlist click bounds from selection row mechanism
            row.querySelector('.star-cell').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleWatchlistAsset(item.id, e.target);
            });

            row.querySelectorAll('.main-click-zone').forEach(cell => {
                cell.addEventListener('click', () => selectAsset(item));
            });

            cryptoRows.appendChild(row);
        });

        if (filtered.length === 0) {
            cryptoRows.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-gray-600 text-[11px]">No assets match this filter.</td></tr>`;
        }

        renderMarketHeatmap();
    }

    // ---------- Market Heatmap ----------
    // A quick-scan color grid of 24h performance — deliberately simple tiles (not a
    // proportional treemap) so it stays fast and legible even with dozens of assets.
    let heatmapScope = 'volume';
    function heatmapColorFor(changePct) {
        const clamped = Math.max(-8, Math.min(8, changePct));
        if (clamped >= 0) {
            const alpha = 0.15 + (clamped / 8) * 0.55;
            return `rgba(20, 211, 138, ${alpha.toFixed(2)})`;
        }
        const alpha = 0.15 + (Math.abs(clamped) / 8) * 0.55;
        return `rgba(255, 77, 106, ${alpha.toFixed(2)})`;
    }

    function renderMarketHeatmap() {
        const container = document.getElementById('market-heatmap');
        if (!container) return;

        let pool = heatmapScope === 'watchlist'
            ? globalMarketList.filter(item => watchlist.includes(item.id))
            : [...globalMarketList].filter(i => i.volume > 500000);

        pool = [...pool].sort((a, b) => b.volume - a.volume).slice(0, 24);

        if (pool.length === 0) {
            container.innerHTML = heatmapScope === 'watchlist'
                ? '<p class="col-span-full text-gray-600 text-[10.5px] py-8 text-center">Star some assets in the table above to see them here.</p>'
                : '<p class="col-span-full text-gray-600 text-[10.5px] py-8 text-center">Waiting for market data...</p>';
            return;
        }

        container.innerHTML = pool.map(item => `
            <div class="heatmap-tile rounded px-1.5 py-2 cursor-pointer flex flex-col items-center justify-center gap-0.5 border border-white/5 hover:border-white/20 transition-all"
                 style="background-color:${heatmapColorFor(item.changePct)};" data-id="${item.id}" title="${item.baseAsset}/USDT — $${item.price.toLocaleString(undefined, priceFmt(item.price))}">
                <span class="text-[10px] font-bold text-white truncate max-w-full">${item.baseAsset}</span>
                <span class="text-[9px] font-mono ${item.changePct >= 0 ? 'text-emerald-200' : 'text-red-200'}">${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(1)}%</span>
            </div>
        `).join('');

        container.querySelectorAll('.heatmap-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                const asset = marketMap[tile.getAttribute('data-id')];
                if (asset) { selectAsset(asset); renderTableHTMLStructure(); }
            });
        });
    }

    document.querySelectorAll('.heatmap-scope-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            heatmapScope = btn.getAttribute('data-scope');
            document.querySelectorAll('.heatmap-scope-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMarketHeatmap();
        });
    });

    // ---------- CSV export ----------
    function exportVisibleRowsToCSV() {
        const term = searchInput.value.toUpperCase().trim();
        let filtered = globalMarketList.filter(item => item.symbol.includes(term) || item.baseAsset.includes(term));
        if (currentFilter === 'spot') filtered = filtered.filter(item => !item.isFutures);
        if (currentFilter === 'futures') filtered = filtered.filter(item => item.isFutures);
        if (currentFilter === 'watchlist') filtered = filtered.filter(item => watchlist.includes(item.id));
        if (currentFilter === 'gainers') filtered = [...filtered].filter(i => i.volume > 500000).sort((a, b) => b.changePct - a.changePct);
        if (currentFilter === 'losers') filtered = [...filtered].filter(i => i.volume > 500000).sort((a, b) => a.changePct - b.changePct);

        if (filtered.length === 0) { showToast('Nothing to export for this filter.', 'error'); return; }

        const header = ['Asset', 'Market', 'Symbol', 'Price', 'Volume(USDT)', '24hChange%', '24hHigh', '24hLow'];
        const lines = [header.join(',')];
        filtered.slice(0, 100).forEach(item => {
            lines.push([
                item.baseAsset, item.isFutures ? 'Futures' : 'Spot', item.symbol,
                item.price, item.volume.toFixed(2), item.changePct.toFixed(2), item.high, item.low
            ].join(','));
        });

        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cryptobolt_${currentFilter}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`Exported ${filtered.slice(0, 100).length} rows to CSV.`, 'success');
    }
    document.getElementById('export-csv-btn').addEventListener('click', exportVisibleRowsToCSV);

    // ---------- Symbol datalists (portfolio + compare autocomplete) ----------
    function populateSymbolDatalists() {
        const bases = Array.from(new Set(globalMarketList.filter(a => !a.isFutures).map(a => a.baseAsset))).sort();
        const futuresBases = Array.from(new Set(globalMarketList.filter(a => a.isFutures).map(a => a.baseAsset))).sort();
        const holdingList = document.getElementById('holding-symbol-list');
        const compareList = document.getElementById('compare-symbol-list');
        const futuresList = document.getElementById('futures-symbol-list');
        const optsHtml = bases.map(b => `<option value="${b}"></option>`).join('');
        if (holdingList) holdingList.innerHTML = optsHtml;
        if (compareList) compareList.innerHTML = optsHtml;
        if (futuresList) futuresList.innerHTML = futuresBases.map(b => `<option value="${b}"></option>`).join('');
    }

    // ---------- Popular coins quick-select ----------
    function renderPopularCoinsStrip() {
        const strip = document.getElementById('popular-coins-strip');
        if (!strip) return;
        const available = POPULAR_COINS.filter(base => marketMap[`${base}USDT_S`] || marketMap[`${base}USDT_F`]);
        strip.innerHTML = available.map(base => {
            const asset = marketMap[`${base}USDT_S`] || marketMap[`${base}USDT_F`];
            const isActive = selectedAsset && selectedAsset.baseAsset === base && !selectedAsset.isFutures === !!marketMap[`${base}USDT_S`];
            const up = asset.changePct >= 0;
            return `<button class="popular-coin-chip text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 ${isActive ? 'bg-[#14d38a] border-[#14d38a] text-[#0b0e11] font-bold' : 'bg-gray-900 border-gray-800/80 text-gray-300 hover:border-gray-600'}" data-base="${base}">
                <span>${base}</span><span class="${isActive ? '' : (up ? 'text-[#14d38a]' : 'text-[#ff4d6a]')} font-mono text-[10px]">${up ? '+' : ''}${asset.changePct.toFixed(1)}%</span>
            </button>`;
        }).join('');

        strip.querySelectorAll('.popular-coin-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const base = chip.getAttribute('data-base');
                const asset = marketMap[`${base}USDT_S`] || marketMap[`${base}USDT_F`];
                if (asset) {
                    selectAsset(asset);
                    searchInput.value = '';
                    renderTableHTMLStructure();
                }
            });
        });
    }

    function toggleWatchlistAsset(assetId, element) {
        const idx = watchlist.indexOf(assetId);
        if (idx > -1) {
            watchlist.splice(idx, 1);
            element.innerText = '☆';
            element.className = "py-3 px-4 text-center star-cell cursor-pointer text-sm select-none text-gray-600 hover:text-gray-400";
        } else {
            watchlist.push(assetId);
            element.innerText = '★';
            element.className = "py-3 px-4 text-center star-cell cursor-pointer text-sm select-none text-amber-400";
        }
        localStorage.setItem('cw_watchlist', JSON.stringify(watchlist));
        if (currentFilter === 'watchlist') renderTableHTMLStructure();
    }

    // ---------- Global ticker websocket streams (independent spot / futures) ----------
