// ---------- My Account page logic ----------
// Reads the signed-in visitor's real purchase history from Supabase (written by
// js/14-alchemypay.js whenever an AlchemyPay order completes) and renders holdings + P&L + order
// history. This page is entirely dependent on js/17-auth.js having already set up
// window.cwAuth — it reacts to the 'cw:auth' event rather than assuming a load order.

(function () {
    function fmtUsd(n, opts) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        return `$${n.toLocaleString(undefined, opts || { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    function fmtSigned(n) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        return `${n >= 0 ? '+' : ''}${fmtUsd(n)}`;
    }
    function fmtQty(n) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
    }
    function priceFmt(price) {
        return price < 1 ? { minimumFractionDigits: 4, maximumFractionDigits: 6 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    }
    function pnlColorClass(n) {
        if (n === null || n === undefined || isNaN(n) || n === 0) return 'text-gray-400';
        return n > 0 ? 'text-[#14d38a]' : 'text-[#ff4d6a]';
    }
    const ESCAPE_HTML_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_HTML_MAP[ch]);
    }
    function showToast(message, tone = 'info') {
        const toneMap = { success: { color: 'var(--cw-green)', icon: '✓' }, error: { color: 'var(--cw-red)', icon: '✕' }, info: { color: 'var(--cw-cyan)', icon: 'ℹ' } };
        const { color, icon } = toneMap[tone] || toneMap.info;
        const el = document.createElement('div');
        el.className = 'toast-enter cw-toast rounded-lg pr-4 py-2.5 text-xs shadow-2xl max-w-xs border border-gray-800';
        el.style.setProperty('--cw-tone', color);
        el.innerHTML = `<span class="cw-toast-icon text-[13px]">${icon}</span><span class="font-mono leading-snug pt-px" style="color:${color}">${escapeHtml(message)}</span>`;
        document.getElementById('toast-container').appendChild(el);
        setTimeout(() => { el.style.transition = 'opacity 0.4s, transform 0.4s'; el.style.opacity = '0'; el.style.transform = 'translateX(16px)'; setTimeout(() => el.remove(), 400); }, 4500);
    }

    const signedOutPanel = document.getElementById('signed-out-panel');
    const notConfiguredPanel = document.getElementById('not-configured-panel');
    const dashboard = document.getElementById('account-dashboard');

    document.getElementById('signed-out-signin-btn')?.addEventListener('click', () => {
        document.getElementById('auth-open-btn')?.click();
    });

    let purchases = [];
    let priceMap = {};

    async function fetchWithTimeout(url, ms = 9000) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms);
        try { return await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); }
    }

    async function fetchLivePrices(symbols) {
        if (symbols.length === 0) return;
        try {
            const pairs = symbols.map(s => `${s}USDT`);
            const symbolsParam = encodeURIComponent(JSON.stringify(pairs));
            const res = await fetchWithTimeout(`https://api.binance.com/api/v3/ticker/price?symbols=${symbolsParam}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const arr = await res.json();
            if (Array.isArray(arr)) {
                arr.forEach(row => {
                    if (row.symbol && row.symbol.endsWith('USDT')) priceMap[row.symbol.replace('USDT', '')] = parseFloat(row.price) || 0;
                });
            }
        } catch (err) {
            console.warn('[CryptoBolt] Live price fetch failed:', err.message);
        }
    }

    function computeHoldings() {
        // Aggregate buy/sell rows per symbol with a running weighted-average cost basis, in
        // chronological order, so realized P&L on sells is computed against the correct avgCost.
        const bySymbol = {}; // symbol -> { qty, avgCost, spent, sold, realized }
        let totalSpent = 0, totalSold = 0, totalRealized = 0;

        const chronological = purchases.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        chronological.forEach(p => {
            const sym = p.symbol;
            if (!bySymbol[sym]) bySymbol[sym] = { qty: 0, avgCost: 0, spent: 0, sold: 0, realized: 0 };
            const h = bySymbol[sym];
            const qty = Number(p.crypto_amount) || 0;
            const fiat = Number(p.fiat_amount) || 0;
            if (p.side === 'buy') {
                const newQty = h.qty + qty;
                h.avgCost = newQty > 0 ? (h.qty * h.avgCost + fiat) / newQty : 0;
                h.qty = newQty;
                h.spent += fiat;
                totalSpent += fiat;
            } else {
                const sellQty = Math.min(qty, h.qty);
                const costBasis = sellQty * h.avgCost;
                const realized = fiat - costBasis;
                h.qty = Math.max(0, h.qty - qty);
                h.sold += fiat;
                h.realized += realized;
                totalSold += fiat;
                totalRealized += realized;
            }
        });
        return { bySymbol, totalSpent, totalSold, totalRealized };
    }

    function render() {
        const { bySymbol, totalSpent, totalSold, totalRealized } = computeHoldings();
        const activeSymbols = Object.entries(bySymbol).filter(([, h]) => h.qty > 1e-9);

        let holdingsValue = 0, unrealized = 0;
        activeSymbols.forEach(([sym, h]) => {
            const price = priceMap[sym] || 0;
            holdingsValue += price * h.qty;
            unrealized += (price - h.avgCost) * h.qty;
        });

        document.getElementById('stat-value').innerText = fmtUsd(holdingsValue);
        const totalPnl = unrealized + totalRealized;
        const pnlEl = document.getElementById('stat-pnl');
        pnlEl.innerText = fmtSigned(totalPnl);
        pnlEl.className = `text-sm font-mono font-bold ${pnlColorClass(totalPnl)}`;
        document.getElementById('stat-spent').innerText = fmtUsd(totalSpent);
        document.getElementById('stat-sold').innerText = fmtUsd(totalSold);
        const unrealEl = document.getElementById('stat-unrealized');
        unrealEl.innerText = fmtSigned(unrealized); unrealEl.className = `text-sm font-mono font-bold ${pnlColorClass(unrealized)}`;
        const realEl = document.getElementById('stat-realized');
        realEl.innerText = fmtSigned(totalRealized); realEl.className = `text-sm font-mono font-bold ${pnlColorClass(totalRealized)}`;
        document.getElementById('stat-assets').innerText = activeSymbols.length;
        document.getElementById('stat-orders').innerText = purchases.length;

        const holdingsBody = document.getElementById('holdings-rows');
        if (activeSymbols.length === 0) {
            holdingsBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-600 text-[11px]">No holdings yet — buy some crypto from the terminal.</td></tr>`;
        } else {
            holdingsBody.innerHTML = activeSymbols
                .sort((a, b) => (priceMap[b[0]] * b[1].qty) - (priceMap[a[0]] * a[1].qty))
                .map(([sym, h]) => {
                    const price = priceMap[sym] || 0;
                    const value = price * h.qty;
                    const pnl = (price - h.avgCost) * h.qty;
                    return `
                        <tr class="hover:bg-gray-800/40 transition-colors">
                            <td class="py-2 px-3 font-bold text-white">${escapeHtml(sym)}</td>
                            <td class="py-2 px-3 text-right text-gray-300">${fmtQty(h.qty)}</td>
                            <td class="py-2 px-3 text-right text-gray-400">${fmtUsd(h.avgCost, priceFmt(h.avgCost))}</td>
                            <td class="py-2 px-3 text-right text-gray-300">${price ? fmtUsd(price, priceFmt(price)) : '<span class="text-gray-600">--</span>'}</td>
                            <td class="py-2 px-3 text-right text-gray-200">${fmtUsd(value)}</td>
                            <td class="py-2 px-3 text-right ${pnlColorClass(pnl)}">${fmtSigned(pnl)}</td>
                        </tr>`;
                }).join('');
        }

        const ordersBody = document.getElementById('orders-rows');
        if (purchases.length === 0) {
            ordersBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-gray-600 text-[11px]">No orders yet — buy some crypto from the terminal to see it here.</td></tr>`;
        } else {
            ordersBody.innerHTML = purchases.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(p => {
                const sideColor = p.side === 'buy' ? 'text-[#14d38a] bg-[#14d38a]/10 border-[#14d38a]/30' : 'text-[#ff4d6a] bg-[#ff4d6a]/10 border-[#ff4d6a]/30';
                const price = Number(p.price_usd) || (Number(p.fiat_amount) / Number(p.crypto_amount));
                return `
                    <tr class="hover:bg-gray-800/40 transition-colors">
                        <td class="py-2 px-3 text-gray-500">${new Date(p.created_at).toLocaleString()}</td>
                        <td class="py-2 px-3 font-bold text-white">${escapeHtml(p.symbol)}</td>
                        <td class="py-2 px-3"><span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${sideColor}">${escapeHtml(p.side)}</span></td>
                        <td class="py-2 px-3 text-right text-gray-300">${fmtQty(Number(p.crypto_amount))}</td>
                        <td class="py-2 px-3 text-right text-gray-300">${fmtUsd(Number(p.fiat_amount))}</td>
                        <td class="py-2 px-3 text-right text-gray-400">${fmtUsd(price, priceFmt(price))}</td>
                    </tr>`;
            }).join('');
        }
    }

    async function loadPurchases() {
        const client = window.cwAuth?.getClient?.();
        const user = window.cwAuth?.getUser?.();
        if (!client || !user) return;
        const { data, error } = await client
            .from('purchases')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            showToast('Could not load your purchase history — try refreshing.', 'error');
            console.error('[CryptoBolt] purchases fetch error:', error.message);
            return;
        }
        purchases = data || [];
        const symbols = Array.from(new Set(purchases.map(p => p.symbol)));
        await fetchLivePrices(symbols);
        render();
    }

    document.getElementById('refresh-btn')?.addEventListener('click', () => {
        loadPurchases();
        showToast('Refreshed.', 'success');
    });

    // ---------- Leaderboard username ----------
    const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
    const usernameInput = document.getElementById('username-input');
    const usernameSaveBtn = document.getElementById('username-save-btn');
    const usernameMsg = document.getElementById('username-msg');

    function showUsernameMsg(msg, tone) {
        if (!usernameMsg) return;
        usernameMsg.innerText = msg;
        usernameMsg.className = `text-[11px] px-6 pb-3 ${tone === 'error' ? 'text-[#ff4d6a]' : 'text-[#14d38a]'}`;
        usernameMsg.classList.remove('hidden');
    }

    async function loadUsername() {
        const client = window.cwAuth?.getClient?.();
        const user = window.cwAuth?.getUser?.();
        if (!client || !user || !usernameInput) return;
        const { data, error } = await client.from('profiles').select('username').eq('id', user.id).maybeSingle();
        if (!error && data?.username) usernameInput.value = data.username;
    }

    usernameSaveBtn?.addEventListener('click', async () => {
        const client = window.cwAuth?.getClient?.();
        const user = window.cwAuth?.getUser?.();
        if (!client || !user || !usernameInput) return;
        const next = usernameInput.value.trim();
        if (!USERNAME_RE.test(next)) {
            showUsernameMsg('Username must be 3-20 characters — letters, numbers, and underscores only.', 'error');
            return;
        }
        usernameSaveBtn.disabled = true;
        const original = usernameSaveBtn.innerText;
        usernameSaveBtn.innerText = 'Saving…';
        try {
            const { error } = await client.from('profiles').update({ username: next }).eq('id', user.id);
            if (error) {
                if (/duplicate|already exists|unique/i.test(error.message || '')) {
                    showUsernameMsg('That username is already taken — try another.', 'error');
                } else {
                    showUsernameMsg(error.message || 'Could not save username.', 'error');
                }
                return;
            }
            showUsernameMsg('Username saved.', 'success');
        } catch (err) {
            showUsernameMsg(err.message || 'Could not save username.', 'error');
        } finally {
            usernameSaveBtn.disabled = false;
            usernameSaveBtn.innerText = original;
        }
    });

    function handleAuthChange(user, configured) {
        if (!configured) {
            notConfiguredPanel.classList.remove('hidden');
            signedOutPanel.classList.add('hidden');
            dashboard.classList.add('hidden');
            return;
        }
        notConfiguredPanel.classList.add('hidden');
        if (user) {
            signedOutPanel.classList.add('hidden');
            dashboard.classList.remove('hidden');
            const emailEl = document.getElementById('auth-user-email');
            if (emailEl) emailEl.innerText = user.email || '';
            loadPurchases();
            loadUsername();
        } else {
            dashboard.classList.add('hidden');
            signedOutPanel.classList.remove('hidden');
        }
    }

    // window.cwAuth is guaranteed to exist by the time this script runs (js/17-auth.js loads
    // first and defines it synchronously), so this registration itself can never race — and
    // onChange fires immediately if the initial session check already resolved.
    window.cwAuth.onChange(handleAuthChange);
})();