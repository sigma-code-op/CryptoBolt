// ---------- Alert sound toggle and the two-asset chart comparison overlay. ----------
    function playAlertBeep() {
        if (!soundEnabled) return;
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } catch (e) { /* audio unsupported/blocked — silent no-op */ }
    }

    function syncSoundButton() {
        const btn = document.getElementById('sound-toggle-btn');
        if (btn) btn.innerText = soundEnabled ? '🔊' : '🔇';
    }
    syncSoundButton();
    document.getElementById('sound-toggle-btn').addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('cw_sound_enabled', JSON.stringify(soundEnabled));
        syncSoundButton();
        showToast(soundEnabled ? 'Alert sound enabled.' : 'Alert sound muted.', 'info');
    });

    // ---------- Chart symbol compare overlay ----------
    async function loadCompareOverlay(symbol) {
        clearCompareOverlay(false);
        if (!chartInstance || !selectedAsset) return;
        compareSymbol = symbol.toUpperCase().trim();
        const targetSymbol = `${compareSymbol}USDT`;

        try {
            const endpoint = `https://api.binance.com/api/v3/klines?symbol=${targetSymbol}&interval=${currentInterval}&limit=300`;
            const res = await fetchWithTimeout(endpoint, 12000);
            if (!res.ok) throw new Error('Symbol not found on spot market.');
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) throw new Error('No data for that symbol.');

            compareCandles = data.map(d => ({ time: Math.floor(d[0] / 1000), close: parseFloat(d[4]) }));
            const base = compareCandles[0].close;
            compareSeries = chartInstance.addLineSeries({
                color: '#24a0e5', lineWidth: 2, priceScaleId: 'compare-scale',
                title: `${compareSymbol} %`, priceLineVisible: false, crosshairMarkerVisible: true
            });
            chartInstance.priceScale('compare-scale').applyOptions({ visible: false });
            compareSeries.setData(compareCandles.map(c => ({ time: c.time, value: ((c.close - base) / base) * 100 })));

            document.getElementById('compare-clear-btn').classList.remove('hidden');
            showToast(`Comparing ${selectedAsset.baseAsset} vs ${compareSymbol} (% change)`, 'info');

            if (compareSocket) { compareSocket.onclose = null; try { compareSocket.close(); } catch (e) {} }
            compareSocket = new WebSocket(`wss://stream.binance.com:9443/ws/${targetSymbol.toLowerCase()}@kline_${currentInterval}`);
            compareSocket.onmessage = (event) => {
                let msg;
                try { msg = JSON.parse(event.data); } catch (e) { return; }
                if (!msg || msg.e !== 'kline' || !msg.k || !compareSeries) return;
                const close = parseFloat(msg.k.c);
                const base0 = compareCandles.length ? compareCandles[0].close : close;
                compareSeries.update({ time: Math.floor(msg.k.t / 1000), value: ((close - base0) / base0) * 100 });
            };
        } catch (err) {
            showToast(`Compare failed: ${(err && err.message) || 'unknown error'}`, 'error');
            clearCompareOverlay(true);
        }
    }

    function clearCompareOverlay(resetInput) {
        if (compareSocket) { compareSocket.onclose = null; try { compareSocket.close(); } catch (e) {} compareSocket = null; }
        if (compareSeries && chartInstance) { try { chartInstance.removeSeries(compareSeries); } catch (e) {} }
        compareSeries = null;
        compareCandles = [];
        compareSymbol = null;
        document.getElementById('compare-clear-btn').classList.add('hidden');
        if (resetInput) document.getElementById('compare-input').value = '';
    }

    document.getElementById('compare-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) loadCompareOverlay(e.target.value.trim());
    });
    document.getElementById('compare-clear-btn').addEventListener('click', () => clearCompareOverlay(true));

    // ---------- AI Market Insight ----------
