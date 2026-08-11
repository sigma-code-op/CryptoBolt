// ---------- Live stop-loss / take-profit triggers (holdings + futures positions) ----------
// This is a tracker, not a broker — it never places a real order. What it does do is watch the
// same live price stream the chart uses and, the moment a tracked holding or position crosses a
// stop-loss or take-profit level someone set, fire the same toast/sound/browser-notification
// combo the price-alert feature uses, so nobody has to sit and stare at a row waiting to act on
// it themselves. Each level only fires once (tracked via slHit/tpHit on the record) until it's
// removed and re-added.

    function flashRiskRow(selector, isGood) {
        const row = document.querySelector(selector);
        if (!row) return;
        row.style.setProperty('--cw-flash-color', isGood ? 'rgba(20, 211, 138, 0.22)' : 'rgba(255, 77, 106, 0.22)');
        row.classList.remove('cw-risk-triggered');
        void row.offsetWidth; // restart the CSS animation
        row.classList.add('cw-risk-triggered');
    }

    function fireRiskTrigger(kind, label, price, isGood) {
        const msg = `${label} ${kind} hit at $${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
        showToast(msg, isGood ? 'success' : 'error');
        if (typeof playAlertBeep === 'function') playAlertBeep();
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('CryptoBolt', { body: msg });
        }
    }

    function checkPositionRiskTriggers(asset) {
        if (!asset || asset.price == null) return;
        const base = asset.baseAsset;
        const triggeredHoldingIds = [];
        const triggeredPositionIds = [];
        let holdingsChanged = false, positionsChanged = false;

        if (!asset.isFutures) {
            holdings.forEach(h => {
                if (h.symbol !== base) return;
                if (h.stopLoss && !h.slHit && asset.price <= h.stopLoss) {
                    h.slHit = true; holdingsChanged = true; triggeredHoldingIds.push([h.id, false]);
                    fireRiskTrigger('Stop-loss', `${h.symbol} holding`, asset.price, false);
                }
                if (h.takeProfit && !h.tpHit && asset.price >= h.takeProfit) {
                    h.tpHit = true; holdingsChanged = true; triggeredHoldingIds.push([h.id, true]);
                    fireRiskTrigger('Take-profit', `${h.symbol} holding`, asset.price, true);
                }
            });
        } else {
            futuresPositions.forEach(p => {
                if (p.symbol !== base) return;
                const hitSL = p.stopLoss && (p.side === 'long' ? asset.price <= p.stopLoss : asset.price >= p.stopLoss);
                const hitTP = p.takeProfit && (p.side === 'long' ? asset.price >= p.takeProfit : asset.price <= p.takeProfit);
                if (hitSL && !p.slHit) {
                    p.slHit = true; positionsChanged = true; triggeredPositionIds.push([p.id, false]);
                    fireRiskTrigger('Stop-loss', `${p.symbol} ${p.side} position`, asset.price, false);
                }
                if (hitTP && !p.tpHit) {
                    p.tpHit = true; positionsChanged = true; triggeredPositionIds.push([p.id, true]);
                    fireRiskTrigger('Take-profit', `${p.symbol} ${p.side} position`, asset.price, true);
                }
            });
        }

        if (holdingsChanged) {
            localStorage.setItem('cw_holdings', JSON.stringify(holdings));
            if (typeof renderPortfolio === 'function') renderPortfolio();
            triggeredHoldingIds.forEach(([id, isGood]) => flashRiskRow(`[data-holding-id="${id}"]`, isGood));
        }
        if (positionsChanged) {
            localStorage.setItem('cw_futures_positions', JSON.stringify(futuresPositions));
            if (typeof renderFuturesPositions === 'function') renderFuturesPositions();
            triggeredPositionIds.forEach(([id, isGood]) => flashRiskRow(`[data-position-id="${id}"]`, isGood));
        }
    }
