// ---------- Keyboard shortcuts, fullscreen/log-scale/screenshot controls, filter/indicator buttons, and app bootstrap. ----------
    // ---------- Keyboard shortcuts ----------
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.activeElement === searchInput) {
                searchInput.value = '';
                renderTableHTMLStructure();
                searchInput.blur();
            } else {
                document.activeElement && document.activeElement.blur && document.activeElement.blur();
            }
        }
    });

    // ---------- Fullscreen ----------
    document.getElementById('fullscreen-btn').addEventListener('click', () => {
        const card = document.getElementById('chart-card');
        // js/27-mobile-panels.js adds a CSS fullscreen fallback for browsers (iPhone Safari)
        // where Element.requestFullscreen() doesn't exist for non-video elements.
        if (typeof window.cwToggleChartFullscreen === 'function') { window.cwToggleChartFullscreen(); return; }
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

    // ---------- On-chart overlay toggles (support/resistance, alerts) ----------
    ['toggle-sr-lines-btn', 'toggle-alert-lines-btn'].forEach(id => {
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
        banner.innerHTML = '<i data-lucide="wifi-off" width="14" height="14" stroke-width="2.2" style="vertical-align:-2px;"></i> You\'re offline — live prices are paused. Reconnecting automatically once you\'re back.';
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

    // ---------- Footer wiring ----------
    (function setupFooter() {
        const yearEl = document.getElementById('footer-year');
        if (yearEl) yearEl.innerText = new Date().getFullYear();

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