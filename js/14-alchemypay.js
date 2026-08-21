// ---------- Buy/Sell Crypto via AlchemyPay (fiat on/off-ramp widget) ----------
// AlchemyPay lets a person buy real crypto with a card/bank transfer, or sell real crypto back
// to fiat. It is NOT an exchange and cannot open or close a leveraged futures position — there
// is no "buy BTC 10x long" button on AlchemyPay's side, only "buy/sell the actual coin." So the
// Futures Positions panel wires its Fund/Cash Out buttons to the exact same widget: it's the
// on/off-ramp a person would use to move fiat into or out of the wallet they then trade futures
// from on their exchange of choice, not a way to place a leveraged order itself. That distinction
// is called out in the modal copy so it's never presented as something it isn't.
//
// Widget URL: AlchemyPay's "Page Integration" widget takes a signed query string (appId, crypto,
// network, a merchant-generated order number, and an HMAC-SHA256 'sign') — see
// server/src/server.js POST /api/alchemypay-widget-url, where that URL is built and signed. The
// AlchemyPay appSecret lives there only, never in this file or js/00-config.js.
//
// Completed-order detection: unlike a postMessage-based widget, AlchemyPay finishes an order by
// navigating the iframe to our own redirectUrl (ramp-return.html, same origin as this site) once
// the flow ends. That page immediately posts a message to us; we then ask our OWN backend
// (GET /api/alchemypay-order-status) to confirm the order with AlchemyPay's Query Order API
// rather than trusting the redirect alone, and only then log it to the signed-in visitor's
// account history in Supabase.

(function setupAlchemyPayWidget() {
    function resolveApiUrl(path) {
        const base = (CW_CONFIG.apiBaseUrl || '').replace(/\/$/, '');
        return /^https?:\/\//i.test(path) ? path : `${base}${path}`;
    }

    async function fetchAlchemyPayWidgetUrl(mode, cryptoSymbol) {
        const body = { mode, symbol: cryptoSymbol };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(resolveApiUrl('/api/alchemypay-widget-url'), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.widgetUrl) {
                throw new Error(data?.error || `Widget session request failed (${res.status})`);
            }
            return data; // { widgetUrl, merchantOrderNo, side }
        } finally {
            clearTimeout(timer);
        }
    }

    async function fetchAlchemyPayOrderStatus(orderNo, side) {
        const url = resolveApiUrl(`/api/alchemypay-order-status?orderNo=${encodeURIComponent(orderNo)}&side=${side}`);
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Order status request failed (${res.status})`);
        return data;
    }

    // Assets offered in the "change asset" dropdown: curated popular list, plus whatever the
    // person already holds or has open futures positions in, plus whatever's on-screen right now.
    function availableAssetList() {
        const set = new Set(POPULAR_COINS);
        holdings.forEach(h => set.add(h.symbol));
        futuresPositions.forEach(p => set.add(p.symbol));
        if (selectedAsset && selectedAsset.baseAsset) set.add(selectedAsset.baseAsset);
        return Array.from(set);
    }

    // ---------- Modal DOM (built once, reused for every open) ----------
    const backdrop = document.createElement('div');
    backdrop.id = 'alchemypay-modal';
    backdrop.className = 'cw-modal-backdrop';
    backdrop.innerHTML = `
        <div class="cw-modal-card" style="max-width:480px; padding:0; overflow-x:hidden;" role="dialog" aria-modal="true" aria-label="Buy or sell crypto">
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#1e222b]">
                <div class="flex items-center gap-2">
                    <h2 id="alchemypay-modal-title" class="text-sm font-bold text-white">Buy Crypto</h2>
                    <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">via AlchemyPay</span>
                </div>
                <button id="alchemypay-close-btn" class="text-gray-500 hover:text-white cursor-pointer text-lg leading-none">✕</button>
            </div>
            <div id="alchemypay-futures-note" class="hidden px-4 py-2 text-[10.5px] leading-snug text-amber-300 bg-amber-500/10 border-b border-amber-500/20">
                This funds/cashes out real spot crypto with fiat — it does not open or close a leveraged futures position. Move the funds to your exchange's futures wallet afterward.
            </div>
            <div id="alchemypay-signin-note" class="hidden px-4 py-2 text-[10.5px] leading-snug text-gray-400 bg-gray-800/40 border-b border-gray-800">
                You're not signed in, so this purchase won't be saved to a My Account history. <button id="alchemypay-signin-cta" type="button" class="text-[#14d38a] font-bold hover:underline cursor-pointer">Sign in first →</button>
            </div>
            <div class="px-4 py-2.5 border-b border-gray-800 bg-[#14161c] flex items-center gap-2">
                <label for="alchemypay-asset-select" class="text-[10px] text-gray-500 uppercase font-bold shrink-0">Asset</label>
                <select id="alchemypay-asset-select" class="w-full bg-gray-900 border border-gray-800 rounded text-[11px] px-2 py-1.5 text-gray-200 focus:outline-none focus:border-[#14d38a]"></select>
            </div>
            <div id="alchemypay-modal-body" style="min-height:200px;"></div>
        </div>`;
    document.body.appendChild(backdrop);

    const titleEl = document.getElementById('alchemypay-modal-title');
    const futuresNoteEl = document.getElementById('alchemypay-futures-note');
    const signinNoteEl = document.getElementById('alchemypay-signin-note');
    const assetSelect = document.getElementById('alchemypay-asset-select');
    const bodyEl = document.getElementById('alchemypay-modal-body');

    document.getElementById('alchemypay-signin-cta')?.addEventListener('click', () => {
        toggleModal(false);
        document.getElementById('auth-open-btn')?.click();
    });

    let currentMode = 'BUY';
    let activeIframe = null;
    let currentOrderNo = null;
    let currentSide = 'buy';

    // Bumped on every renderBody() call so a slow/late-arriving fetch from a previous open (or a
    // rapid asset/mode switch) can never overwrite what's currently on screen.
    let renderToken = 0;

    async function renderBody() {
        const myToken = ++renderToken;
        bodyEl.innerHTML = `
            <div class="p-5 text-center text-gray-500 text-xs">
                Starting a secure session…
            </div>`;
        activeIframe = null;
        currentOrderNo = null;

        const symbol = assetSelect.value || 'BTC';
        try {
            const { widgetUrl, merchantOrderNo, side } = await fetchAlchemyPayWidgetUrl(currentMode, symbol);
            if (myToken !== renderToken) return; // superseded by a newer open/switch
            currentOrderNo = merchantOrderNo;
            currentSide = side || (currentMode === 'SELL' ? 'sell' : 'buy');
            // Fixed 640px was taller than most phone screens (with the header/notes bars above it
            // also eating vertical space), pushing AlchemyPay's own Buy/Sell button below the
            // fold with no way to reach it. min(640px, 75dvh) keeps the desktop size but shrinks
            // to fit short mobile viewports; the modal card itself also scrolls now as a fallback
            // (see .cw-modal-card in styles.css).
            bodyEl.innerHTML = `<iframe id="alchemypay-iframe" title="AlchemyPay On/Off Ramp Widget" src="${widgetUrl}" allow="camera;microphone;payment" allowtransparency="true" referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:min(640px, 75vh);height:min(640px, 75dvh);border:0;display:block;"></iframe>`;
            activeIframe = document.getElementById('alchemypay-iframe');
        } catch (err) {
            if (myToken !== renderToken) return;
            console.error('[CryptoBolt] Failed to start AlchemyPay widget session:', err?.message || err);
            bodyEl.innerHTML = `
                <div class="p-5 text-center">
                    <p class="text-xs text-gray-300 mb-2">Couldn't start the Buy/Sell session.</p>
                    <p class="text-[10.5px] text-gray-500 leading-relaxed mb-3">${escapeHtml(err?.message || 'Please try again in a moment.')}</p>
                    <button id="alchemypay-retry-btn" type="button" class="inline-block text-[11px] px-3 py-1.5 rounded bg-[#14d38a] text-[#0b0e11] font-bold hover:opacity-90 transition-all cursor-pointer">Retry</button>
                </div>`;
            document.getElementById('alchemypay-retry-btn')?.addEventListener('click', renderBody);
        }
    }

    function populateAssetSelect(preset) {
        const assets = availableAssetList();
        assetSelect.innerHTML = assets.map(sym => `<option value="${escapeHtml(sym)}">${escapeHtml(sym)}</option>`).join('');
        if (preset && assets.includes(preset)) assetSelect.value = preset;
    }

    function toggleModal(show) {
        backdrop.classList.toggle('cw-visible', show);
        if (!show) { bodyEl.innerHTML = ''; activeIframe = null; currentOrderNo = null; } // drop the iframe when closed so a paused KYC/payment session doesn't linger
    }

    function openAlchemyPayWidget(mode, presetSymbol, opts = {}) {
        currentMode = mode === 'SELL' ? 'SELL' : 'BUY';
        titleEl.innerText = currentMode === 'BUY' ? 'Buy Crypto' : 'Sell Crypto';
        futuresNoteEl.classList.toggle('hidden', !opts.isFutures);
        signinNoteEl.classList.toggle('hidden', !!window.cwAuth?.getUser?.() || !window.cwAuth?.isConfigured?.());
        populateAssetSelect((presetSymbol || 'BTC').toUpperCase());
        renderBody();
        toggleModal(true);
    }
    window.openAlchemyPayWidget = openAlchemyPayWidget; // exposed for reuse (e.g. from a future coin-row quick action)

    assetSelect.addEventListener('change', renderBody);
    document.getElementById('alchemypay-close-btn').addEventListener('click', () => toggleModal(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) toggleModal(false); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop.classList.contains('cw-visible')) toggleModal(false);
    });

    // ---------- Capture completed real orders and save them to the signed-in account ----------
    // Recorded orders we've already saved this session, so a duplicate redirect/postMessage
    // never double-writes a purchase.
    const recordedOrderIds = new Set();

    // AlchemyPay's Query Order response shape (and even its status field) differs between onramp
    // (string statuses like "FINISHED") and offramp (numeric-string statuses like "4" for payment
    // success) — see https://alchemypay.readme.io/docs/query-order-2. Normalize both into one shape.
    function normalizeOrder(order, side) {
        if (!order) return null;
        if (side === 'sell') {
            const ok = order.status === '4' || order.status === 4;
            return {
                ok,
                cryptoAmount: Number(order.cryptoAmount ?? order.cryptoActualAmount),
                fiatAmount: Number(order.fiatAmount),
                symbol: String(order.crypto || '').toUpperCase(),
                fiatCurrency: String(order.fiat || 'USD').toUpperCase(),
                orderNo: order.orderNo || order.merchantOrderNo,
            };
        }
        const ok = order.status === 'FINISHED';
        return {
            ok,
            cryptoAmount: Number(order.cryptoQuantity),
            fiatAmount: Number(order.amount),
            symbol: String(order.crypto || '').toUpperCase(),
            fiatCurrency: String(order.fiat || 'USD').toUpperCase(),
            orderNo: order.orderNo || order.merchantOrderNo,
        };
    }

    async function recordCompletedOrder(merchantOrderNo, side) {
        if (!merchantOrderNo || recordedOrderIds.has(merchantOrderNo)) return;

        const client = window.cwAuth?.getClient?.();
        const user = window.cwAuth?.getUser?.();
        if (!client || !user) return; // guest checkout — nothing to attribute this to

        // The order can take a moment to settle on AlchemyPay's side right after the redirect
        // fires, so poll a few times before giving up rather than reporting failure prematurely.
        let normalized = null;
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                const raw = await fetchAlchemyPayOrderStatus(merchantOrderNo, side);
                normalized = normalizeOrder(raw, side);
                if (normalized?.ok) break;
            } catch (err) {
                console.warn('[CryptoBolt] AlchemyPay order status check failed:', err?.message || err);
            }
            if (attempt < 3) await new Promise(r => setTimeout(r, 4000));
        }

        if (!normalized?.ok) {
            console.warn('[CryptoBolt] AlchemyPay order not confirmed finished yet, skipping account save:', merchantOrderNo);
            return;
        }

        recordedOrderIds.add(merchantOrderNo);

        if (!normalized.symbol || !normalized.cryptoAmount || !normalized.fiatAmount) {
            console.warn('[CryptoBolt] AlchemyPay order payload missing expected fields, skipping save:', normalized);
            return;
        }

        const row = {
            user_id: user.id,
            side: side === 'sell' ? 'sell' : 'buy',
            symbol: normalized.symbol,
            crypto_amount: normalized.cryptoAmount,
            fiat_amount: normalized.fiatAmount,
            fiat_currency: normalized.fiatCurrency,
            price_usd: normalized.fiatAmount / normalized.cryptoAmount,
            provider: 'alchemypay',
            alchemypay_order_no: normalized.orderNo ? String(normalized.orderNo) : merchantOrderNo,
            status: 'completed',
        };

        try {
            const { error } = await client.from('purchases').insert(row);
            if (error) throw error;
            showToast(`Saved to your account: ${row.side === 'buy' ? 'bought' : 'sold'} ${normalized.cryptoAmount} ${normalized.symbol}.`, 'success');
        } catch (err) {
            console.error('[CryptoBolt] Failed to save purchase to Supabase:', err.message || err);
            showToast('Order completed, but saving it to your account failed — check My Account later.', 'error');
        }
    }

    // ramp-return.html (same origin, loaded inside the iframe once AlchemyPay's flow ends)
    // posts this message up to us so we know to go check the order's real status.
    window.addEventListener('message', (message) => {
        if (!activeIframe || message.source !== activeIframe.contentWindow) return;
        if (message?.data?.event_id === 'ALCHEMYPAY_ORDER_REDIRECT') {
            const orderNo = message.data.merchantOrderNo || currentOrderNo;
            const side = message.data.side || currentSide;
            if (orderNo) recordCompletedOrder(orderNo, side);
        }
    });

    // ---------- Button wiring ----------
    function currentChartSymbol() {
        return (selectedAsset && selectedAsset.baseAsset) || 'BTC';
    }
    function firstHoldingSymbol() {
        return (holdings[0] && holdings[0].symbol) || currentChartSymbol();
    }
    function firstFuturesSymbol() {
        return (futuresPositions[0] && futuresPositions[0].symbol) || currentChartSymbol();
    }

    document.getElementById('chart-buy-btn')?.addEventListener('click', () => openAlchemyPayWidget('BUY', currentChartSymbol()));
    document.getElementById('chart-sell-btn')?.addEventListener('click', () => openAlchemyPayWidget('SELL', currentChartSymbol()));

    document.getElementById('portfolio-buy-btn')?.addEventListener('click', () => openAlchemyPayWidget('BUY', firstHoldingSymbol()));
    document.getElementById('portfolio-sell-btn')?.addEventListener('click', () => openAlchemyPayWidget('SELL', firstHoldingSymbol()));

    document.getElementById('futures-buy-btn')?.addEventListener('click', () => openAlchemyPayWidget('BUY', firstFuturesSymbol(), { isFutures: true }));
    document.getElementById('futures-sell-btn')?.addEventListener('click', () => openAlchemyPayWidget('SELL', firstFuturesSymbol(), { isFutures: true }));
})();