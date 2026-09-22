// ---------- Spot portfolio and futures position tracking, PnL/liquidation math, CSV export. ----------

    // ---------- Feature: portfolio risk score ----------
    // Extends js/13-risk-calculator.js's per-trade risk math to the account as a whole.
    // A pure function of its arguments (no DOM, no localStorage) — same pattern as
    // js/16-paper-trading.js's PT_MAINTENANCE_MARGIN_RATE/estimateLiqPrice, kept outside
    // updateAccountSummary() below so it stays independently testable/reviewable.
    //
    // Three components, each scaled 0-100 then weighted:
    //   - leverage:      margin-weighted average leverage across open futures positions
    //                     (1x -> 0, 20x+ -> 100). Ignored (0) if there are no positions.
    //   - concentration:  the single largest position's notional exposure as a % of total
    //                     notional exposure (spot value + futures notional combined).
    //                     A one-asset account scores 100 here regardless of leverage.
    //   - leveragedShare: how much of total notional exposure is leveraged futures vs.
    //                     unlevered spot — an account that's all spot scores 0 here even
    //                     if concentrated in one coin.
    // Weights (40/35/25) favor leverage first, then concentration, then leveraged share —
    // leverage is what turns an ordinary drawdown into a liquidation, so it's weighted the
    // heaviest of the three.
    function computeRiskScoreInputs(holdings, futuresPositions, findSpotAssetByBase, findFuturesAssetByBase) {
        let spotNotional = 0, futuresNotional = 0, marginWeightedLeverage = 0, totalMargin = 0;
        const exposureBySymbol = {};

        holdings.forEach(h => {
            const asset = findSpotAssetByBase(h.symbol);
            const value = asset ? asset.price * h.qty : 0;
            spotNotional += value;
            exposureBySymbol[h.symbol] = (exposureBySymbol[h.symbol] || 0) + value;
        });

        futuresPositions.forEach(p => {
            const asset = findFuturesAssetByBase(p.symbol);
            const markPrice = asset ? asset.price : p.entryPrice;
            const notional = markPrice * p.qty;
            const margin = (p.entryPrice * p.qty) / p.leverage;
            futuresNotional += notional;
            totalMargin += margin;
            marginWeightedLeverage += margin * p.leverage;
            exposureBySymbol[p.symbol] = (exposureBySymbol[p.symbol] || 0) + notional;
        });

        const totalNotional = spotNotional + futuresNotional;
        const largestExposure = Math.max(0, ...Object.values(exposureBySymbol));
        const avgLeverage = totalMargin > 0 ? marginWeightedLeverage / totalMargin : 1;

        return {
            totalNotional,
            concentrationPct: totalNotional > 0 ? (largestExposure / totalNotional) * 100 : 0,
            leveragedSharePct: totalNotional > 0 ? (futuresNotional / totalNotional) * 100 : 0,
            avgLeverage,
            hasFutures: futuresPositions.length > 0,
        };
    }
    function computeRiskScore(inputs) {
        if (inputs.totalNotional <= 0) return { score: 0, label: 'None', color: 'text-gray-500 bg-gray-800 border-gray-700' };
        const leverageIntensity = inputs.hasFutures ? Math.min(1, Math.max(0, (inputs.avgLeverage - 1) / 19)) : 0;
        const leverageScore = leverageIntensity * 100;
        const concentrationScore = Math.min(100, inputs.concentrationPct);
        // Scaled by leverageIntensity too — a 1x futures position carries essentially the
        // same risk as holding the same notional in spot, so it shouldn't be flagged as
        // "leveraged" here just for being on the futures side of the account.
        const leveragedShareScore = Math.min(100, inputs.leveragedSharePct) * leverageIntensity;
        const score = leverageScore * 0.40 + concentrationScore * 0.35 + leveragedShareScore * 0.25;
        let label, color;
        if (score < 25) { label = 'Low'; color = 'text-[#14d38a] bg-[#14d38a]/10 border-[#14d38a]/30'; }
        else if (score < 50) { label = 'Moderate'; color = 'text-amber-400 bg-amber-500/10 border-amber-500/30'; }
        else if (score < 75) { label = 'High'; color = 'text-[#ff4d6a] bg-[#ff4d6a]/10 border-[#ff4d6a]/30'; }
        else { label = 'Extreme'; color = 'text-[#ff4d6a] bg-[#ff4d6a]/20 border-[#ff4d6a]/50'; }
        return { score: Math.round(score), label, color };
    }
    function renderRiskScore(inputs) {
        const el = document.getElementById('summary-risk-score');
        if (!el) return; // page doesn't have the risk-score badge — skip quietly
        const { score, label, color } = computeRiskScore(inputs);
        el.innerText = inputs.totalNotional > 0 ? `${label} · ${score}/100` : '—';
        el.className = `text-[10px] font-bold uppercase px-2 py-1 rounded border ${color}`;
        el.title = inputs.totalNotional > 0
            ? `Concentration: ${inputs.concentrationPct.toFixed(0)}% in largest position · Leveraged share: ${inputs.leveragedSharePct.toFixed(0)}% of exposure${inputs.hasFutures ? ` · Avg leverage: ${inputs.avgLeverage.toFixed(1)}x` : ''}. Not a recommendation — just a read on how concentrated/leveraged this account currently is.`
            : 'Add holdings or open a position to see a risk read here.';
    }

    function updateAccountSummary() {
        let spotValue = 0;
        holdings.forEach(h => {
            const asset = findSpotAssetByBase(h.symbol);
            if (asset) spotValue += asset.price * h.qty;
        });

        let futuresMargin = 0, futuresPnl = 0;
        futuresPositions.forEach(p => {
            const asset = findFuturesAssetByBase(p.symbol);
            const margin = (p.entryPrice * p.qty) / p.leverage;
            futuresMargin += margin;
            if (asset) {
                const pnl = p.side === 'long' ? (asset.price - p.entryPrice) * p.qty : (p.entryPrice - asset.price) * p.qty;
                futuresPnl += pnl;
            }
        });

        const netValue = spotValue + futuresMargin + futuresPnl;
        document.getElementById('summary-spot-value').innerText = `$${spotValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        document.getElementById('summary-futures-margin').innerText = `$${futuresMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        const fPnlEl = document.getElementById('summary-futures-pnl');
        fPnlEl.innerText = `${futuresPnl >= 0 ? '+' : ''}$${futuresPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        fPnlEl.className = `text-sm font-mono font-bold ${futuresPnl >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}`;
        document.getElementById('summary-net-value').innerText = `$${netValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        renderRiskScore(computeRiskScoreInputs(holdings, futuresPositions, findSpotAssetByBase, findFuturesAssetByBase));
    }

    // ---------- Live conversion hints (Coins <-> USDT) ----------
    function refreshHoldingQtyHint() {
        const hint = document.getElementById('holding-qty-hint');
        const symbol = document.getElementById('holding-symbol-input').value.toUpperCase().trim();
        const unit = document.getElementById('holding-qty-unit').value;
        const raw = parseFloat(document.getElementById('holding-qty-input').value);
        const asset = findSpotAssetByBase(symbol);
        if (!asset || isNaN(raw) || raw <= 0) { hint.innerText = ''; return; }
        hint.innerText = unit === 'usdt'
            ? `≈ ${(raw / asset.price).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`
            : `≈ $${(raw * asset.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    ['holding-symbol-input', 'holding-qty-input', 'holding-qty-unit'].forEach(id => {
        document.getElementById(id).addEventListener('input', refreshHoldingQtyHint);
        document.getElementById(id).addEventListener('change', refreshHoldingQtyHint);
    });

    document.getElementById('holding-uselive-btn').addEventListener('click', () => {
        const symbol = document.getElementById('holding-symbol-input').value.toUpperCase().trim();
        const asset = findSpotAssetByBase(symbol);
        if (!asset) { showToast(`Enter a tracked symbol first, e.g. BTC.`, 'error'); return; }
        document.getElementById('holding-cost-input').value = asset.price;
        refreshHoldingQtyHint();
    });

    function refreshFuturesQtyHint() {
        const hint = document.getElementById('futures-qty-hint');
        const unit = document.getElementById('futures-qty-unit').value;
        const raw = parseFloat(document.getElementById('futures-qty-input').value);
        const entryPrice = parseFloat(document.getElementById('futures-entry-input').value);
        const symbol = document.getElementById('futures-symbol-input').value.toUpperCase().trim();
        if (isNaN(raw) || raw <= 0 || isNaN(entryPrice) || entryPrice <= 0) { hint.innerText = ''; return; }
        hint.innerText = unit === 'usdt'
            ? `≈ ${(raw / entryPrice).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol || 'coins'}`
            : `≈ $${(raw * entryPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })} notional`;
    }
    ['futures-symbol-input', 'futures-qty-input', 'futures-qty-unit', 'futures-entry-input'].forEach(id => {
        document.getElementById(id).addEventListener('input', refreshFuturesQtyHint);
        document.getElementById(id).addEventListener('change', refreshFuturesQtyHint);
    });

    document.getElementById('futures-uselive-btn').addEventListener('click', () => {
        const symbol = document.getElementById('futures-symbol-input').value.toUpperCase().trim();
        const asset = findFuturesAssetByBase(symbol);
        if (!asset) { showToast(`Enter a tracked futures symbol first, e.g. BTC.`, 'error'); return; }
        document.getElementById('futures-entry-input').value = asset.price;
        refreshFuturesQtyHint();
    });

    // ---------- CSV export (portfolio + futures) ----------
    function exportPortfolioToCSV() {
        if (holdings.length === 0) { showToast('No holdings to export.', 'error'); return; }
        const lines = [['Asset', 'Qty', 'AvgCost', 'Price', 'Value', 'StopLoss', 'TakeProfit', 'PnL'].join(',')];
        holdings.forEach(h => {
            const asset = findSpotAssetByBase(h.symbol);
            const price = asset ? asset.price : 0;
            const value = price * h.qty;
            const pnl = h.avgCost ? (value - h.avgCost * h.qty) : '';
            lines.push([h.symbol, h.qty, h.avgCost || '', price || '', value.toFixed(2), h.stopLoss || '', h.takeProfit || '', pnl === '' ? '' : pnl.toFixed(2)].join(','));
        });
        downloadCSV(lines.join('\n'), `portfolio_holdings_${Date.now()}.csv`);
    }
    document.getElementById('portfolio-csv-btn').addEventListener('click', exportPortfolioToCSV);

    function exportFuturesToCSV() {
        if (futuresPositions.length === 0) { showToast('No positions to export.', 'error'); return; }
        const lines = [['Asset', 'Side', 'Entry', 'Qty', 'Leverage', 'Margin', 'Mark', 'LiqEst', 'StopLoss', 'TakeProfit', 'PnL'].join(',')];
        futuresPositions.forEach(p => {
            const asset = findFuturesAssetByBase(p.symbol);
            const mark = asset ? asset.price : '';
            const margin = (p.entryPrice * p.qty) / p.leverage;
            const liq = p.side === 'long' ? p.entryPrice * (1 - 1 / p.leverage) : p.entryPrice * (1 + 1 / p.leverage);
            const pnl = asset ? (p.side === 'long' ? (asset.price - p.entryPrice) * p.qty : (p.entryPrice - asset.price) * p.qty) : '';
            lines.push([p.symbol, p.side, p.entryPrice, p.qty, p.leverage, margin.toFixed(2), mark, liq.toFixed(6), p.stopLoss || '', p.takeProfit || '', pnl === '' ? '' : pnl.toFixed(2)].join(','));
        });
        downloadCSV(lines.join('\n'), `futures_positions_${Date.now()}.csv`);
    }
    document.getElementById('futures-csv-btn').addEventListener('click', exportFuturesToCSV);

    function downloadCSV(csvText, filename) {
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(`Exported to ${filename}`, 'success');
    }

    function renderPortfolio() {
        const tbody = document.getElementById('portfolio-rows');
        if (!tbody) return;

        if (holdings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-gray-600 text-[11px]">No holdings added yet — track quantities to see live portfolio value.</td></tr>`;
            document.getElementById('portfolio-total-value').innerText = '$0.00';
            const pnlEl = document.getElementById('portfolio-total-pnl');
            pnlEl.innerText = '$0.00';
            pnlEl.className = 'text-sm font-mono font-bold text-gray-400';
            updateAccountSummary();
            return;
        }

        let totalValue = 0, totalCostBasis = 0, hasCostBasis = false;

        tbody.innerHTML = holdings.map(h => {
            const asset = findSpotAssetByBase(h.symbol);
            const price = asset ? asset.price : 0;
            const value = price * h.qty;
            totalValue += value;
            let pnlHtml = '<span class="text-gray-600">--</span>';
            if (h.avgCost && h.avgCost > 0) {
                hasCostBasis = true;
                const costBasis = h.avgCost * h.qty;
                totalCostBasis += costBasis;
                const pnl = value - costBasis;
                const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
                const pnlColor = pnl >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]';
                pnlHtml = `<span class="${pnlColor}">${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)</span>`;
            }
            let slTpHtml = '<span class="text-gray-600">--</span>';
            if (h.stopLoss || h.takeProfit) {
                const parts = [];
                if (h.stopLoss) parts.push(`<span class="text-[#ff4d6a]">SL $${h.stopLoss.toLocaleString(undefined, priceFmt(h.stopLoss))}${h.slHit ? ' <span class="text-[8px] px-1 rounded bg-[#ff4d6a]/20 text-[#ff4d6a] font-bold">HIT</span>' : ''}</span>`);
                if (h.takeProfit) parts.push(`<span class="text-[#14d38a]">TP $${h.takeProfit.toLocaleString(undefined, priceFmt(h.takeProfit))}${h.tpHit ? ' <span class="text-[8px] px-1 rounded bg-[#14d38a]/20 text-[#14d38a] font-bold">HIT</span>' : ''}</span>`);
                slTpHtml = `<span class="text-[10px] leading-tight flex flex-col items-end">${parts.join('')}</span>`;
            }
            return `
                <tr class="hover:bg-gray-800/40 transition-colors" data-holding-id="${h.id}">
                    <td class="py-2 px-3 font-bold text-white">${escapeHtml(h.symbol)}${!asset ? ' <span class=\"text-[9px] text-gray-600\">(unlisted)</span>' : ''}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${h.qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                    <td class="py-2 px-3 text-right text-gray-500">${h.avgCost ? '$' + h.avgCost : '--'}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${price ? '$' + price.toLocaleString(undefined, priceFmt(price)) : '--'}</td>
                    <td class="py-2 px-3 text-right text-white font-bold">$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td class="py-2 px-3 text-right">${slTpHtml}</td>
                    <td class="py-2 px-3 text-right">${pnlHtml}</td>
                    <td class="py-2 px-3 text-center"><button class="text-gray-500 hover:text-[#ff4d6a] cursor-pointer holding-remove" data-id="${h.id}"><i data-lucide="x" width="12" height="12" stroke-width="2.4"></i></button></td>
                </tr>
            `;
        }).join('');

        document.getElementById('portfolio-total-value').innerText = `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        const pnlEl = document.getElementById('portfolio-total-pnl');
        if (hasCostBasis) {
            const totalPnl = totalValue - totalCostBasis;
            const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;
            pnlEl.innerText = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%)`;
            pnlEl.className = `text-sm font-mono font-bold ${totalPnl >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}`;
        } else {
            pnlEl.innerText = '-- (add avg cost)';
            pnlEl.className = 'text-sm font-mono font-bold text-gray-500';
        }

        tbody.querySelectorAll('.holding-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                holdings = holdings.filter(h => h.id !== btn.getAttribute('data-id'));
                localStorage.setItem('cw_holdings', JSON.stringify(holdings));
                renderPortfolio();
            });
        });

        updateAccountSummary();
    }

    document.getElementById('holding-add-btn').addEventListener('click', () => {
        const symbolInput = document.getElementById('holding-symbol-input');
        const qtyInput = document.getElementById('holding-qty-input');
        const unitInput = document.getElementById('holding-qty-unit');
        const costInput = document.getElementById('holding-cost-input');
        const slInput = document.getElementById('holding-sl-input');
        const tpInput = document.getElementById('holding-tp-input');
        const symbol = symbolInput.value.toUpperCase().trim();
        const rawQty = parseFloat(qtyInput.value);
        const unit = unitInput.value;
        const avgCost = parseFloat(costInput.value);
        const stopLoss = parseFloat(slInput.value);
        const takeProfit = parseFloat(tpInput.value);

        if (!symbol) { showToast('Enter an asset symbol, e.g. BTC.', 'error'); return; }
        if (isNaN(rawQty) || rawQty <= 0) { showToast('Enter a valid amount.', 'error'); return; }
        const marketAsset = findSpotAssetByBase(symbol);
        if (!marketAsset) { showToast(`${symbol} isn't a tracked USDT market.`, 'error'); return; }

        // Spot holdings only make sense as a "sell if it drops"/"sell if it pumps" pair relative
        // to the live market — unlike futures there's no entry price to validate a stop against,
        // so the only real check is stop-loss below and take-profit above one another (if both are set).
        if (!isNaN(stopLoss) && stopLoss > 0 && !isNaN(takeProfit) && takeProfit > 0 && stopLoss >= takeProfit) {
            showToast('Stop-loss should be below take-profit.', 'error'); return;
        }

        // USDT mode always converts off the LIVE price (not avg cost) — "I have $500 of BTC
        // right now" is a statement about current holdings, independent of what was paid for it.
        let qty = rawQty;
        if (unit === 'usdt') {
            if (marketAsset.price <= 0) { showToast('No live price available to convert from USDT yet.', 'error'); return; }
            qty = rawQty / marketAsset.price;
        }

        holdings.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            symbol, qty,
            avgCost: !isNaN(avgCost) && avgCost > 0 ? avgCost : null,
            stopLoss: !isNaN(stopLoss) && stopLoss > 0 ? stopLoss : null,
            takeProfit: !isNaN(takeProfit) && takeProfit > 0 ? takeProfit : null
        });
        localStorage.setItem('cw_holdings', JSON.stringify(holdings));
        symbolInput.value = ''; qtyInput.value = ''; costInput.value = ''; unitInput.value = 'coins'; slInput.value = ''; tpInput.value = '';
        document.getElementById('holding-qty-hint').innerText = '';
        renderPortfolio();
        showToast(`Added ${qty.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol} to portfolio.`, 'success');
    });

    // ---------- Futures positions (leverage) tracker ----------
    function findFuturesAssetByBase(base) {
        return marketMap[`${base.toUpperCase().trim()}USDT_F`] || null;
    }

    function renderFuturesPositions() {
        const tbody = document.getElementById('futures-rows');
        if (!tbody) return;

        if (futuresPositions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="13" class="py-8 text-center text-gray-600 text-[11px]">No leveraged positions tracked yet.</td></tr>`;
            document.getElementById('futures-total-margin').innerText = '$0.00';
            const pnlEl = document.getElementById('futures-total-pnl');
            pnlEl.innerText = '$0.00';
            pnlEl.className = 'text-sm font-mono font-bold text-gray-400';
            updateAccountSummary();
            return;
        }

        let totalMargin = 0, totalPnl = 0;

        tbody.innerHTML = futuresPositions.map(p => {
            const asset = findFuturesAssetByBase(p.symbol);
            const mark = asset ? asset.price : null;
            const margin = (p.entryPrice * p.qty) / p.leverage;
            totalMargin += margin;

            // Simplified isolated-margin liquidation estimate — ignores maintenance margin, fees,
            // and funding, so it will differ from the real exchange figure. Clearly labeled below.
            const liqPrice = p.side === 'long'
                ? p.entryPrice * (1 - 1 / p.leverage)
                : p.entryPrice * (1 + 1 / p.leverage);

            let pnlHtml = '<span class="text-gray-600">--</span>';
            let markHtml = '<span class="text-gray-600">--</span>';
            if (mark !== null) {
                const pnl = p.side === 'long' ? (mark - p.entryPrice) * p.qty : (p.entryPrice - mark) * p.qty;
                totalPnl += pnl;
                const pnlPct = margin > 0 ? (pnl / margin) * 100 : 0;
                const pnlColor = pnl >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]';
                pnlHtml = `<span class="${pnlColor}">${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)</span>`;
                markHtml = `$${mark.toLocaleString(undefined, priceFmt(mark))}`;
            }

            // Stop-loss risk: how much is lost (in $ and % of margin) if the stop is hit, plus a
            // warning if the stop sits on the wrong side of the liquidation price — meaning
            // liquidation would trigger first and the stop would never actually execute.
            let slHtml = '<span class="text-gray-600">--</span>';
            let slRisk = null;
            if (p.stopLoss) {
                const risk = p.side === 'long' ? (p.entryPrice - p.stopLoss) * p.qty : (p.stopLoss - p.entryPrice) * p.qty;
                slRisk = Math.abs(risk);
                const riskPct = margin > 0 ? (risk / margin) * 100 : 0;
                const beyondLiq = p.side === 'long' ? p.stopLoss < liqPrice : p.stopLoss > liqPrice;
                slHtml = `<span class="text-gray-400">$${p.stopLoss.toLocaleString(undefined, priceFmt(p.stopLoss))}</span>${p.slHit ? ' <span class="text-[8px] px-1 rounded bg-[#ff4d6a]/20 text-[#ff4d6a] font-bold">HIT</span>' : ''}<br><span class="text-[10px] ${risk >= 0 ? 'text-[#ff4d6a]' : 'text-[#14d38a]'}">${risk >= 0 ? '-' : '+'}$${Math.abs(risk).toLocaleString(undefined, { maximumFractionDigits: 2 })} (${riskPct.toFixed(1)}%)</span>${beyondLiq ? '<br><span class="text-[9px] text-amber-400"><i data-lucide="triangle-alert" width="10" height="10" stroke-width="2.3" style="vertical-align:-1px;"></i> past liq.</span>' : ''}`;
            }

            // Take-profit reward: same shape as the stop-loss risk cell above, plus a combined
            // reward:risk ratio when both a stop and a target are set — the number a person
            // actually uses to judge whether a trade setup is worth taking.
            let tpHtml = '<span class="text-gray-600">--</span>';
            let tpReward = null;
            if (p.takeProfit) {
                const reward = p.side === 'long' ? (p.takeProfit - p.entryPrice) * p.qty : (p.entryPrice - p.takeProfit) * p.qty;
                tpReward = Math.abs(reward);
                const rewardPct = margin > 0 ? (reward / margin) * 100 : 0;
                tpHtml = `<span class="text-gray-400">$${p.takeProfit.toLocaleString(undefined, priceFmt(p.takeProfit))}</span>${p.tpHit ? ' <span class="text-[8px] px-1 rounded bg-[#14d38a]/20 text-[#14d38a] font-bold">HIT</span>' : ''}<br><span class="text-[10px] ${reward >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}">${reward >= 0 ? '+' : '-'}$${Math.abs(reward).toLocaleString(undefined, { maximumFractionDigits: 2 })} (${rewardPct.toFixed(1)}%)</span>`;
            }
            let rrHtml = '<span class="text-gray-600">--</span>';
            if (slRisk && tpReward && slRisk > 0) {
                const rr = tpReward / slRisk;
                const rrColor = rr >= 2 ? 'text-[#14d38a]' : rr >= 1 ? 'text-amber-400' : 'text-[#ff4d6a]';
                rrHtml = `<span class="${rrColor} font-bold">1:${rr.toFixed(2)}</span>`;
            }

            const sideColor = p.side === 'long' ? 'text-[#14d38a] bg-[#14d38a]/10 border-[#14d38a]/30' : 'text-[#ff4d6a] bg-[#ff4d6a]/10 border-[#ff4d6a]/30';

            return `
                <tr class="hover:bg-gray-800/40 transition-colors" data-position-id="${p.id}">
                    <td class="py-2 px-3 font-bold text-white">${escapeHtml(p.symbol)}${!asset ? ' <span class=\"text-[9px] text-gray-600\">(unlisted)</span>' : ''}</td>
                    <td class="py-2 px-3"><span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${sideColor}">${p.side}</span></td>
                    <td class="py-2 px-3 text-right text-gray-300">$${p.entryPrice.toLocaleString(undefined, priceFmt(p.entryPrice))}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${p.qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                    <td class="py-2 px-3 text-right text-amber-400 font-bold">${p.leverage}x</td>
                    <td class="py-2 px-3 text-right text-gray-300">$${margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td class="py-2 px-3 text-right text-gray-300">${markHtml}</td>
                    <td class="py-2 px-3 text-right text-gray-500">$${liqPrice.toLocaleString(undefined, priceFmt(liqPrice))}</td>
                    <td class="py-2 px-3 text-right leading-tight">${slHtml}</td>
                    <td class="py-2 px-3 text-right leading-tight">${tpHtml}</td>
                    <td class="py-2 px-3 text-right">${rrHtml}</td>
                    <td class="py-2 px-3 text-right">${pnlHtml}</td>
                    <td class="py-2 px-3 text-center"><button class="text-gray-500 hover:text-[#ff4d6a] cursor-pointer futures-remove" data-id="${p.id}"><i data-lucide="x" width="12" height="12" stroke-width="2.4"></i></button></td>
                </tr>
            `;
        }).join('');

        document.getElementById('futures-total-margin').innerText = `$${totalMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        const pnlEl = document.getElementById('futures-total-pnl');
        pnlEl.innerText = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        pnlEl.className = `text-sm font-mono font-bold ${totalPnl >= 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]'}`;

        tbody.querySelectorAll('.futures-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                futuresPositions = futuresPositions.filter(p => p.id !== btn.getAttribute('data-id'));
                localStorage.setItem('cw_futures_positions', JSON.stringify(futuresPositions));
                renderFuturesPositions();
            });
        });

        updateAccountSummary();
    }

    document.getElementById('futures-add-btn').addEventListener('click', () => {
        const symbolInput = document.getElementById('futures-symbol-input');
        const sideInput = document.getElementById('futures-side-input');
        const entryInput = document.getElementById('futures-entry-input');
        const qtyInput = document.getElementById('futures-qty-input');
        const unitInput = document.getElementById('futures-qty-unit');
        const leverageInput = document.getElementById('futures-leverage-input');
        const slInput = document.getElementById('futures-sl-input');
        const tpInput = document.getElementById('futures-tp-input');

        const symbol = symbolInput.value.toUpperCase().trim();
        const side = sideInput.value;
        const entryPrice = parseFloat(entryInput.value);
        const rawQty = parseFloat(qtyInput.value);
        const unit = unitInput.value;
        const leverage = parseInt(leverageInput.value, 10);
        const stopLoss = parseFloat(slInput.value);
        const takeProfit = parseFloat(tpInput.value);

        if (!symbol) { showToast('Enter an asset symbol, e.g. BTC.', 'error'); return; }
        if (!findFuturesAssetByBase(symbol)) { showToast(`${symbol} isn't a tracked USDT-M futures market.`, 'error'); return; }
        if (isNaN(entryPrice) || entryPrice <= 0) { showToast('Enter a valid entry price.', 'error'); return; }
        if (isNaN(rawQty) || rawQty <= 0) { showToast('Enter a valid amount.', 'error'); return; }
        if (isNaN(leverage) || leverage < 1 || leverage > 125) { showToast('Leverage must be between 1x and 125x.', 'error'); return; }

        // USDT mode here means notional position size (standard futures UX): $1,000 position at
        // entry $50,000 = 0.02 coins — converted using entry price since that's the position basis.
        const qty = unit === 'usdt' ? rawQty / entryPrice : rawQty;

        if (!isNaN(stopLoss) && stopLoss > 0) {
            const wrongSide = side === 'long' ? stopLoss >= entryPrice : stopLoss <= entryPrice;
            if (wrongSide) { showToast(`Stop-loss should be ${side === 'long' ? 'below' : 'above'} entry price for a ${side} position.`, 'error'); return; }
        }
        if (!isNaN(takeProfit) && takeProfit > 0) {
            const wrongSide = side === 'long' ? takeProfit <= entryPrice : takeProfit >= entryPrice;
            if (wrongSide) { showToast(`Take-profit should be ${side === 'long' ? 'above' : 'below'} entry price for a ${side} position.`, 'error'); return; }
        }

        futuresPositions.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            symbol, side, entryPrice, qty, leverage,
            stopLoss: !isNaN(stopLoss) && stopLoss > 0 ? stopLoss : null,
            takeProfit: !isNaN(takeProfit) && takeProfit > 0 ? takeProfit : null
        });
        localStorage.setItem('cw_futures_positions', JSON.stringify(futuresPositions));
        symbolInput.value = ''; entryInput.value = ''; qtyInput.value = ''; leverageInput.value = '10'; slInput.value = ''; tpInput.value = ''; unitInput.value = 'coins';
        document.getElementById('futures-qty-hint').innerText = '';
        renderFuturesPositions();
        showToast(`Added ${leverage}x ${side} ${symbol} position.`, 'success');
    });

    // ---------- Sound alerts ----------
    let audioCtx = null;