// ---------- Buy/Sell Crypto via Transak (fiat on/off-ramp widget) ----------
// Transak lets a person buy real crypto with a card/bank transfer, or sell real crypto back
// to fiat. It is NOT an exchange and cannot open or close a leveraged futures position — there
// is no "buy BTC 10x long" button on Transak's side, only "buy/sell the actual coin." So the
// Futures Positions panel wires its Fund/Cash Out buttons to the exact same widget: it's the
// on/off-ramp a person would use to move fiat into or out of the wallet they then trade futures
// from on their exchange of choice, not a way to place a leveraged order itself. That distinction
// is called out in the modal copy so it's never presented as something it isn't.
//
// Account tracking: when a signed-in visitor completes a real order, the widget posts a
// TRANSAK_ORDER_SUCCESSFUL message to this page (standard Transak iframe embed behavior — see
// https://docs.transak.com/integration/web/iframe). We catch that and write one row to Supabase
// so the order shows up in their "My Account" purchase history. CryptoBolt never touches the
// actual money or crypto — Transak moves it directly to the buyer's own wallet; this is purely
// a receipt log. If nobody's signed in, the purchase still goes through, it's just not saved
// anywhere on our side.
//
// Widget URL: Transak now requires the iframe src to be a short-lived, single-use widgetUrl
// minted by a backend call (their old "put params straight in the URL" method is deprecated and
// gets a hard 403). See server/src/server.js POST /api/transak-widget-url — the API secret lives
// there only, never in this file or js/00-config.js.

(function setupTransakWidget() {
    // Transak deprecated embedding widget params directly in the iframe URL — it now hard-403s
    // that (with an X-Frame-Options: sameorigin block on the resulting error page). The widget
    // URL must be minted server-side per request via our own backend, which holds the Transak
    // API secret and calls Transak's Create Widget URL API. See server/src/server.js for the
    // POST /api/transak-widget-url endpoint. Each returned widgetUrl is single-use and expires
    // in 5 minutes, so we fetch a fresh one every time the modal opens or the asset/mode changes
    // — never cached or reused.
    function resolveApiUrl(path) {
        const base = (CW_CONFIG.apiBaseUrl || '').replace(/\/$/, '');
        return /^https?:\/\//i.test(path) ? path : `${base}${path}`;
    }

    async function fetchTransakWidgetUrl(mode, cryptoSymbol) {
        const body = { mode, symbol: cryptoSymbol };
        const user = window.cwAuth?.getUser?.();
        if (user) body.partnerCustomerId = user.id;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(resolveApiUrl('/api/transak-widget-url'), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.widgetUrl) {
                throw new Error(data?.error || `Widget session request failed (${res.status})`);
            }
            return data.widgetUrl;
        } finally {
            clearTimeout(timer);
        }
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
    backdrop.id = 'transak-modal';
    backdrop.className = 'cw-modal-backdrop';
    backdrop.innerHTML = `
        <div class="cw-modal-card" style="max-width:480px; padding:0; overflow:hidden;" role="dialog" aria-modal="true" aria-label="Buy or sell crypto">
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#1e222b]">
                <div class="flex items-center gap-2">
                    <h2 id="transak-modal-title" class="text-sm font-bold text-white">Buy Crypto</h2>
                    <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">via Transak</span>
                </div>
                <button id="transak-close-btn" class="text-gray-500 hover:text-white cursor-pointer text-lg leading-none">✕</button>
            </div>
            <div id="transak-futures-note" class="hidden px-4 py-2 text-[10.5px] leading-snug text-amber-300 bg-amber-500/10 border-b border-amber-500/20">
                This funds/cashes out real spot crypto with fiat — it does not open or close a leveraged futures position. Move the funds to your exchange's futures wallet afterward.
            </div>
            <div id="transak-signin-note" class="hidden px-4 py-2 text-[10.5px] leading-snug text-gray-400 bg-gray-800/40 border-b border-gray-800">
                You're not signed in, so this purchase won't be saved to a My Account history. <button id="transak-signin-cta" type="button" class="text-[#14d38a] font-bold hover:underline cursor-pointer">Sign in first →</button>
            </div>
            <div class="px-4 py-2.5 border-b border-gray-800 bg-[#14161c] flex items-center gap-2">
                <label for="transak-asset-select" class="text-[10px] text-gray-500 uppercase font-bold shrink-0">Asset</label>
                <select id="transak-asset-select" class="w-full bg-gray-900 border border-gray-800 rounded text-[11px] px-2 py-1.5 text-gray-200 focus:outline-none focus:border-[#14d38a]"></select>
            </div>
            <div id="transak-modal-body" style="min-height:200px;"></div>
        </div>`;
    document.body.appendChild(backdrop);

    const titleEl = document.getElementById('transak-modal-title');
    const futuresNoteEl = document.getElementById('transak-futures-note');
    const signinNoteEl = document.getElementById('transak-signin-note');
    const assetSelect = document.getElementById('transak-asset-select');
    const bodyEl = document.getElementById('transak-modal-body');

    document.getElementById('transak-signin-cta')?.addEventListener('click', () => {
        toggleModal(false);
        document.getElementById('auth-open-btn')?.click();
    });

    let currentMode = 'BUY';
    let activeIframe = null;

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

        const symbol = assetSelect.value || 'BTC';
        try {
            const widgetUrl = await fetchTransakWidgetUrl(currentMode, symbol);
            if (myToken !== renderToken) return; // superseded by a newer open/switch
            bodyEl.innerHTML = `<iframe id="transak-iframe" src="${widgetUrl}" allow="camera;microphone;payment" referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:640px;border:0;display:block;"></iframe>`;
            activeIframe = document.getElementById('transak-iframe');
        } catch (err) {
            if (myToken !== renderToken) return;
            console.error('[CryptoBolt] Failed to start Transak widget session:', err?.message || err);
            bodyEl.innerHTML = `
                <div class="p-5 text-center">
                    <p class="text-xs text-gray-300 mb-2">Couldn't start the Buy/Sell session.</p>
                    <p class="text-[10.5px] text-gray-500 leading-relaxed mb-3">${escapeHtml(err?.message || 'Please try again in a moment.')}</p>
                    <button id="transak-retry-btn" type="button" class="inline-block text-[11px] px-3 py-1.5 rounded bg-[#14d38a] text-[#0b0e11] font-bold hover:opacity-90 transition-all cursor-pointer">Retry</button>
                </div>`;
            document.getElementById('transak-retry-btn')?.addEventListener('click', renderBody);
        }
    }

    function populateAssetSelect(preset) {
        const assets = availableAssetList();
        assetSelect.innerHTML = assets.map(sym => `<option value="${escapeHtml(sym)}">${escapeHtml(sym)}</option>`).join('');
        if (preset && assets.includes(preset)) assetSelect.value = preset;
    }

    function toggleModal(show) {
        backdrop.classList.toggle('cw-visible', show);
        if (!show) { bodyEl.innerHTML = ''; activeIframe = null; } // drop the iframe when closed so a paused KYC/payment session doesn't linger
    }

    function openTransakWidget(mode, presetSymbol, opts = {}) {
        currentMode = mode === 'SELL' ? 'SELL' : 'BUY';
        titleEl.innerText = currentMode === 'BUY' ? 'Buy Crypto' : 'Sell Crypto';
        futuresNoteEl.classList.toggle('hidden', !opts.isFutures);
        signinNoteEl.classList.toggle('hidden', !!window.cwAuth?.getUser?.() || !window.cwAuth?.isConfigured?.());
        populateAssetSelect((presetSymbol || 'BTC').toUpperCase());
        renderBody();
        toggleModal(true);
    }
    window.openTransakWidget = openTransakWidget; // exposed for reuse (e.g. from a future coin-row quick action)

    assetSelect.addEventListener('change', renderBody);
    document.getElementById('transak-close-btn').addEventListener('click', () => toggleModal(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) toggleModal(false); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop.classList.contains('cw-visible')) toggleModal(false);
    });

    // ---------- Capture completed real orders and save them to the signed-in account ----------
    // Recorded orders we've already saved this session, so a duplicate postMessage (Transak can
    // fire status updates more than once as an order settles) never double-writes a purchase.
    const recordedOrderIds = new Set();

    async function recordCompletedOrder(orderData) {
        const orderId = orderData?.id || orderData?.orderId || orderData?.status?.id;
        if (orderId && recordedOrderIds.has(orderId)) return;
        if (orderId) recordedOrderIds.add(orderId);

        const client = window.cwAuth?.getClient?.();
        const user = window.cwAuth?.getUser?.();
        if (!client || !user) return; // guest checkout — nothing to attribute this to

        const cryptoAmount = Number(orderData?.cryptoAmount ?? orderData?.status?.cryptoAmount);
        const fiatAmount = Number(orderData?.fiatAmount ?? orderData?.status?.fiatAmount);
        const symbol = String(orderData?.cryptoCurrency ?? orderData?.status?.cryptoCurrency ?? '').toUpperCase();
        if (!symbol || !cryptoAmount || !fiatAmount) {
            console.warn('[CryptoBolt] TRANSAK_ORDER_SUCCESSFUL payload missing expected fields, skipping save:', orderData);
            return;
        }

        const row = {
            user_id: user.id,
            side: currentMode === 'SELL' ? 'sell' : 'buy',
            symbol,
            crypto_amount: cryptoAmount,
            fiat_amount: fiatAmount,
            fiat_currency: String(orderData?.fiatCurrency ?? orderData?.status?.fiatCurrency ?? 'USD').toUpperCase(),
            price_usd: fiatAmount / cryptoAmount,
            provider: 'transak',
            transak_order_id: orderId ? String(orderId) : null,
            wallet_address: orderData?.walletAddress ?? orderData?.status?.walletAddress ?? null,
            status: 'completed',
        };

        try {
            const { error } = await client.from('purchases').insert(row);
            if (error) throw error;
            showToast(`Saved to your account: ${row.side === 'buy' ? 'bought' : 'sold'} ${cryptoAmount} ${symbol}.`, 'success');
        } catch (err) {
            console.error('[CryptoBolt] Failed to save purchase to Supabase:', err.message || err);
            showToast('Order completed, but saving it to your account failed — check My Account later.', 'error');
        }
    }

    window.addEventListener('message', (message) => {
        if (!activeIframe || message.source !== activeIframe.contentWindow) return;
        const eventId = message?.data?.event_id;
        if (eventId === 'TRANSAK_ORDER_SUCCESSFUL') {
            recordCompletedOrder(message.data.data);
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

    document.getElementById('chart-buy-btn')?.addEventListener('click', () => openTransakWidget('BUY', currentChartSymbol()));
    document.getElementById('chart-sell-btn')?.addEventListener('click', () => openTransakWidget('SELL', currentChartSymbol()));

    document.getElementById('portfolio-buy-btn')?.addEventListener('click', () => openTransakWidget('BUY', firstHoldingSymbol()));
    document.getElementById('portfolio-sell-btn')?.addEventListener('click', () => openTransakWidget('SELL', firstHoldingSymbol()));

    document.getElementById('futures-buy-btn')?.addEventListener('click', () => openTransakWidget('BUY', firstFuturesSymbol(), { isFutures: true }));
    document.getElementById('futures-sell-btn')?.addEventListener('click', () => openTransakWidget('SELL', firstFuturesSymbol(), { isFutures: true }));
})();