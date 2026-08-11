// ---------- Position Size & Risk Calculator ----------
// A pure arithmetic sizing tool: given an account size, a risk budget per trade, and an
// entry/stop, it works out how large a position keeps the dollar risk on-plan — and,
// for futures, how much margin that position would actually require at the chosen leverage.
// Nothing here is fetched or AI-generated; every number is traceable to the five inputs.
(function () {
    const els = {};
    const IDS = ['risk-account-size', 'risk-pct', 'risk-entry', 'risk-stop', 'risk-target', 'risk-leverage'];

    function fmtUSD(n) {
        if (!Number.isFinite(n)) return '--';
        return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    function fmtQty(n) {
        if (!Number.isFinite(n)) return '--';
        return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
    }

    function readInputs() {
        const v = (id) => parseFloat(document.getElementById(id).value);
        return {
            accountSize: v('risk-account-size'),
            riskPct: v('risk-pct'),
            entry: v('risk-entry'),
            stop: v('risk-stop'),
            target: v('risk-target'),
            leverage: v('risk-leverage'),
        };
    }

    function recalc() {
        const { accountSize, riskPct, entry, stop, target, leverage } = readInputs();
        const out = {
            dollar: document.getElementById('risk-out-dollar'),
            size: document.getElementById('risk-out-size'),
            notional: document.getElementById('risk-out-notional'),
            margin: document.getElementById('risk-out-margin'),
            stopdist: document.getElementById('risk-out-stopdist'),
            rr: document.getElementById('risk-out-rr'),
            warning: document.getElementById('risk-out-warning'),
        };

        out.warning.classList.add('hidden');
        out.warning.innerText = '';

        if (!(accountSize > 0) || !(riskPct > 0) || !(entry > 0) || !(stop > 0)) {
            out.dollar.innerText = '$0.00';
            out.size.innerText = '--';
            out.notional.innerText = '--';
            out.margin.innerText = '--';
            out.stopdist.innerText = '--';
            out.rr.innerText = '--';
            return;
        }
        if (entry === stop) {
            out.warning.innerText = 'Entry and stop-loss can\'t be the same price — there would be no defined risk.';
            out.warning.classList.remove('hidden');
            return;
        }

        const isFutures = !!(selectedAsset && selectedAsset.isFutures);
        const lev = isFutures ? Math.max(1, leverage > 0 ? leverage : 1) : 1;
        const isLong = stop < entry; // direction is inferred purely from which side the stop sits on

        const dollarRisk = accountSize * (riskPct / 100);
        const stopDistance = Math.abs(entry - stop);
        const stopDistancePct = (stopDistance / entry) * 100;
        const positionSize = dollarRisk / stopDistance; // units of the underlying asset
        const notional = positionSize * entry;
        const requiredMargin = notional / lev;

        out.dollar.innerText = fmtUSD(dollarRisk);
        out.size.innerText = `${fmtQty(positionSize)} ${selectedAsset ? selectedAsset.baseAsset : 'units'}`;
        out.notional.innerText = fmtUSD(notional);
        out.margin.innerText = isFutures ? `${fmtUSD(requiredMargin)} (${lev}x)` : fmtUSD(notional);
        out.stopdist.innerText = `${fmtUSD(stopDistance)} (${stopDistancePct.toFixed(2)}%)`;

        if (target > 0) {
            const reward = Math.abs(target - entry);
            // Sanity-check the target actually sits on the profitable side of entry for the
            // inferred direction — otherwise R:R would be a meaningless/negative number.
            const targetMakesSense = isLong ? target > entry : target < entry;
            out.rr.innerText = targetMakesSense ? `1 : ${(reward / stopDistance).toFixed(2)}` : 'n/a';
            if (!targetMakesSense) {
                out.warning.innerText = `Target is on the wrong side of entry for a ${isLong ? 'long' : 'short'} (inferred from where the stop sits) — R:R can't be computed.`;
                out.warning.classList.remove('hidden');
            }
        } else {
            out.rr.innerText = '--';
        }

        // Practical sanity warnings — these are guardrails, not hard blocks.
        const warnings = [];
        if (requiredMargin > accountSize) {
            warnings.push(`Required margin (${fmtUSD(requiredMargin)}) exceeds the account size entered — increase leverage, widen the stop, or lower the risk %.`);
        }
        if (!isFutures && leverage > 1) {
            warnings.push(`${selectedAsset ? selectedAsset.baseAsset : 'This asset'} is selected as a spot market, so leverage doesn't apply here — margin shown equals full notional value.`);
        }
        if (isFutures && lev > 1 && stopDistancePct <= (100 / lev) * 0.9) {
            // Rough heads-up: a stop distance close to (or beyond) 1/leverage of price sits near
            // where an isolated-margin liquidation would typically land (see futures tracker note).
            warnings.push(`At ${lev}x, this stop distance (${stopDistancePct.toFixed(2)}%) sits close to typical isolated-margin liquidation range — double check against the actual liquidation price for this position.`);
        }
        if (warnings.length) {
            out.warning.innerText = warnings.join(' ');
            out.warning.classList.remove('hidden');
        }
    }

    function fillLivePrice() {
        if (!selectedAsset) { showToast('Select an asset first.', 'error'); return; }
        document.getElementById('risk-entry').value = selectedAsset.price;
        recalc();
    }

    function suggestATRStop() {
        if (!selectedAsset) { showToast('Select an asset first.', 'error'); return; }
        const entryInput = document.getElementById('risk-entry');
        const entry = parseFloat(entryInput.value) > 0 ? parseFloat(entryInput.value) : selectedAsset.price;
        if (!entryInput.value) entryInput.value = entry;

        let atr = null;
        try {
            if (typeof calculateATR === 'function' && Array.isArray(cachedCandlesArray) && cachedCandlesArray.length >= 15) {
                const series = calculateATR(cachedCandlesArray, 14);
                atr = series.length ? series[series.length - 1].value : null;
            }
        } catch (e) { /* fall through to the not-available message below */ }

        const hint = document.getElementById('risk-atr-hint');
        if (!atr) {
            hint.innerText = 'ATR not available yet for this asset — pick a chart interval first, then try again.';
            return;
        }
        // 1.5x ATR is a common, conservative volatility-based stop multiple — wide enough to
        // avoid ordinary noise, not a guarantee against a larger move. Suggests a LONG stop
        // (below entry) by default; a short trader flips the sign manually.
        const suggested = entry - atr * 1.5;
        document.getElementById('risk-stop').value = suggested > 0 ? suggested.toFixed(entry < 1 ? 6 : 2) : '';
        hint.innerText = `Suggested for a LONG: entry − 1.5×ATR(14) (ATR ≈ ${fmtUSD(atr)}). For a short, use entry + 1.5×ATR instead.`;
        recalc();
    }

    function syncRiskCalcForAsset() {
        const label = document.getElementById('risk-asset-label');
        const leverageInput = document.getElementById('risk-leverage');
        if (!label || !leverageInput) return;
        if (!selectedAsset) { label.innerText = ''; return; }
        label.innerText = `— ${selectedAsset.baseAsset}/USDT (${selectedAsset.isFutures ? 'Futures' : 'Spot'})`;
        if (!selectedAsset.isFutures) leverageInput.value = 1;
        leverageInput.disabled = !selectedAsset.isFutures;
        leverageInput.classList.toggle('opacity-40', !selectedAsset.isFutures);
        recalc();
    }
    // Exposed so 04-ticker-sockets.js's selectAsset() can call it without a load-order dependency.
    window.syncRiskCalcForAsset = syncRiskCalcForAsset;

    IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', debounce(recalc, 120));
    });
    document.getElementById('risk-entry-live')?.addEventListener('click', fillLivePrice);
    document.getElementById('risk-stop-atr')?.addEventListener('click', suggestATRStop);

    recalc();
})();
