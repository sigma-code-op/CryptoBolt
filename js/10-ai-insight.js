// ---------- AI Market Insight ----------
    // Two key modes, chosen per-visitor and remembered in localStorage:
    //  - 'own'   (default, classic BYOK): the visitor's Groq key lives only in their own
    //            browser's localStorage and is sent per-request to this app's backend
    //            (CW_CONFIG.aiInsightUrl) in the x-groq-key header. The backend uses it
    //            once and never stores it.
    //  - 'house': no key needed from the visitor — the request is sent with an
    //            x-use-house-key header instead, and the backend (if it has one
    //            configured) uses its own shared Groq key. Subject to a much stricter
    //            server-side rate limit than a personal key, since the deployment owner
    //            is paying for it.
    // If no key is available for the active mode, or the backend is unreachable, the
    // panel falls back to a clearly-labeled local, rule-based read.

    function getStoredApiKey() {
        return localStorage.getItem('cw_groq_api_key') || '';
    }

    function getAIKeyMode() {
        return localStorage.getItem('cw_ai_key_mode') === 'house' ? 'house' : 'own';
    }

    function setAIKeyMode(mode) {
        localStorage.setItem('cw_ai_key_mode', mode === 'house' ? 'house' : 'own');
    }

    function syncAIKeyUI() {
        const mode = getAIKeyMode();
        const hasKey = !!getStoredApiKey();
        const toggleBtn = document.getElementById('ai-key-toggle-btn');
        if (toggleBtn) {
            const ready = mode === 'house' || hasKey;
            toggleBtn.innerText = mode === 'house' ? '🤖 CryptoBolt Key ✓' : (hasKey ? '⚙ API Key ✓' : '⚙ API Key');
            toggleBtn.classList.toggle('text-[#14d38a]', ready);
            toggleBtn.classList.toggle('border-[#14d38a]/40', ready);
        }

        const ownBtn = document.getElementById('ai-key-mode-own');
        const houseBtn = document.getElementById('ai-key-mode-house');
        const ownRow = document.getElementById('ai-key-own-row');
        const houseRow = document.getElementById('ai-key-house-row');
        const activeCls = ['bg-[#a855f7]/20', 'text-[#c084fc]'];
        const inactiveCls = ['bg-gray-900', 'text-gray-500'];
        if (ownBtn && houseBtn) {
            ownBtn.classList.remove(...activeCls, ...inactiveCls);
            houseBtn.classList.remove(...activeCls, ...inactiveCls);
            ownBtn.classList.add(...(mode === 'own' ? activeCls : inactiveCls));
            houseBtn.classList.add(...(mode === 'house' ? activeCls : inactiveCls));
        }
        if (ownRow) ownRow.classList.toggle('hidden', mode !== 'own');
        if (houseRow) houseRow.classList.toggle('hidden', mode !== 'house');
    }

    document.getElementById('ai-key-toggle-btn').addEventListener('click', () => {
        const panel = document.getElementById('ai-key-panel');
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden') && getAIKeyMode() === 'own') {
            document.getElementById('ai-key-input').focus();
        }
    });

    document.getElementById('ai-key-mode-own')?.addEventListener('click', () => {
        setAIKeyMode('own');
        syncAIKeyUI();
    });

    document.getElementById('ai-key-mode-house')?.addEventListener('click', () => {
        setAIKeyMode('house');
        syncAIKeyUI();
        showToast("Using CryptoBolt's shared AI key — no setup needed.", 'info');
    });

    document.getElementById('ai-key-save-btn').addEventListener('click', () => {
        const input = document.getElementById('ai-key-input');
        const key = input.value.trim();
        if (!key) { showToast('Paste a valid Groq API key first.', 'error'); return; }
        localStorage.setItem('cw_groq_api_key', key);
        input.value = '';
        syncAIKeyUI();
        document.getElementById('ai-key-panel').classList.add('hidden');
        showToast('API key saved to this browser.', 'success');
    });

    document.getElementById('ai-key-clear-btn').addEventListener('click', () => {
        localStorage.removeItem('cw_groq_api_key');
        syncAIKeyUI();
        showToast('API key removed.', 'info');
    });

    syncAIKeyUI();

    // Ask the backend whether it actually has a house key configured. If not, hide that
    // option rather than let someone switch to it and hit a 503 on every request.
    (async function checkHouseKeyAvailability() {
        try {
            if (!CW_CONFIG.aiInsightUrl) return;
            const res = await fetch(resolveApiUrl('/api/health'));
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            if (!data?.houseKeyEnabled) {
                const houseBtn = document.getElementById('ai-key-mode-house');
                if (houseBtn) houseBtn.classList.add('hidden');
                if (getAIKeyMode() === 'house') {
                    setAIKeyMode('own');
                    syncAIKeyUI();
                }
            }
        } catch (e) {
            // Backend unreachable — leave the option as-is, the normal error handling in
            // requestBackendInsight() will surface the real problem if they try it.
        }
    })();

    function resetAIInsightPanel() {
        const label = document.getElementById('ai-asset-label');
        const body = document.getElementById('ai-insight-body');
        if (label) label.innerText = selectedAsset ? `— ${selectedAsset.baseAsset}/USDT (${selectedAsset.isFutures ? 'Futures' : 'Spot'})` : '';
        if (body) body.innerHTML = `<p class="text-gray-600 text-[11px]">Click "Analyze Selected Coin" for a plain-English read of ${selectedAsset ? selectedAsset.baseAsset + "'s" : "this asset's"} current setup — trend, momentum, live news &amp; sentiment research, and a volatility-aware trade plan structure.</p>`;
        renderInsightHistory();
    }

    function buildAIContextSummary() {
        if (!selectedAsset || cachedCandlesArray.length < 20) return null;
        const closes = cachedCandlesArray.map(c => c.close);
        const recent = closes.slice(-30);
        const ma7 = calculateSMA(cachedCandlesArray, 7);
        const ma25 = calculateSMA(cachedCandlesArray, 25);
        const rsi = calculateRSI(cachedCandlesArray, 14);
        const lastMa7 = ma7.length ? ma7[ma7.length - 1].value : null;
        const lastMa25 = ma25.length ? ma25[ma25.length - 1].value : null;
        const lastRsi = rsi.length ? rsi[rsi.length - 1].value : null;
        const recentHigh = Math.max(...cachedCandlesArray.slice(-60).map(c => c.high));
        const recentLow = Math.min(...cachedCandlesArray.slice(-60).map(c => c.low));

        // ---- Extra research signals, gathered so the backend can reason about market
        // structure rather than just the latest candle in isolation. Every field is
        // optional/nullable and named to match the backend's validateContext/buildUserPrompt
        // contract exactly — see server/src/server.js. ----

        // Volatility: ATR(14), plus the same value expressed as a % of price so it's
        // comparable across assets regardless of price scale.
        let atr14 = null, atrPct = null;
        try {
            const atr = calculateATR(cachedCandlesArray, 14);
            atr14 = atr.length ? atr[atr.length - 1].value : null;
            if (atr14 !== null && selectedAsset.price) atrPct = (atr14 / selectedAsset.price) * 100;
        } catch (e) { /* ATR is a nice-to-have, never block the read on it */ }

        // Multi-timeframe confluence: reuse the same cache the HUD badge already computed,
        // as long as it's for the currently-selected asset (avoids a stale read from a
        // previously-viewed asset leaking into this one).
        const mtf = (mtfTrendCache && mtfTrendCache.assetId === selectedAsset.id)
            ? mtfTrendCache.timeframes.map(t => ({ tf: t.tf, trend: t.trend, pct: Number.isFinite(t.pct) ? Number(t.pct.toFixed(2)) : 0 }))
            : null;

        // Volume trend, bucketed into the same three categories the backend prompt expects,
        // from the same "latest candle vs. recent average" comparison the HUD/local-calc use.
        let volumeTrend = null;
        try {
            const vols = cachedCandlesArray.slice(-10).map(c => c.volume).filter(v => typeof v === 'number');
            const prevVols = cachedCandlesArray.slice(-20, -10).map(c => c.volume).filter(v => typeof v === 'number');
            if (vols.length >= 5 && prevVols.length >= 5) {
                const avgRecent = vols.reduce((s, v) => s + v, 0) / vols.length;
                const avgPrior = prevVols.reduce((s, v) => s + v, 0) / prevVols.length;
                if (avgPrior > 0) {
                    const pct = ((avgRecent - avgPrior) / avgPrior) * 100;
                    volumeTrend = pct > 15 ? 'rising' : pct < -15 ? 'falling' : 'flat';
                }
            }
        } catch (e) { /* non-critical */ }

        // Funding rate only exists for perpetual futures — left null on spot, which is the
        // backend's cue to omit funding/positioning language entirely.
        const isFutures = !!selectedAsset.isFutures;
        const hasFunding = isFutures && lastFundingRatePct !== null && lastFundingNextMins !== null;

        return {
            asset: selectedAsset.baseAsset,
            market: isFutures ? 'perpetual futures' : 'spot',
            interval: currentInterval,
            price: selectedAsset.price,
            change24hPct: selectedAsset.changePct,
            high24h: selectedAsset.high,
            low24h: selectedAsset.low,
            volume24hUSDT: selectedAsset.volume,
            ma7: lastMa7,
            ma25: lastMa25,
            rsi14: lastRsi,
            atr14: atr14 !== null ? Number(atr14.toPrecision(6)) : null,
            atrPct: atrPct !== null ? Number(atrPct.toFixed(3)) : null,
            volumeTrend,
            mtf,
            fundingRatePct: hasFunding ? Number(lastFundingRatePct.toFixed(4)) : null,
            fundingNextMins: hasFunding ? lastFundingNextMins : null,
            recentSwingHigh: recentHigh,
            recentSwingLow: recentLow,
            recentClosesTrend: recent
        };
    }

    // Deterministic, rule-based read computed entirely client-side from data already on the page
    // (no AI model, no network call). Used whenever no key is saved, or the backend can't be
    // reached, so the panel still gives the person something useful — it's explicitly labeled
    // as non-AI wherever it's shown. Mirrors the same trend/momentum/outlook/confidence shape
    // the backend returns so the rendering code can treat both sources identically.
    function computeLocalTechnicalRead(ctx) {
        const closes = ctx.recentClosesTrend;
        const first = closes[0], last = closes[closes.length - 1];
        const netMovePct = first ? ((last - first) / first) * 100 : 0;
        const isFutures = ctx.market === 'perpetual futures';
        const research = []; // human-readable trail of what fed into the read, shown in "research" panel

        let trend = 'neutral';
        if (ctx.ma7 !== null && ctx.ma25 !== null) {
            if (ctx.ma7 > ctx.ma25 && netMovePct > 0.15) trend = 'bullish';
            else if (ctx.ma7 < ctx.ma25 && netMovePct < -0.15) trend = 'bearish';
        }
        research.push(`Base read from MA(7)/MA(25) crossover + net move on the visible window: ${trend}.`);

        // Multi-timeframe confluence can upgrade (or downgrade) the base read — a 1h signal
        // that disagrees with 4h/1d is treated as weaker than one where all three agree.
        let mtfAgreement = null;
        if (ctx.mtf && ctx.mtf.length) {
            const bullish = ctx.mtf.filter(t => t.trend === 'bullish').length;
            const bearish = ctx.mtf.filter(t => t.trend === 'bearish').length;
            mtfAgreement = bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'mixed';
            research.push(`Higher-timeframe check (1h/4h/1d): ${mtfAgreement}${mtfAgreement !== 'mixed' ? ` (${Math.max(bullish, bearish)}/${ctx.mtf.length} agree)` : ''}.`);
            if (trend === 'neutral' && mtfAgreement !== 'mixed') {
                trend = mtfAgreement; // let higher timeframes break a tie the short window couldn't resolve
                research.push(`Short window was inconclusive, so the higher-timeframe direction was used as the tiebreaker.`);
            }
        }

        let momentum = 'moderate';
        if (ctx.rsi14 !== null) {
            if (ctx.rsi14 >= 70 || ctx.rsi14 <= 30) momentum = 'strong';
            else if (ctx.rsi14 > 45 && ctx.rsi14 < 55) momentum = 'weak';
        }
        research.push(`RSI(14) = ${ctx.rsi14 !== null ? ctx.rsi14.toFixed(1) : 'n/a'} → momentum read as ${momentum}.`);

        if (ctx.atrPct !== null && ctx.atrPct !== undefined) {
            research.push(`ATR(14) ≈ ${ctx.atrPct.toFixed(2)}% of price — ${ctx.atrPct > 4 ? 'elevated volatility, expect wider swings' : ctx.atrPct < 1 ? 'unusually tight range' : 'normal range'} for position/stop sizing context.`);
        }
        if (ctx.volumeTrend) {
            research.push(`Recent volume is ${ctx.volumeTrend} vs. the prior window — ${ctx.volumeTrend === 'flat' ? 'roughly typical participation' : 'a notable shift in participation behind the move'}.`);
        }

        // Futures-only: funding rate sign is read as a crowding/positioning signal, never as a
        // directional price signal on its own — a very positive rate means longs are paying
        // shorts (crowded long, more prone to a long-squeeze on a dip), and vice versa.
        let fundingNote = '';
        if (isFutures && typeof ctx.fundingRatePct === 'number') {
            const r = ctx.fundingRatePct;
            if (r >= 0.03) fundingNote = `Funding is running hot and positive (${r.toFixed(4)}%), consistent with a crowded long positioning — a sharp move down can trigger cascading long liquidations, independent of the technical trend.`;
            else if (r <= -0.03) fundingNote = `Funding is meaningfully negative (${r.toFixed(4)}%), consistent with crowded short positioning — a sharp move up can trigger a short squeeze, independent of the technical trend.`;
            else fundingNote = `Funding is close to flat (${r.toFixed(4)}%), suggesting positioning isn't heavily skewed either way right now.`;
            research.push(`Perpetual funding rate: ${fundingNote}`);
        }

        const support = ctx.recentSwingLow;
        const resistance = ctx.recentSwingHigh;
        const rsiNote = ctx.rsi14 !== null
            ? (ctx.rsi14 >= 70 ? `RSI(14) reads ${ctx.rsi14.toFixed(1)}, in overbought territory.` : ctx.rsi14 <= 30 ? `RSI(14) reads ${ctx.rsi14.toFixed(1)}, in oversold territory.` : `RSI(14) reads ${ctx.rsi14.toFixed(1)}, a neutral level.`)
            : '';
        const maNote = (ctx.ma7 !== null && ctx.ma25 !== null)
            ? (ctx.ma7 > ctx.ma25 ? 'The short-term MA(7) sits above the longer MA(25).' : 'The short-term MA(7) sits below the longer MA(25).')
            : '';
        const mtfNote = mtfAgreement && mtfAgreement !== 'mixed' ? ` Higher timeframes (1h/4h/1d) are also reading ${mtfAgreement}.` : mtfAgreement === 'mixed' ? ` Higher timeframes are mixed, which tempers conviction in this read.` : '';

        // Signals "agreeing" (trend direction + RSI extremity + MTF confluence pointing the
        // same way) raises confidence in how clear the read is — this is NOT a confidence
        // that the outlook will come true, only that the indicators aren't contradicting each other.
        let agreement = 0;
        if (trend !== 'neutral') agreement++;
        if (momentum === 'strong') agreement++;
        if (Math.abs(netMovePct) > 1) agreement++;
        if (mtfAgreement && mtfAgreement === trend) agreement++;
        if (mtfAgreement === 'mixed') agreement = Math.max(0, agreement - 1);
        const confidence = agreement >= 3 ? 'high' : agreement >= 2 ? 'medium' : 'low';

        const marketCaveat = isFutures
            ? (fundingNote ? ` Positioning note: ${fundingNote}` : '')
            : ' As a spot read, this ignores leverage/funding dynamics entirely — those only apply to the futures market for this asset, if one exists.';

        const outlook = trend === 'bullish'
            ? `A continuation higher would likely need price to hold above the MA(7)/MA(25) area; a move back below recent support ($${support.toFixed ? support.toFixed(4) : support}) would call the short-term uptrend into question.${mtfNote}`
            : trend === 'bearish'
            ? `A continuation lower would likely need price to stay under the MA(7)/MA(25) area; a reclaim of recent resistance ($${resistance.toFixed ? resistance.toFixed(4) : resistance}) would call the short-term downtrend into question.${mtfNote}`
            : `Price is roughly balanced between recent support and resistance — a decisive move outside that range, in either direction, would be needed before a clearer trend could be read.${mtfNote}`;

        const reasoningSteps = [];
        if (trend !== 'neutral') reasoningSteps.push(`MA(7) vs MA(25) and net move both point ${trend}.`);
        if (mtfAgreement) reasoningSteps.push(`Higher timeframes read ${mtfAgreement}${mtfAgreement === trend ? ' — agrees with the base read.' : mtfAgreement === 'mixed' ? ' — no clean agreement.' : ' — disagrees with the base read.'}`);
        if (momentum === 'strong') reasoningSteps.push(`RSI(14) is at an extreme (${ctx.rsi14.toFixed(1)}), reinforcing momentum.`);
        else if (momentum === 'weak') reasoningSteps.push(`RSI(14) is near the midline (${ctx.rsi14.toFixed(1)}), a caution against the read.`);
        if (Math.abs(netMovePct) < 0.5) reasoningSteps.push(`Net move over the window is small (${netMovePct.toFixed(2)}%) — the base trend read is not strongly established.`);

        const keyRisk = trend === 'neutral'
            ? 'Price could break decisively out of this range in either direction before a trend is established.'
            : mtfAgreement === 'mixed' || mtfAgreement === null
            ? `A reversal back through ${trend === 'bullish' ? 'support' : 'resistance'} would invalidate this read, and higher-timeframe context isn't confirming it strongly.`
            : `A reversal back through ${trend === 'bullish' ? 'support' : 'resistance'} would invalidate this read.`;

        return {
            trend, momentum, support, resistance, outlook, confidence,
            summary: `Over the visible window, ${ctx.asset} moved ${netMovePct >= 0 ? '+' : ''}${netMovePct.toFixed(2)}% from the first close shown to the latest. ${maNote} ${rsiNote}${marketCaveat}`.trim(),
            research: research.join(' '),
            reasoningSteps,
            keyRisk,
            fundingContext: (isFutures && fundingNote) ? fundingNote : null,
            isLocalCalculation: true
        };
    }

    // ---------- Feature: AI Insight History ----------
    // Keeps the last few reads per asset in localStorage so a person can see how the read
    // changed over time, instead of only ever seeing the most recent one.
    const AI_HISTORY_MAX_PER_ASSET = 5;
    function getInsightHistory(assetId) {
        const all = safeJSONParse(localStorage.getItem('cw_ai_history'), {});
        return all[assetId] || [];
    }
    function pushInsightHistory(assetId, parsed) {
        const all = safeJSONParse(localStorage.getItem('cw_ai_history'), {});
        const list = all[assetId] || [];
        list.unshift({
            time: Date.now(),
            trend: parsed.trend,
            momentum: parsed.momentum,
            confidence: parsed.confidence || null,
            summary: parsed.summary,
            isLocalCalculation: !!parsed.isLocalCalculation
        });
        all[assetId] = list.slice(0, AI_HISTORY_MAX_PER_ASSET);
        try { localStorage.setItem('cw_ai_history', JSON.stringify(all)); } catch (e) { /* storage full or unavailable — history is best-effort */ }
    }
    function renderInsightHistory() {
        const container = document.getElementById('ai-history-list');
        if (!container) return;
        if (!selectedAsset) { container.innerHTML = ''; return; }
        const history = getInsightHistory(selectedAsset.id);
        if (history.length === 0) { container.innerHTML = '<p class="text-gray-600 text-[10px]">No past reads yet for this asset.</p>'; return; }
        container.innerHTML = history.map(h => {
            const trendColor = h.trend === 'bullish' ? 'text-[#14d38a]' : h.trend === 'bearish' ? 'text-[#ff4d6a]' : 'text-gray-400';
            const time = new Date(h.time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `<div class="border-b border-gray-800/60 last:border-0 py-1.5">
                <div class="flex items-center justify-between text-[9.5px] mb-0.5">
                    <span class="${trendColor} font-bold uppercase">${escapeHtml(h.trend)}${h.confidence ? ` · ${escapeHtml(h.confidence)} confidence` : ''}</span>
                    <span class="text-gray-600">${time}${h.isLocalCalculation ? ' · local calc' : ' · AI'}</span>
                </div>
                <p class="text-gray-500 text-[10px] leading-snug">${escapeHtml(h.summary)}</p>
            </div>`;
        }).join('');
    }
    document.getElementById('ai-history-toggle')?.addEventListener('click', () => {
        const list = document.getElementById('ai-history-list');
        const btn = document.getElementById('ai-history-toggle');
        const showing = !list.classList.contains('hidden');
        list.classList.toggle('hidden');
        btn.innerText = showing ? '📜 Show read history' : '📜 Hide read history';
        if (!showing) renderInsightHistory();
    });

    // ---------- Feature: Copy Snapshot ----------
    // Formats the current asset stats + latest read as plain text for pasting into a chat,
    // notes app, or Discord — no screenshot needed.
    let lastRenderedInsight = null;
    document.getElementById('ai-copy-snapshot-btn')?.addEventListener('click', async () => {
        if (!selectedAsset || !lastRenderedInsight) { showToast('Generate a read first.', 'error'); return; }
        const p = lastRenderedInsight.parsed;
        const ctx = lastRenderedInsight.ctx;
        const plan = computeTradePlan(ctx, p.trend, p);
        const lines = [
            `${ctx.asset}/USDT (${ctx.market}) — ${ctx.interval} chart`,
            `Price: $${ctx.price}  |  24h: ${ctx.change24hPct >= 0 ? '+' : ''}${ctx.change24hPct}%`,
            `Trend: ${p.trend}  |  Momentum: ${p.momentum}${p.confidence ? `  |  Confidence: ${p.confidence}` : ''}`,
            `Support ~$${p.support}  |  Resistance ~$${p.resistance}`,
            '',
            p.summary,
            p.outlook ? `Outlook: ${p.outlook}` : '',
            p.newsContext ? `News/sentiment: ${p.newsContext}` : '',
            '',
            plan.bias === 'no-clear-setup'
                ? 'Trade plan: no clear setup right now.'
                : `Trade plan (${plan.bias}, ${plan.setupType}): entry $${fmtPrice(plan.entryLow)}–$${fmtPrice(plan.entryHigh)}, stop $${fmtPrice(plan.invalidation)} (~${plan.stopMult?.toFixed(1)}× ATR), T1 $${fmtPrice(plan.target1)}${plan.rr ? ` (R:R ~1:${plan.rr.toFixed(1)})` : ''}, T2 $${fmtPrice(plan.target2)}${plan.rr2 ? ` (R:R ~1:${plan.rr2.toFixed(1)})` : ''}.`,
            p.catalystWatch ? `Watch: ${p.catalystWatch}` : '',
            '',
            `⚠️ ${p.isLocalCalculation ? 'Locally calculated technical read' : 'AI-generated read, backed by live news + sentiment research'} + volatility-aware trade structure — not financial advice, not personalized, can be wrong.`,
            `Generated ${new Date().toLocaleString()} via CryptoBolt`
        ].filter(Boolean);
        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            showToast('Snapshot copied to clipboard.', 'success');
        } catch (e) {
            showToast('Could not copy — your browser may be blocking clipboard access.', 'error');
        }
    });

    // Resolves a possibly-relative CW_CONFIG.aiInsightUrl against CW_CONFIG.apiBaseUrl.
    function resolveApiUrl(path) {
        const base = (CW_CONFIG.apiBaseUrl || '').replace(/\/$/, '');
        return /^https?:\/\//i.test(path) ? path : `${base}${path}`;
    }

    async function requestBackendInsight(ctx, apiKey, useHouseKey) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
            const headers = { 'content-type': 'application/json' };
            if (useHouseKey) {
                headers['x-use-house-key'] = '1';
            } else {
                headers['x-groq-key'] = apiKey;
            }
            const res = await fetch(resolveApiUrl(CW_CONFIG.aiInsightUrl), {
                method: 'POST',
                headers,
                body: JSON.stringify({ context: ctx }),
                signal: controller.signal
            });
            if (res.status === 401) throw new Error('Invalid API key — check the key you saved and try again.');
            if (res.status === 429) throw new Error('Rate limited — wait a moment and try again.');
            if (!res.ok) {
                const errBody = await res.json().catch(() => null);
                throw new Error(errBody?.error || `AI service responded with status ${res.status}`);
            }
            const data = await res.json();
            if (!data?.result) throw new Error('AI service returned an unexpected response.');
            // The backend now reasons in two passes — a free-text research pass, then a
            // structured synthesis pass grounded in it — with live news headlines and the
            // Fear & Greed index fetched server-side and fed into both passes. Attach all of
            // that onto the parsed object so the renderer can show it without changing its
            // call shape.
            return {
                ...data.result,
                research: data.research || null,
                sources: Array.isArray(data.sources) ? data.sources : [],
                fearGreed: data.fearGreed || null,
            };
        } finally {
            clearTimeout(timer);
        }
    }

    async function generateAIInsight() {
        if (aiInsightLoading) return;
        if (!selectedAsset) { showToast('Select an asset first.', 'error'); return; }

        const useHouseKey = getAIKeyMode() === 'house';
        const apiKey = getStoredApiKey();
        const body = document.getElementById('ai-insight-body');
        const ctx = buildAIContextSummary();
        if (!ctx) { showToast('Not enough chart data loaded yet — try again in a moment.', 'error'); return; }

        if (!useHouseKey && !apiKey) {
            const localRead = computeLocalTechnicalRead(ctx);
            renderAIInsight(localRead, ctx);
            return;
        }

        aiInsightLoading = true;
        const btn = document.getElementById('ai-generate-btn');
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        body.innerHTML = `<div class="flex items-center gap-2 text-gray-500 text-xs"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-[#a855f7]"></div>Researching ${ctx.asset}: technicals, live news, and market sentiment, then synthesizing a read...</div>`;

        try {
            if (!CW_CONFIG.aiInsightUrl) throw new Error('This app has no AI backend configured yet.');
            const parsed = await requestBackendInsight(ctx, apiKey, useHouseKey);
            renderAIInsight(parsed, ctx);
        } catch (err) {
            let msg;
            if (err && err.name === 'AbortError') {
                msg = 'Request timed out — try again.';
            } else if (err instanceof TypeError) {
                // Browsers throw a generic TypeError ("Failed to fetch"/"NetworkError") for both
                // a CORS rejection and a backend that simply isn't reachable — there's no way to
                // tell them apart from JS, so cover both possibilities plainly.
                msg = `Couldn't reach the AI backend at ${resolveApiUrl(CW_CONFIG.aiInsightUrl)}. Either it isn't running, or this page's origin (${window.location.origin}) isn't in the backend's ALLOWED_ORIGINS in .env.`;
            } else {
                msg = (err && err.message) || 'Unknown error contacting the AI service.';
            }
            body.innerHTML = `<p class="text-[#ff4d6a] text-[11px]">Couldn't generate an insight: ${msg}</p>`;
        } finally {
            aiInsightLoading = false;
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    // ---------- Trade plan structure (deterministic math, AI-informed shape) ----------
    // Every PRICE here is still pure math on real data — support/resistance from actual swing
    // points, and stop distance from ATR(14) — never a number the model invented. What the AI
    // (when available) now contributes is the STRUCTURE: which of 4 setup shapes fits the
    // evidence (setupType) and how wide the stop should be relative to current volatility
    // (stopATRMultiple), so the plan reflects real conditions instead of a fixed "5% of range"
    // guess. Without an AI read (local/offline mode), sane defaults stand in for both.
    function computeTradePlan(ctx, trend, ai) {
        const support = ctx.recentSwingLow;
        const resistance = ctx.recentSwingHigh;
        const range = resistance - support;
        const setupType = ai?.setupType || (trend === 'neutral' ? 'no-setup' : 'pullback-entry');

        if (!(range > 0) || trend === 'neutral' || setupType === 'no-setup') {
            return { bias: 'no-clear-setup', setupType: 'no-setup', support, resistance };
        }

        // ATR-based stop distance: falls back to a range-derived estimate if ATR wasn't
        // available for this asset/window, so the plan never breaks, just gets less precise.
        const atr = (typeof ctx.atr14 === 'number' && ctx.atr14 > 0) ? ctx.atr14 : range * 0.08;
        const stopMult = (typeof ai?.stopATRMultiple === 'number') ? ai.stopATRMultiple : 1.5;
        const stopDistance = atr * stopMult;

        const isBreakout = setupType === 'breakout-continuation';
        const isFade = setupType === 'range-fade';
        const bias = trend === 'bullish' ? 'long-leaning' : 'short-leaning';

        let entryLow, entryHigh, invalidation, target1, target2;
        if (trend === 'bullish') {
            if (isBreakout) {
                // Enter on strength near resistance, stop below it, project the range beyond.
                entryLow = resistance - range * 0.03;
                entryHigh = resistance + range * 0.02;
                invalidation = resistance - stopDistance;
                target1 = resistance + range * 0.4;
                target2 = resistance + range * 0.9;
            } else if (isFade) {
                entryLow = support;
                entryHigh = support + range * 0.12;
                invalidation = support - stopDistance;
                target1 = support + range * 0.5;
                target2 = resistance;
            } else { // pullback-entry (default)
                entryLow = support + range * 0.08;
                entryHigh = support + range * 0.3;
                invalidation = Math.min(support, entryLow) - stopDistance;
                target1 = support + range * 0.7;
                target2 = resistance;
            }
        } else {
            if (isBreakout) {
                entryLow = support - range * 0.02;
                entryHigh = support + range * 0.03;
                invalidation = support + stopDistance;
                target1 = support - range * 0.4;
                target2 = support - range * 0.9;
            } else if (isFade) {
                entryLow = resistance - range * 0.12;
                entryHigh = resistance;
                invalidation = resistance + stopDistance;
                target1 = resistance - range * 0.5;
                target2 = support;
            } else { // pullback-entry (default)
                entryLow = resistance - range * 0.3;
                entryHigh = resistance - range * 0.08;
                invalidation = Math.max(resistance, entryHigh) + stopDistance;
                target1 = resistance - range * 0.7;
                target2 = support;
            }
        }

        const entryMid = (entryLow + entryHigh) / 2;
        const risk = Math.abs(entryMid - invalidation);
        const reward1 = Math.abs(target1 - entryMid);
        const reward2 = Math.abs(target2 - entryMid);

        return {
            bias, setupType, entryLow, entryHigh, invalidation,
            target: target2, target1, target2, support, resistance,
            atr, stopMult,
            rr: risk > 0 ? reward1 / risk : null,
            rr2: risk > 0 ? reward2 / risk : null,
        };
    }

    function fmtPrice(n) {
        return Number(n).toLocaleString(undefined, priceFmt(n));
    }

    const SETUP_TYPE_LABELS = {
        'breakout-continuation': 'Breakout continuation',
        'pullback-entry': 'Pullback entry',
        'range-fade': 'Range fade',
    };

    function renderTradePlanCard(plan, ctx) {
        if (plan.bias === 'no-clear-setup') {
            return `<div class="mt-3 rounded-lg border cw-tradeplan-neutral p-3">
                <span class="text-[10.5px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5 mb-1.5">🎯 Trade plan structure</span>
                <p class="text-gray-500 text-[11px] leading-relaxed">Signals are too mixed (or a live catalyst makes technical structure unreliable right now) for a defensible setup, so none is shown — a plan built on an unclear read is worse than no plan at all.</p>
            </div>`;
        }
        const isLong = plan.bias === 'long-leaning';
        const cardClass = isLong ? 'cw-tradeplan-long' : 'cw-tradeplan-short';
        const biasLabel = isLong ? '▲ Long-leaning structure' : '▼ Short-leaning structure';
        const biasColor = isLong ? 'text-[#14d38a]' : 'text-[#ff4d6a]';
        const setupLabel = SETUP_TYPE_LABELS[plan.setupType] || 'Structured setup';

        // Position markers along a simple visual bar spanning invalidation → far target.
        const lo = Math.min(plan.invalidation, plan.target2);
        const hi = Math.max(plan.invalidation, plan.target2);
        const span = hi - lo || 1;
        const pct = (v) => Math.max(2, Math.min(98, ((v - lo) / span) * 100));

        return `<div class="mt-3 rounded-lg border ${cardClass} p-3">
            <div class="flex items-center justify-between mb-2 flex-wrap gap-1">
                <span class="text-[10.5px] font-bold uppercase tracking-wide ${biasColor} flex items-center gap-1.5">🎯 Trade plan structure</span>
                <span class="${biasColor} text-[10.5px] font-bold">${biasLabel} · ${setupLabel}</span>
            </div>
            <div class="cw-level-bar my-4 mx-1">
                <div class="cw-level-marker" style="left:${pct(plan.invalidation)}%; background:#ff4d6a;" title="Stop / invalidation"></div>
                <div class="cw-level-marker" style="left:${pct((plan.entryLow + plan.entryHigh) / 2)}%; background:#e5b324;" title="Entry zone"></div>
                <div class="cw-level-marker" style="left:${pct(ctx.price)}%; background:#3b82f6;" title="Current price"></div>
                <div class="cw-level-marker" style="left:${pct(plan.target1)}%; background:#7dd3a8;" title="Target 1"></div>
                <div class="cw-level-marker" style="left:${pct(plan.target2)}%; background:#14d38a;" title="Target 2"></div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
                <div class="bg-gray-900/50 rounded px-2 py-1.5">
                    <div class="text-gray-600 text-[9px] uppercase mb-0.5">Entry zone</div>
                    <div class="text-amber-300">$${fmtPrice(plan.entryLow)} – $${fmtPrice(plan.entryHigh)}</div>
                </div>
                <div class="bg-gray-900/50 rounded px-2 py-1.5">
                    <div class="text-gray-600 text-[9px] uppercase mb-0.5">Stop (~${plan.stopMult ? plan.stopMult.toFixed(1) : '1.5'}× ATR)</div>
                    <div class="text-[#ff4d6a]">$${fmtPrice(plan.invalidation)}</div>
                </div>
                <div class="bg-gray-900/50 rounded px-2 py-1.5">
                    <div class="text-gray-600 text-[9px] uppercase mb-0.5">Target 1 <span class="text-gray-600">${plan.rr ? `(1:${plan.rr.toFixed(1)})` : ''}</span></div>
                    <div class="text-[#7dd3a8]">$${fmtPrice(plan.target1)}</div>
                </div>
                <div class="bg-gray-900/50 rounded px-2 py-1.5">
                    <div class="text-gray-600 text-[9px] uppercase mb-0.5">Target 2 <span class="text-gray-600">${plan.rr2 ? `(1:${plan.rr2.toFixed(1)})` : ''}</span></div>
                    <div class="text-[#14d38a]">$${fmtPrice(plan.target2)}</div>
                </div>
            </div>
            <p class="text-gray-500 text-[9.5px] mt-2.5 leading-relaxed">Every price here is plain math — support/resistance from real swing points, stop distance from live ATR(14) volatility — never an AI-invented number. The AI only chooses the setup shape (${setupLabel.toLowerCase()}) and stop width given current volatility and news; a common approach is taking partial profit at Target 1 and trailing the rest toward Target 2. Not personalized risk advice — size any position to your own risk tolerance.</p>
        </div>`;
    }

    function renderAIInsight(parsed, ctx) {
        const body = document.getElementById('ai-insight-body');
        const trendColor = parsed.trend === 'bullish' ? 'text-[#14d38a] bg-[#14d38a]/10 border-[#14d38a]/30' : parsed.trend === 'bearish' ? 'text-[#ff4d6a] bg-[#ff4d6a]/10 border-[#ff4d6a]/30' : 'text-gray-300 bg-gray-800 border-gray-700';
        const momentumColor = parsed.momentum === 'strong' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-gray-300 bg-gray-800 border-gray-700';
        const confidenceColor = parsed.confidence === 'high' ? 'text-[#14d38a] bg-[#14d38a]/10 border-[#14d38a]/30' : parsed.confidence === 'low' ? 'text-gray-400 bg-gray-800 border-gray-700' : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

        const sourceBanner = parsed.isLocalCalculation
            ? `<div class="mb-3 px-3 py-2 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10.5px] leading-relaxed flex gap-2">
                 <span>⚠️</span>
                 <span><strong>Not AI-generated.</strong> No API key is set, so this reading was calculated directly by this page's own code from RSI/moving-average math — not by an AI model, and with no live news or sentiment research. Add an API key above for an AI-generated read backed by live internet research.</span>
               </div>`
            : `<div class="mb-3 px-3 py-2 rounded border border-[#a855f7]/30 bg-[#a855f7]/10 text-[#c084fc] text-[10.5px] leading-relaxed flex gap-2">
                 <span>🤖</span>
                 <span>AI-generated read from Llama (via Groq) — grounded in live indicators below, plus live news headlines and market sentiment researched server-side for this request.</span>
               </div>`;

        const outlookBlock = parsed.outlook ? `
            <div class="mt-3 rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-3">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="text-[10.5px] font-bold uppercase tracking-wide text-amber-300 flex items-center gap-1.5">🔮 Next-move outlook</span>
                    ${parsed.confidence ? `<span class="text-[9.5px] font-bold uppercase px-2 py-0.5 rounded border ${confidenceColor}">${escapeHtml(parsed.confidence)} confidence</span>` : ''}
                </div>
                <p class="text-gray-300 text-[11.5px] leading-relaxed">${escapeHtml(parsed.outlook)}</p>
                <p class="text-amber-400/80 text-[9px] mt-2 leading-relaxed">⚠️ This is a conditional technical scenario, not a price prediction or a guarantee. Markets can and do move against any read like this.</p>
            </div>` : '';

        const reasoningBlock = (Array.isArray(parsed.reasoningSteps) && parsed.reasoningSteps.length) ? `
            <div class="mt-3 rounded-lg border border-gray-800 bg-gray-900/40 p-3">
                <span class="text-[10.5px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5 mb-1.5">⚖️ For / against this read</span>
                <ul class="space-y-1">
                    ${parsed.reasoningSteps.map(step => `<li class="text-gray-400 text-[10.5px] leading-snug flex gap-1.5"><span class="text-gray-600">·</span>${escapeHtml(step)}</li>`).join('')}
                </ul>
            </div>` : '';

        const keyRiskBlock = parsed.keyRisk ? `
            <p class="mt-2.5 px-3 py-2 rounded border border-[#ff4d6a]/25 bg-[#ff4d6a]/5 text-gray-400 text-[10.5px] leading-relaxed"><strong class="text-[#ff4d6a]/90">Most likely way this read is wrong:</strong> ${escapeHtml(parsed.keyRisk)}</p>` : '';

        const fundingContextBlock = (ctx.market === 'perpetual futures' && parsed.fundingContext) ? `
            <p class="mt-2.5 px-3 py-2 rounded border border-amber-500/25 bg-amber-500/5 text-amber-200/90 text-[10.5px] leading-relaxed"><strong>Positioning:</strong> ${escapeHtml(parsed.fundingContext)}</p>` : '';

        const newsContextBlock = parsed.newsContext ? `
            <p class="mt-2.5 px-3 py-2 rounded border border-[#4fd8e8]/25 bg-[#4fd8e8]/5 text-gray-300 text-[10.5px] leading-relaxed"><strong class="text-[#4fd8e8]">📰 News & sentiment:</strong> ${escapeHtml(parsed.newsContext)}</p>` : '';

        const catalystBlock = parsed.catalystWatch ? `
            <p class="mt-2.5 px-3 py-2 rounded border border-amber-500/25 bg-amber-500/5 text-amber-200/90 text-[10.5px] leading-relaxed"><strong>👀 Watch:</strong> ${escapeHtml(parsed.catalystWatch)}</p>` : '';

        const sourcesBlock = (Array.isArray(parsed.sources) && parsed.sources.length) ? `
            <details class="mt-3 rounded-lg border border-gray-800 bg-gray-900/40 group">
                <summary class="cursor-pointer list-none px-3 py-2 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wide text-gray-400">
                    <span class="flex items-center gap-1.5">📰 Headlines checked (last 72h)</span>
                    <span class="text-[9px] text-gray-500 font-normal normal-case group-open:hidden">Show</span>
                    <span class="text-[9px] text-gray-500 font-normal normal-case hidden group-open:inline">Hide</span>
                </summary>
                <ul class="px-3 pb-3 space-y-1">
                    ${parsed.sources.map(s => `<li class="text-gray-500 text-[10px] leading-snug flex gap-1.5"><span class="text-gray-700">·</span><span>${escapeHtml(s.title)} <span class="text-gray-700">— ${escapeHtml(s.source)}, ${s.hoursAgo}h ago</span></span></li>`).join('')}
                </ul>
            </details>` : '';

        const fearGreedBadge = (parsed.fearGreed && typeof parsed.fearGreed.value === 'number') ? `
            <span class="text-[10px] font-mono px-2 py-1 rounded border border-gray-800 text-gray-400">Fear &amp; Greed ${parsed.fearGreed.value}/100 (${escapeHtml(parsed.fearGreed.classification || '')})</span>` : '';

        const researchBlock = parsed.research ? `
            <details class="mt-3 rounded-lg border border-[#4fd8e8]/25 bg-[#4fd8e8]/5 group">
                <summary class="cursor-pointer list-none px-3 py-2 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wide text-[#4fd8e8]">
                    <span class="flex items-center gap-1.5">🔍 Research trail — what was weighed before this read</span>
                    <span class="text-[9px] text-gray-500 font-normal normal-case group-open:hidden">Show</span>
                    <span class="text-[9px] text-gray-500 font-normal normal-case hidden group-open:inline">Hide</span>
                </summary>
                <p class="text-gray-400 text-[10.5px] leading-relaxed px-3 pb-3">${escapeHtml(parsed.research)}</p>
            </details>` : '';

        const tradePlan = computeTradePlan(ctx, parsed.trend, parsed);
        const tradePlanBlock = renderTradePlanCard(tradePlan, ctx);

        body.innerHTML = `
            ${sourceBanner}
            <div class="flex flex-wrap items-center gap-2 mb-3">
                <span class="text-[10px] font-bold uppercase px-2 py-1 rounded border ${trendColor}">Trend: ${escapeHtml(parsed.trend)}</span>
                <span class="text-[10px] font-bold uppercase px-2 py-1 rounded border ${momentumColor}">Momentum: ${escapeHtml(parsed.momentum)}</span>
                <span class="text-[10px] font-mono px-2 py-1 rounded border border-gray-800 text-gray-400">Support ~$${Number(parsed.support).toLocaleString(undefined, priceFmt(parsed.support))}</span>
                <span class="text-[10px] font-mono px-2 py-1 rounded border border-gray-800 text-gray-400">Resistance ~$${Number(parsed.resistance).toLocaleString(undefined, priceFmt(parsed.resistance))}</span>
                ${ctx.market === 'perpetual futures' && typeof ctx.fundingRatePct === 'number' ? `<span class="text-[10px] font-mono px-2 py-1 rounded border ${ctx.fundingRatePct >= 0 ? 'border-[#14d38a]/30 text-[#14d38a]' : 'border-[#ff4d6a]/30 text-[#ff4d6a]'}">Funding ${ctx.fundingRatePct >= 0 ? '+' : ''}${ctx.fundingRatePct.toFixed(4)}%</span>` : ''}
                ${fearGreedBadge}
            </div>
            <p class="text-gray-300 text-[12px] leading-relaxed">${escapeHtml(parsed.summary)}</p>
            ${outlookBlock}
            ${fundingContextBlock}
            ${newsContextBlock}
            ${catalystBlock}
            ${reasoningBlock}
            ${keyRiskBlock}
            ${researchBlock}
            ${sourcesBlock}
            ${tradePlanBlock}
            <p class="text-gray-600 text-[9px] mt-3">Based on ${escapeHtml(ctx.interval)} chart data for ${escapeHtml(ctx.asset)} (${ctx.market}) as of ${new Date().toLocaleTimeString(undefined, { hour12: false })}.</p>
            <p class="mt-3 px-3 py-2.5 rounded border border-red-500/20 bg-red-500/5 text-gray-400 text-[9.5px] leading-relaxed">🚫 <strong class="text-gray-300">Not financial advice, not personalized to you, and can be wrong.</strong> ${parsed.isLocalCalculation ? 'This is a locally calculated technical summary' : 'This is an automated AI technical read'}, plus a rule-based illustrative trade structure — none of it knows your risk tolerance, position size, or portfolio. Always do your own research and consider your own risk before trading.</p>
        `;

        lastRenderedInsight = { parsed, ctx, assetId: selectedAsset ? selectedAsset.id : null };
        if (typeof updateChartOverlayLines === 'function') updateChartOverlayLines();
        pushInsightHistory(selectedAsset.id, parsed);
        renderInsightHistory();
    }

    document.getElementById('ai-generate-btn').addEventListener('click', generateAIInsight);