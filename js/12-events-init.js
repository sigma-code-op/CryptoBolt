// ---------- Keyboard shortcuts, fullscreen/log-scale/screenshot controls, filter/indicator buttons, and app bootstrap. ----------
    // ---------- Keyboard shortcuts ----------
    document.addEventListener('keydown', (e) => {
        const tag = (e.target.tagName || '').toLowerCase();
        const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';
        if (e.key === '/' && !isTyping) {
            e.preventDefault();
            searchInput.focus();
        } else if (e.key === 'Escape') {
            if (document.activeElement === searchInput) {
                searchInput.value = '';
                renderTableHTMLStructure();
                searchInput.blur();
            } else {
                document.activeElement && document.activeElement.blur && document.activeElement.blur();
            }
        }
    });

    // ---------- Share ----------
    // Uses the native Web Share API where available (mobile browsers, most desktop browsers
    // now too) so a person can share straight to Messages/Twitter/WhatsApp/etc. without leaving
    // the page. Falls back to copying the link — and if even Clipboard API is blocked, falls
    // back once more to a manual prompt() so sharing never just silently fails.
    document.getElementById('share-btn')?.addEventListener('click', async () => {
        const shareData = {
            title: 'CryptoBolt — Live Crypto Spot & Futures Terminal',
            text: 'Live Binance spot & futures data, pro charting, and AI market insight backed by live news & sentiment — free, no signup.',
            url: window.location.href
        };
        if (navigator.share) {
            try { await navigator.share(shareData); return; }
            catch (e) { if (e && e.name === 'AbortError') return; /* user cancelled, fall through otherwise */ }
        }
        try {
            await navigator.clipboard.writeText(shareData.url);
            showToast('Link copied to clipboard.', 'success');
        } catch (e) {
            window.prompt('Copy this link to share CryptoBolt:', shareData.url);
        }
    });

    // ---------- Fullscreen ----------
    document.getElementById('fullscreen-btn').addEventListener('click', () => {
        const card = document.getElementById('chart-card');
        if (!document.fullscreenElement) {
            card.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    });

    // ---------- Interactive Action Event Listeners ----------
    document.querySelectorAll('.tf-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.tf-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentInterval = e.target.getAttribute('data-tf');
            if (selectedAsset) localStorage.setItem('cw_last_selection', JSON.stringify({ id: selectedAsset.id, interval: currentInterval }));
            initializeAssetChartEngine();
        });
    });

    document.querySelectorAll('.ctype-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.ctype-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentChartType = e.target.getAttribute('data-ctype');
            if (candlestickSeries) {
                candlestickSeries.applyOptions({ visible: currentChartType === 'candles' || currentChartType === 'heikinashi' });
                candlestickSeries.setData(currentChartType === 'heikinashi' ? haCandlesArray : cachedCandlesArray);
            }
            if (lineSeries) lineSeries.applyOptions({ visible: currentChartType === 'line' });
        });
    });

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            renderTableHTMLStructure();
        });
    });

    document.querySelectorAll('.ind-btn').forEach(button => {
        // Synchronize initial state with visual markers
        const type = button.getAttribute('data-ind');
        if (activeIndicators[type]) button.classList.add('active');

        button.addEventListener('click', (e) => {
            const targetInd = e.target.getAttribute('data-ind');
            activeIndicators[targetInd] = !activeIndicators[targetInd];
            e.target.classList.toggle('active', activeIndicators[targetInd]);
            if (targetInd === 'rsi') {
                setupRSIPanel();
                if (resizeObserver && container) {
                    // trigger a resize pass so the RSI pane picks up the right width immediately
                    if (rsiChartInstance) rsiChartInstance.resize(container.clientWidth, 110);
                }
            }
            if (targetInd === 'macd') {
                setupMACDPanel();
                if (resizeObserver && container) {
                    if (macdChartInstance) macdChartInstance.resize(container.clientWidth, 110);
                }
            }
            if (targetInd === 'atr') {
                setupATRPanel();
                if (resizeObserver && container) {
                    if (atrChartInstance) atrChartInstance.resize(container.clientWidth, 90);
                }
            }
            if (targetInd === 'stoch') {
                setupStochPanel();
                if (resizeObserver && container) {
                    if (stochChartInstance) stochChartInstance.resize(container.clientWidth, 110);
                }
            }
            updateIndicatorsData();
        });
    });

    // ---------- On-chart overlay toggles (support/resistance, alerts, trade plan) ----------
    ['toggle-sr-lines-btn', 'toggle-alert-lines-btn', 'toggle-tradeplan-lines-btn'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            if (typeof updateChartOverlayLines === 'function') updateChartOverlayLines();
        });
    });

    // ---------- Log scale / reset zoom / screenshot ----------
    document.getElementById('logscale-toggle-btn').addEventListener('click', (e) => {
        isLogScale = !isLogScale;
        e.target.classList.toggle('active', isLogScale);
        if (chartInstance) {
            chartInstance.priceScale('right').applyOptions({
                mode: isLogScale ? LightweightCharts.PriceScaleMode.Logarithmic : LightweightCharts.PriceScaleMode.Normal
            });
        }
    });

    document.getElementById('reset-zoom-btn').addEventListener('click', () => {
        if (chartInstance) chartInstance.timeScale().fitContent();
    });

    document.getElementById('screenshot-btn').addEventListener('click', () => {
        if (!chartInstance) { showToast('Select an asset first.', 'error'); return; }
        try {
            const canvas = chartInstance.takeScreenshot();
            canvas.toBlob(blob => {
                if (!blob) { showToast('Could not generate screenshot.', 'error'); return; }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${selectedAsset ? selectedAsset.symbol : 'chart'}_${currentInterval}_${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                showToast('Chart image downloaded.', 'success');
            });
        } catch (e) {
            showToast('Screenshot failed in this browser.', 'error');
        }
    });

    searchInput.addEventListener('input', debounce(renderTableHTMLStructure, 150));

    // ---------- Offline / online detection ----------
    // When the connection drops, tell the person plainly instead of leaving them staring at
    // stalled prices with no explanation. When it comes back, immediately retry both sockets
    // rather than waiting out whatever backoff delay was in progress.
    (function setupOfflineBanner() {
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.className = 'cw-offline-banner';
        banner.textContent = "⚠ You're offline — live prices are paused. Reconnecting automatically once you're back.";
        document.body.prepend(banner);

        function updateBannerVisibility() {
            banner.classList.toggle('cw-visible', navigator.onLine === false);
        }
        window.addEventListener('offline', updateBannerVisibility);
        window.addEventListener('online', () => {
            updateBannerVisibility();
            showToast('Back online — reconnecting live data...', 'success');
            spotBackoff = 3000;
            futuresBackoff = 3000;
            connectSpotTicker();
            connectFuturesTicker();
        });
        updateBannerVisibility();
    })();

    // ---------- Global error safety net ----------
    // A single unexpected error anywhere in the app used to fail silently (or freeze a panel).
    // Surface it as a toast instead so the person knows something needs a refresh, without a
    // full-page crash.
    let lastErrorToastAt = 0;
    function reportUnexpectedError(err) {
        const now = Date.now();
        if (now - lastErrorToastAt < 4000) return; // avoid a toast storm from repeated errors
        lastErrorToastAt = now;
        console.error('[CryptoBolt] Unexpected error:', err);
        showToast('Something went wrong in one panel — try refreshing if it looks stuck.', 'error');
    }
    window.addEventListener('error', (e) => reportUnexpectedError(e.error || e.message));
    window.addEventListener('unhandledrejection', (e) => reportUnexpectedError(e.reason));

    // ---------- Keyboard shortcuts help modal (press "?") ----------
    (function setupShortcutsModal() {
        const backdrop = document.createElement('div');
        backdrop.id = 'shortcuts-modal';
        backdrop.className = 'cw-modal-backdrop';
        backdrop.innerHTML = `
            <div class="cw-modal-card" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-sm font-bold text-white">Keyboard shortcuts</h2>
                    <button id="shortcuts-close-btn" class="text-gray-500 hover:text-white cursor-pointer text-lg leading-none">✕</button>
                </div>
                <div class="space-y-2.5 text-[11px] text-gray-300">
                    <div class="flex items-center justify-between"><span>Quick jump to asset</span><span class="cw-kbd">Ctrl/⌘</span> <span class="cw-kbd">K</span></div>
                    <div class="flex items-center justify-between"><span>Focus search</span><span class="cw-kbd">/</span></div>
                    <div class="flex items-center justify-between"><span>Clear search / unfocus</span><span class="cw-kbd">Esc</span></div>
                    <div class="flex items-center justify-between"><span>Toggle this help</span><span class="cw-kbd">?</span></div>
                    <div class="flex items-center justify-between"><span>Fullscreen chart</span><span class="cw-kbd">F</span></div>
                </div>
                <p class="text-[9.5px] text-gray-600 mt-4">Shortcuts are disabled while typing in a text field.</p>
            </div>`;
        document.body.appendChild(backdrop);

        function toggleModal(show) {
            backdrop.classList.toggle('cw-visible', show);
        }
        document.getElementById('shortcuts-close-btn').addEventListener('click', () => toggleModal(false));
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) toggleModal(false); });

        document.addEventListener('keydown', (e) => {
            const tag = (e.target.tagName || '').toLowerCase();
            const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';
            if (e.key === '?' && !isTyping) {
                e.preventDefault();
                toggleModal(!backdrop.classList.contains('cw-visible'));
            } else if (e.key === 'Escape' && backdrop.classList.contains('cw-visible')) {
                toggleModal(false);
            } else if ((e.key === 'f' || e.key === 'F') && !isTyping) {
                document.getElementById('fullscreen-btn')?.click();
            }
        });
    })();

    // ---------- Footer wiring ----------
    (function setupFooter() {
        const yearEl = document.getElementById('footer-year');
        if (yearEl) yearEl.innerText = new Date().getFullYear();

        // Both the quick-jump and shortcuts-help modals listen for their real key combos on
        // `document` — dispatching a matching synthetic keydown re-uses that exact logic
        // instead of duplicating open/close state here.
        document.getElementById('footer-cmdk-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        });
        document.getElementById('footer-shortcuts-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
        });

        // Smooth-scroll same-page anchors (chart / heatmap quick links)
        document.querySelectorAll('footer a[href^="#"]').forEach(a => {
            a.addEventListener('click', (e) => {
                const id = a.getAttribute('href').slice(1);
                const target = id && document.getElementById(id);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    })();

    initMasterTerminalData();

    // ---------- Candle close countdown ----------
    // Purely a display convenience — ticks down to when the current interval's candle will
    // close, based on the timestamp already captured whenever the legend updates.
    setInterval(() => {
        const el = document.getElementById('leg-countdown');
        if (!el || !candleCloseTimestamp) return;
        const remaining = Math.max(0, candleCloseTimestamp - Math.floor(Date.now() / 1000));
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        el.innerText = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);

    // ---------- Feature: Command palette (Ctrl/Cmd+K quick jump) ----------
    // A faster way to jump straight to an asset than scrolling/filtering the table —
    // type a few letters, arrow through matches, hit Enter.
    (function setupCommandPalette() {
        const backdrop = document.createElement('div');
        backdrop.id = 'command-palette';
        backdrop.className = 'cw-modal-backdrop';
        backdrop.innerHTML = `
            <div class="cw-modal-card" style="max-width:480px;" role="dialog" aria-modal="true" aria-label="Quick jump to asset">
                <input id="cmdk-input" type="text" placeholder="Jump to an asset... (e.g. BTC, ETH, SOL)" autocomplete="off"
                    class="w-full bg-gray-900 border border-gray-800 rounded-lg text-sm px-3 py-2.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#14d38a]">
                <div id="cmdk-results" class="mt-3 max-h-[280px] overflow-y-auto space-y-1"></div>
                <p class="text-[9.5px] text-gray-600 mt-3">↑↓ to navigate · Enter to select · Esc to close</p>
            </div>`;
        document.body.appendChild(backdrop);

        const input = () => document.getElementById('cmdk-input');
        const resultsEl = () => document.getElementById('cmdk-results');
        let activeIndex = 0;
        let currentMatches = [];

        function open() {
            backdrop.classList.add('cw-visible');
            input().value = '';
            input().focus();
            renderMatches('');
        }
        function close() {
            backdrop.classList.remove('cw-visible');
        }

        function renderMatches(query) {
            const q = query.trim().toUpperCase();
            const all = Object.values(marketMap || {});
            currentMatches = (q
                ? all.filter(a => a.baseAsset.includes(q) || a.symbol.includes(q))
                : all.slice(0, 30)
            ).sort((a, b) => b.volume - a.volume).slice(0, 12);
            activeIndex = 0;

            if (currentMatches.length === 0) {
                resultsEl().innerHTML = '<p class="text-gray-600 text-[11px] px-2 py-3">No matching assets.</p>';
                return;
            }
            resultsEl().innerHTML = currentMatches.map((a, i) => `
                <div class="cmdk-row flex items-center justify-between px-2.5 py-2 rounded cursor-pointer ${i === 0 ? 'bg-gray-800' : ''}" data-index="${i}">
                    <span class="text-[12px] font-bold text-gray-200">${a.baseAsset}<span class="text-gray-600 font-normal">/USDT</span> ${a.isFutures ? '<span class=\'text-[9px] text-amber-400 border border-amber-500/30 rounded px-1 ml-1\'>FUT</span>' : ''}</span>
                    <span class="text-[11px] font-mono ${a.changePct >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}">$${a.price} (${a.changePct >= 0 ? '+' : ''}${a.changePct.toFixed(2)}%)</span>
                </div>
            `).join('');
            resultsEl().querySelectorAll('.cmdk-row').forEach(row => {
                row.addEventListener('click', () => selectMatch(parseInt(row.getAttribute('data-index'), 10)));
                row.addEventListener('mouseenter', () => highlightIndex(parseInt(row.getAttribute('data-index'), 10)));
            });
        }

        function highlightIndex(i) {
            activeIndex = i;
            resultsEl().querySelectorAll('.cmdk-row').forEach((row, idx) => row.classList.toggle('bg-gray-800', idx === activeIndex));
        }

        function selectMatch(i) {
            const asset = currentMatches[i];
            if (!asset) return;
            selectAsset(asset);
            renderTableHTMLStructure();
            close();
            showToast(`Jumped to ${asset.baseAsset}/USDT`, 'success');
        }

        input().addEventListener('input', (e) => renderMatches(e.target.value));
        input().addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); highlightIndex(Math.min(activeIndex + 1, currentMatches.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); highlightIndex(Math.max(activeIndex - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); selectMatch(activeIndex); }
            else if (e.key === 'Escape') { close(); }
        });
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

        document.addEventListener('keydown', (e) => {
            const isMeta = e.metaKey || e.ctrlKey;
            if (isMeta && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                backdrop.classList.contains('cw-visible') ? close() : open();
            }
        });
    })();

    // ---------- Feature: Accent color picker ----------
    // Recolors active toggle buttons, focus rings, and the live-connection glow via the
    // --cw-green CSS variable — a real, safe personalization option (not a reskin of every
    // hardcoded color in the app, which would risk breaking legibility elsewhere).
    (function setupAccentPicker() {
        const ACCENTS = {
            green: '#14d38a',
            cyan: '#4fd8e8',
            purple: '#a855f7',
            amber: '#ffb020'
        };
        function applyAccent(name) {
            document.documentElement.style.setProperty('--cw-green', ACCENTS[name] || ACCENTS.green);
            document.querySelectorAll('.accent-swatch').forEach(sw => {
                sw.classList.toggle('ring-2', sw.getAttribute('data-accent') === name);
                sw.classList.toggle('ring-white', sw.getAttribute('data-accent') === name);
            });
            localStorage.setItem('cw_accent', name);
        }
        document.querySelectorAll('.accent-swatch').forEach(sw => {
            sw.addEventListener('click', () => applyAccent(sw.getAttribute('data-accent')));
        });
        applyAccent(localStorage.getItem('cw_accent') || 'green');
    })();