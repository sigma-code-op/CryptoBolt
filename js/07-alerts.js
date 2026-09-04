// ---------- Price alert list rendering and threshold checking (with sound + browser notification). ----------
    function requestNotificationPermission() {
        if (notificationPermissionRequested || !('Notification' in window)) return;
        notificationPermissionRequested = true;
        if (Notification.permission === 'default') Notification.requestPermission();
        // Also try to enable closed-tab push delivery (js/23-push-alerts.js) for this alert —
        // a no-op if the visitor isn't signed in or this deployment hasn't set up push; either
        // way, the in-tab notification above still works regardless.
        if (window.cwPushAlerts) window.cwPushAlerts.enable();
    }

    function describeAlert(a) {
        if (a.direction === 'above') return `▲ Above $${a.target}`;
        if (a.direction === 'below') return `▼ Below $${a.target}`;
        if (a.direction === 'pct_up') return `▲ Rises ${a.target}% (from $${a.basePrice})`;
        if (a.direction === 'pct_down') return `▼ Falls ${a.target}% (from $${a.basePrice})`;
        return '';
    }

    function renderAlertsList() {
        const list = document.getElementById('alerts-list');
        if (!selectedAsset) { list.innerHTML = '<p class="text-gray-600 text-[10px]">Select an asset first.</p>'; return; }
        const alerts = priceAlerts[selectedAsset.id] || [];
        if (alerts.length === 0) { list.innerHTML = '<p class="text-gray-600 text-[10px]">No alerts set for this asset.</p>'; return; }

        list.innerHTML = alerts.map(a => `
            <div class="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded px-2 py-1">
                <span class="${a.direction === 'above' || a.direction === 'pct_up' ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}">${describeAlert(a)}</span>
                <button class="text-gray-500 hover:text-[#ff4d6a] cursor-pointer alert-remove" data-id="${a.id}">✕</button>
            </div>
        `).join('');

        list.querySelectorAll('.alert-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                priceAlerts[selectedAsset.id] = (priceAlerts[selectedAsset.id] || []).filter(a => a.id !== id);
                localStorage.setItem('cw_alerts', JSON.stringify(priceAlerts));
                renderAlertsList(); if (typeof updateChartOverlayLines === "function") updateChartOverlayLines();
            });
        });
    }

    // ---------- Feature: Alert History ----------
    // Active alerts disappear once they trigger (by design). This keeps a rolling log of the
    // last 20 triggers across all assets so a person can look back at what fired and when.
    const ALERT_HISTORY_MAX = 20;
    function logAlertHistory(asset, alertDesc) {
        const history = safeJSONParse(localStorage.getItem('cw_alert_history'), []);
        history.unshift({ time: Date.now(), asset: asset.baseAsset, desc: alertDesc, price: asset.price });
        localStorage.setItem('cw_alert_history', JSON.stringify(history.slice(0, ALERT_HISTORY_MAX)));
        if (!document.getElementById('alert-history-list').classList.contains('hidden')) renderAlertHistory();
    }
    function renderAlertHistory() {
        const container = document.getElementById('alert-history-list');
        const history = safeJSONParse(localStorage.getItem('cw_alert_history'), []);
        if (history.length === 0) { container.innerHTML = '<p class="text-gray-600 text-[9.5px]">No alerts have triggered yet.</p>'; return; }
        container.innerHTML = history.map(h => {
            const time = new Date(h.time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `<div class="flex items-center justify-between text-[9.5px] px-1.5 py-1 rounded bg-gray-900/50">
                <span class="text-gray-400"><strong class="text-gray-300">${h.asset}</strong> ${h.desc}</span>
                <span class="text-gray-600">${time}</span>
            </div>`;
        }).join('');
    }
    document.getElementById('alert-history-toggle').addEventListener('click', () => {
        const list = document.getElementById('alert-history-list');
        const btn = document.getElementById('alert-history-toggle');
        const willShow = list.classList.contains('hidden');
        list.classList.toggle('hidden');
        btn.innerText = willShow ? '🕘 Hide triggered history' : '🕘 Show triggered history';
        if (willShow) renderAlertHistory();
    });

    function checkPriceAlerts(asset) {
        const alerts = priceAlerts[asset.id];
        if (!alerts || alerts.length === 0) return;
        let changed = false;
        alerts.forEach(a => {
            if (a.triggered) return;
            let hit = false;
            let msg = '';
            if (a.direction === 'above') {
                hit = asset.price >= a.target;
                msg = `${asset.baseAsset} rose above $${a.target}`;
            } else if (a.direction === 'below') {
                hit = asset.price <= a.target;
                msg = `${asset.baseAsset} fell below $${a.target}`;
            } else if (a.direction === 'pct_up') {
                const threshold = a.basePrice * (1 + a.target / 100);
                hit = asset.price >= threshold;
                msg = `${asset.baseAsset} rose ${a.target}% (now $${asset.price})`;
            } else if (a.direction === 'pct_down') {
                const threshold = a.basePrice * (1 - a.target / 100);
                hit = asset.price <= threshold;
                msg = `${asset.baseAsset} fell ${a.target}% (now $${asset.price})`;
            }
            if (hit) {
                a.triggered = true;
                changed = true;
                const isPositive = a.direction === 'above' || a.direction === 'pct_up';
                showToast(msg, isPositive ? 'success' : 'error');
                playAlertBeep();
                logAlertHistory(asset, describeAlert(a));
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('CryptoBolt Alert', { body: msg });
                }
            }
        });
        if (changed) {
            priceAlerts[asset.id] = alerts.filter(a => !a.triggered);
            localStorage.setItem('cw_alerts', JSON.stringify(priceAlerts));
            if (selectedAsset && selectedAsset.id === asset.id) renderAlertsList();
        }
    }

    document.getElementById('alert-direction').addEventListener('change', (e) => {
        const isPct = e.target.value === 'pct_up' || e.target.value === 'pct_down';
        document.getElementById('alert-price-input').placeholder = isPct ? 'Percent move (e.g. 5)' : 'Target price';
    });

    document.getElementById('alert-add-btn').addEventListener('click', () => {
        if (!selectedAsset) { showToast('Select an asset first.', 'error'); return; }
        const val = parseFloat(document.getElementById('alert-price-input').value);
        if (isNaN(val) || val <= 0) { showToast('Enter a valid value.', 'error'); return; }
        const direction = document.getElementById('alert-direction').value;
        const isPct = direction === 'pct_up' || direction === 'pct_down';
        if (isPct && val >= 100) { showToast('Percent move should be under 100.', 'error'); return; }
        requestNotificationPermission();
        if (!priceAlerts[selectedAsset.id]) priceAlerts[selectedAsset.id] = [];
        const alert = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, direction, target: val, triggered: false };
        if (isPct) alert.basePrice = selectedAsset.price;
        priceAlerts[selectedAsset.id].push(alert);
        localStorage.setItem('cw_alerts', JSON.stringify(priceAlerts));
        document.getElementById('alert-price-input').value = '';
        renderAlertsList(); if (typeof updateChartOverlayLines === "function") updateChartOverlayLines();
        showToast(`Alert set: ${selectedAsset.baseAsset} — ${describeAlert(alert)}`, 'success');
    });

    document.getElementById('alert-bell').addEventListener('click', () => {
        document.getElementById('alert-price-input').focus();
        requestNotificationPermission();
    });

    // ---------- Portfolio tracker ----------
    function findSpotAssetByBase(base) {
        const upper = base.toUpperCase().trim();
        return marketMap[`${upper}USDT_S`] || marketMap[`${upper}USDT_F`] || null;
    }

    // ---------- Combined account summary (spot + futures) ----------