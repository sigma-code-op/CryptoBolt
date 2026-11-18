// ---------- Pro Desk (app.html) ----------
// Tools a trading terminal is expected to have, built only on Binance's free public endpoints:
//   1. Command palette (Ctrl/Cmd+K or "/"): jump to any coin, change timeframe/chart type,
//      toggle indicators, open panels, set an alert ("alert above 65000").
//   2. Keyboard shortcuts (press "?"): 1-6 timeframes, [ ] previous/next symbol, W watchlist, F fullscreen.
//   3. Pro Desk panel with five tabs:
//        Futures intel  - basis, funding + countdown, open interest, long/short ratios, taker flow
//        Liquidations   - live market-wide forced-liquidation tape with long/short totals
//        Funding radar  - most crowded longs / shorts across every USDT perpetual
//        Order flow     - cumulative volume delta + large-trade tape for the selected symbol
//        Correlation    - correlation matrix, beta to BTC and relative strength for the top coins
//        Liquidity      - spread, depth imbalance, walls and market-order slippage from the live book
//        My positions   - live read-only view of the Trade page paper account (replaces the old tracker panels)
// Nothing here changes how the existing modules work: it reads the shared globals (selectedAsset,
// marketMap, selectAsset, watchlist) and only fetches for the tab that is open and visible.
(function proDesk() {
    'use strict';

    const FAPI = 'https://fapi.binance.com';
    const SAPI = 'https://api.binance.com';
    const root = document.getElementById('pro-desk');

    // ---------- helpers ----------
    const store = {
        get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
    };
    const esc = (s) => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

    async function jget(url, ms) {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), ms || 9000);
        try {
            const res = await fetch(url, { signal: ctl.signal });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } finally { clearTimeout(t); }
    }

    function usd(n, d) {
        if (!isFinite(n)) return '--';
        const a = Math.abs(n), sign = n < 0 ? '-' : '';
        if (a >= 1e9) return sign + '$' + (a / 1e9).toFixed(d == null ? 2 : d) + 'B';
        if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(d == null ? 2 : d) + 'M';
        if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(d == null ? 1 : d) + 'K';
        return sign + '$' + a.toFixed(0);
    }
    const pct = (n, d) => (isFinite(n) ? (n > 0 ? '+' : '') + n.toFixed(d == null ? 2 : d) + '%' : '--');
    const cls = (n) => (n > 0 ? 'pd-up' : n < 0 ? 'pd-dn' : '');
    function clock(ts) { return new Date(ts).toLocaleTimeString([], { hour12: false }); }
    function priceStr(p) {
        if (!isFinite(p)) return '--';
        return p >= 100 ? p.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p >= 1 ? p.toFixed(3) : p.toPrecision(4);
    }

    function spark(values, color, w, h) {
        w = w || 120; h = h || 28;
        const v = (values || []).filter(isFinite);
        if (v.length < 2) return '<svg class="pd-spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"></svg>';
        const min = Math.min.apply(null, v), max = Math.max.apply(null, v), span = max - min || 1;
        const pts = v.map((x, i) => (i / (v.length - 1) * w).toFixed(1) + ',' + (h - 2 - (x - min) / span * (h - 4)).toFixed(1)).join(' ');
        return '<svg class="pd-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="' + color + '" stroke-width="1.6" points="' + pts + '"/></svg>';
    }

    function currentAsset() { return (typeof selectedAsset !== 'undefined') ? selectedAsset : null; }
    function perpFor(asset) { return asset && typeof marketMap !== 'undefined' ? marketMap[asset.symbol + '_F'] : null; }
    function pick(asset) {
        if (asset && typeof selectAsset === 'function') {
            selectAsset(asset);
            const chart = document.getElementById('chart-card');
            if (chart && window.innerWidth < 1024) chart.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    function pickSymbol(symbol, preferFutures) {
        if (typeof marketMap === 'undefined') return;
        const a = preferFutures ? (marketMap[symbol + '_F'] || marketMap[symbol + '_S']) : (marketMap[symbol + '_S'] || marketMap[symbol + '_F']);
        pick(a);
    }
    const typing = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

    // =====================================================================
    // 1. COMMAND PALETTE + SHORTCUTS
    // =====================================================================
    const TF = ['1m', '5m', '15m', '1h', '4h', '1d'];
    let palette = null, palIndex = 0, palItems = [];

    function click(sel) { const el = $(sel); if (el) el.click(); return !!el; }
    function toast(msg, kind) { if (typeof showToast === 'function') showToast(msg, kind || 'success'); }

    function goPanel(id) {
        const el = document.querySelector('[data-cw-panel="' + id + '"]');
        if (!el) return;
        if (el.classList.contains('cw-collapsed')) { const b = $('.cw-collapse-btn', el); if (b) b.click(); }
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function openDesk(tab) {
        if (!root) return;
        showTab(tab || activeTab);
        goPanel('prodesk');
    }
    function toggleWatch() {
        const a = currentAsset();
        if (!a || typeof watchlist === 'undefined') return;
        const i = watchlist.indexOf(a.id);
        if (i > -1) watchlist.splice(i, 1); else watchlist.push(a.id);
        store.set('cw_watchlist', watchlist);
        if (typeof renderTableHTMLStructure === 'function') renderTableHTMLStructure();
        toast((i > -1 ? 'Removed ' : 'Added ') + a.baseAsset + ' ' + (i > -1 ? 'from' : 'to') + ' watchlist');
    }
    function stepSymbol(dir) {
        if (typeof marketMap === 'undefined') return;
        const byDom = {};
        Object.keys(marketMap).forEach(k => { byDom[marketMap[k].domId] = marketMap[k]; });
        const rows = $$('#crypto-rows tr').map(r => byDom[r.id]).filter(Boolean);
        if (!rows.length) return;
        const a = currentAsset();
        let i = a ? rows.findIndex(r => r.id === a.id) : -1;
        i = (i + dir + rows.length) % rows.length;
        pick(rows[i]);
        const el = document.getElementById(rows[i].domId);
        if (el) el.scrollIntoView({ block: 'nearest' });
    }
    function setAlert(direction, price) {
        const dir = $('#alert-direction'), inp = $('#alert-price-input');
        if (!dir || !inp || !currentAsset()) { toast('Select a coin first.', 'error'); return; }
        dir.value = direction;
        inp.value = String(price);
        click('#alert-add-btn');
    }

    function commands() {
        const list = [];
        TF.forEach((tf, i) => list.push({ t: 'Timeframe ' + tf, k: 'interval ' + tf, hint: String(i + 1), run: () => click('.tf-btn[data-tf="' + tf + '"]') }));
        [['candles', 'Candles'], ['heikinashi', 'Heikin-Ashi'], ['line', 'Line']].forEach(c =>
            list.push({ t: 'Chart type: ' + c[1], k: 'chart type ' + c[1], run: () => click('.ctype-btn[data-ctype="' + c[0] + '"]') }));
        $$('.ind-btn').forEach(b => list.push({ t: 'Toggle ' + b.textContent.trim(), k: 'indicator overlay toggle ' + b.textContent, run: () => b.click() }));
        list.push(
            { t: 'Toggle fullscreen chart', k: 'fullscreen chart', hint: 'F', run: () => click('#fullscreen-btn') },
            { t: 'Toggle log scale', k: 'log scale logarithmic', run: () => click('#logscale-toggle-btn') },
            { t: 'Download chart as PNG', k: 'screenshot png export chart', run: () => click('#screenshot-btn') },
            { t: 'Export visible market rows to CSV', k: 'csv export table', run: () => click('#export-csv-btn') },
            { t: 'Add / remove selected coin from watchlist', k: 'watchlist star favorite', hint: 'W', run: toggleWatch },
            { t: 'Open market screener & backtest', k: 'screener scan backtest', run: () => click('#screener-open-btn') },
            { t: 'Pro Desk: Futures intel', k: 'derivatives funding open interest long short basis', run: () => openDesk('deriv') },
            { t: 'Pro Desk: Live liquidations', k: 'liquidations liq tape', run: () => openDesk('liq') },
            { t: 'Pro Desk: Funding radar', k: 'funding crowded squeeze scanner', run: () => openDesk('radar') },
            { t: 'Pro Desk: Order flow & whale tape', k: 'cvd order flow whale trades delta', run: () => openDesk('flow') },
            { t: 'Pro Desk: Correlation matrix', k: 'correlation beta btc relative strength', run: () => openDesk('corr') },
            { t: 'Go to chart', k: 'chart', run: () => goPanel('chart') },
            { t: 'Go to order book', k: 'orderbook depth', run: () => goPanel('orderbook') },
            { t: 'Go to price alerts', k: 'alerts', hint: 'A', run: () => { goPanel('alerts'); setTimeout(() => { const i = $('#alert-price-input'); if (i) i.focus(); }, 250); } },
            { t: 'Pro Desk: Liquidity & slippage', k: 'liquidity depth slippage walls spread order book imbalance', run: () => openDesk('depth') },
            { t: 'Pro Desk: My positions (Trade account)', k: 'positions portfolio holdings futures paper pnl equity', run: () => openDesk('mine') },
            { t: 'Open Trade (paper trading)', k: 'trade paper trading account', run: () => { location.href = 'trade'; } },
            { t: 'Open AI Research', k: 'ai research chat', run: () => { location.href = 'ai'; } },
            { t: 'Open Account', k: 'account profile settings', run: () => { location.href = 'account.html'; } },
            { t: 'Keyboard shortcuts', k: 'help shortcuts keys', hint: '?', run: () => helpOverlay(true) }
        );
        return list;
    }

    function coinItems() {
        if (typeof marketMap === 'undefined') return [];
        return Object.keys(marketMap).map(k => marketMap[k]);
    }

    function palSearch(q) {
        q = q.trim();
        const out = [];
        const m = q.match(/^alert\s+(above|below|up|down)?\s*\$?([\d.,]+)$/i);
        if (m) {
            const price = parseFloat(m[2].replace(/,/g, ''));
            const a = currentAsset();
            if (price > 0 && a) {
                const dir = m[1] ? (/^(above|up)$/i.test(m[1]) ? 'above' : 'below') : (price >= a.price ? 'above' : 'below');
                out.push({ t: 'Alert ' + a.baseAsset + ' ' + dir + ' $' + priceStr(price), sub: 'Creates a price alert for the selected coin', run: () => setAlert(dir, price) });
            }
        }
        const lq = q.toLowerCase();
        const cmds = commands();
        const coins = coinItems();
        if (!lq) {
            const recent = store.get('cw_pd_recent', []).map(id => marketMap && marketMap[id]).filter(Boolean);
            recent.slice(0, 5).forEach(a => out.push(coinRow(a, 'Recent')));
            cmds.slice(0, 7).forEach(c => out.push(cmdRow(c)));
            return out;
        }
        const scored = [];
        coins.forEach(a => {
            const b = a.baseAsset.toLowerCase();
            let s = -1;
            if (b === lq) s = 100; else if (b.startsWith(lq)) s = 70; else if (b.includes(lq)) s = 40;
            if (s >= 0) scored.push([s + (a.isFutures ? 0 : 1) + Math.log10((a.volume || 1) + 1) / 20, a]);
        });
        scored.sort((x, y) => y[0] - x[0]);
        scored.slice(0, 8).forEach(x => out.push(coinRow(x[1])));
        const words = lq.split(/\s+/);
        cmds.filter(c => words.every(w => (c.t + ' ' + c.k).toLowerCase().includes(w))).slice(0, 8).forEach(c => out.push(cmdRow(c)));
        return out;
    }
    function coinRow(a, tag) {
        return {
            t: a.baseAsset + ' ' + (a.isFutures ? 'Perp' : 'Spot'),
            sub: '$' + priceStr(a.price) + '  ' + pct(a.changePct) + '  vol ' + usd(a.volume),
            tag: tag || 'Chart', cls: cls(a.changePct),
            run: () => {
                const r = store.get('cw_pd_recent', []).filter(id => id !== a.id);
                r.unshift(a.id); store.set('cw_pd_recent', r.slice(0, 8));
                pick(a);
            }
        };
    }
    function cmdRow(c) { return { t: c.t, hint: c.hint, tag: 'Command', run: c.run }; }

    function palRender() {
        const list = $('.pd-pal-list', palette);
        if (!palItems.length) { list.innerHTML = '<div class="pd-pal-empty">No match. Try a coin (BTC), a command (rsi), or "alert above 65000".</div>'; return; }
        list.innerHTML = palItems.map((it, i) =>
            '<button type="button" role="option" class="pd-pal-item' + (i === palIndex ? ' is-sel' : '') + '" data-i="' + i + '" aria-selected="' + (i === palIndex) + '">' +
            '<span class="pd-pal-main"><span class="pd-pal-t">' + esc(it.t) + '</span>' + (it.sub ? '<span class="pd-pal-sub ' + (it.cls || '') + '">' + esc(it.sub) + '</span>' : '') + '</span>' +
            (it.hint ? '<kbd>' + esc(it.hint) + '</kbd>' : '') + '<span class="pd-pal-tag">' + esc(it.tag || '') + '</span></button>').join('');
        const sel = $('.is-sel', list);
        if (sel) sel.scrollIntoView({ block: 'nearest' });
    }
    function palUpdate() {
        palItems = palSearch($('.pd-pal-input', palette).value);
        palIndex = 0;
        palRender();
    }
    function palRun(i) {
        const it = palItems[i];
        if (!it) return;
        palClose();
        try { it.run(); } catch (e) { console.warn('Command failed:', e); }
    }
    function palOpen() {
        if (!palette) {
            palette = document.createElement('div');
            palette.className = 'pd-pal-back';
            palette.innerHTML = '<div class="pd-pal" role="dialog" aria-modal="true" aria-label="Command palette">' +
                '<input class="pd-pal-input" type="text" autocomplete="off" spellcheck="false" placeholder="Search a coin, run a command, or type: alert above 65000" aria-label="Command palette search" role="combobox" aria-expanded="true">' +
                '<div class="pd-pal-list" role="listbox"></div>' +
                '<div class="pd-pal-foot"><span><kbd>&uarr;</kbd><kbd>&darr;</kbd> move</span><span><kbd>Enter</kbd> run</span><span><kbd>Esc</kbd> close</span><span><kbd>?</kbd> shortcuts</span></div></div>';
            document.body.appendChild(palette);
            palette.addEventListener('mousedown', (e) => { if (e.target === palette) palClose(); });
            palette.addEventListener('click', (e) => { const b = e.target.closest('.pd-pal-item'); if (b) palRun(+b.dataset.i); });
            palette.addEventListener('mousemove', (e) => {
                const b = e.target.closest('.pd-pal-item');
                if (b && +b.dataset.i !== palIndex) { palIndex = +b.dataset.i; $$('.pd-pal-item', palette).forEach((x, i) => { x.classList.toggle('is-sel', i === palIndex); x.setAttribute('aria-selected', String(i === palIndex)); }); }
            });
            $('.pd-pal-input', palette).addEventListener('input', palUpdate);
            $('.pd-pal-input', palette).addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); palIndex = Math.min(palItems.length - 1, palIndex + 1); palRender(); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); palIndex = Math.max(0, palIndex - 1); palRender(); }
                else if (e.key === 'Enter') { e.preventDefault(); palRun(palIndex); }
                else if (e.key === 'Escape') { e.preventDefault(); palClose(); }
            });
        }
        palette.classList.add('is-open');
        const inp = $('.pd-pal-input', palette);
        inp.value = '';
        palUpdate();
        setTimeout(() => inp.focus(), 0);
    }
    function palClose() {
        if (palette) palette.classList.remove('is-open');
    }
    const palIsOpen = () => !!palette && palette.classList.contains('is-open');

    let help = null;
    function helpOverlay(open) {
        if (!help) {
            help = document.createElement('div');
            help.className = 'pd-pal-back';
            const rows = [
                ['Ctrl / Cmd + K  or  /', 'Command palette'], ['1 2 3 4 5 6', 'Timeframe 1m 5m 15m 1h 4h 1d'],
                ['[  and  ]', 'Previous / next symbol in the list'], ['W', 'Add or remove the selected coin from the watchlist'],
                ['F', 'Fullscreen chart'], ['A', 'Jump to price alerts'], ['D', 'Open Pro Desk'], ['?', 'This help']
            ];
            help.innerHTML = '<div class="pd-pal pd-help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><h2>Keyboard shortcuts</h2>' +
                rows.map(r => '<div class="pd-help-row"><kbd>' + r[0] + '</kbd><span>' + r[1] + '</span></div>').join('') +
                '<p class="pd-help-note">Shortcuts are off while you are typing in a field.</p></div>';
            document.body.appendChild(help);
            help.addEventListener('mousedown', (e) => { if (e.target === help) helpOverlay(false); });
        }
        help.classList.toggle('is-open', open);
    }

    document.addEventListener('keydown', (e) => {
        const k = e.key;
        if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'k') { e.preventDefault(); palIsOpen() ? palClose() : palOpen(); return; }
        if (k === 'Escape') { if (help && help.classList.contains('is-open')) { helpOverlay(false); } return; }
        if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || palIsOpen()) return;
        if (document.querySelector('.cw-modal-backdrop.open, .cw-modal-backdrop.active, .cw-modal-backdrop.show')) return;
        if (k === '/') { e.preventDefault(); palOpen(); }
        else if (k === '?') { e.preventDefault(); helpOverlay(!(help && help.classList.contains('is-open'))); }
        else if (/^[1-6]$/.test(k)) { click('.tf-btn[data-tf="' + TF[+k - 1] + '"]'); }
        else if (k === '[') { stepSymbol(-1); }
        else if (k === ']') { stepSymbol(1); }
        else if (k === 'w' || k === 'W') { toggleWatch(); }
        else if (k === 'f' || k === 'F') { click('#fullscreen-btn'); }
        else if (k === 'a' || k === 'A') { e.preventDefault(); goPanel('alerts'); setTimeout(() => { const i = $('#alert-price-input'); if (i) i.focus(); }, 250); }
        else if (k === 'd' || k === 'D') { openDesk(); }
    });
    const cmdBtn = document.getElementById('pd-cmd-btn');
    if (cmdBtn) cmdBtn.addEventListener('click', palOpen);

    if (!root) return; // everything below needs the Pro Desk markup

    // =====================================================================
    // PRO DESK: tabs + lifecycle
    // =====================================================================
    const tabs = {};
    let activeTab = store.get('cw_pd_tab', 'deriv');
    let lastAssetId = null;
    const panes = {};
    $$('[data-pd-pane]', root).forEach(p => { panes[p.dataset.pdPane] = p; });
    const tabBtns = $$('[data-pd-tab]', root);

    function visible() {
        return !document.hidden && !root.classList.contains('cw-collapsed');
    }
    function showTab(name) {
        if (!panes[name]) name = 'deriv';
        const prev = activeTab;
        activeTab = name;
        store.set('cw_pd_tab', name);
        tabBtns.forEach(b => {
            const on = b.dataset.pdTab === name;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-selected', String(on));
            b.tabIndex = on ? 0 : -1;
        });
        Object.keys(panes).forEach(n => { panes[n].hidden = n !== name; });
        if (prev !== name && tabs[prev] && tabs[prev].stop) tabs[prev].stop();
        if (tabs[name] && tabs[name].start) tabs[name].start();
    }
    tabBtns.forEach(b => b.addEventListener('click', () => showTab(b.dataset.pdTab)));
    $('.pd-tabs', root).addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const names = tabBtns.map(b => b.dataset.pdTab);
        const i = names.indexOf(activeTab);
        const n = names[(i + (e.key === 'ArrowRight' ? 1 : -1) + names.length) % names.length];
        showTab(n);
        const b = tabBtns.find(x => x.dataset.pdTab === n); if (b) b.focus();
    });

    function skeleton(msg) { return '<p class="pd-empty">' + esc(msg) + '</p>'; }
    function errBox(pane, msg, retry) {
        pane.innerHTML = '<div class="pd-error"><span>' + esc(msg) + '</span><button type="button" class="pd-btn" data-retry>Retry</button></div>';
        const b = $('[data-retry]', pane); if (b) b.addEventListener('click', retry);
    }

    // =====================================================================
    // TAB: FUTURES INTEL
    // =====================================================================
    (function derivTab() {
        const pane = panes.deriv;
        let timer = null, cd = null, token = 0, nextFunding = 0;

        function ratioRow(label, hist, tip) {
            const last = hist && hist[hist.length - 1];
            if (!last) return '<div class="pd-tile"><div class="pd-k">' + label + '</div><div class="pd-v">--</div></div>';
            const longPct = parseFloat(last.longAccount) * 100, shortPct = 100 - longPct;
            const ratios = hist.map(h => parseFloat(h.longShortRatio));
            return '<div class="pd-tile" title="' + esc(tip) + '"><div class="pd-k">' + label + '</div>' +
                '<div class="pd-v">' + parseFloat(last.longShortRatio).toFixed(2) + '</div>' +
                '<div class="pd-bar" aria-label="' + longPct.toFixed(1) + '% long, ' + shortPct.toFixed(1) + '% short"><i class="pd-bar-l" style="width:' + longPct.toFixed(1) + '%"></i></div>' +
                '<div class="pd-sub"><span class="pd-up">' + longPct.toFixed(1) + '% long</span><span class="pd-dn">' + shortPct.toFixed(1) + '% short</span></div>' +
                spark(ratios, '#4fd8e8') + '</div>';
        }

        function notes(prem, oiChg, glsr, top, taker) {
            const out = [];
            const fr = parseFloat(prem.lastFundingRate);
            if (fr >= 0.0005) out.push('Funding is high and positive: longs are paying shorts a lot to hold, a sign of a crowded long.');
            else if (fr <= -0.0002) out.push('Funding is negative: shorts are paying longs, a sign of a crowded short that can fuel squeezes.');
            else out.push('Funding is near neutral, so neither side is paying a large premium to hold.');
            const g = glsr && glsr[glsr.length - 1], t = top && top[top.length - 1];
            if (g) {
                const r = parseFloat(g.longShortRatio);
                if (r >= 2) out.push('Retail accounts lean heavily long (' + r.toFixed(2) + ' long per short account).');
                else if (r <= 0.7) out.push('Retail accounts lean heavily short (' + r.toFixed(2) + ' long per short account).');
            }
            if (g && t) {
                const gr = parseFloat(g.longShortRatio), tr = parseFloat(t.longShortRatio);
                if (gr > 1.4 && tr < 1) out.push('Top traders hold more shorts than longs while the crowd leans long: a divergence worth watching.');
                if (gr < 0.8 && tr > 1) out.push('Top traders hold more longs than shorts while the crowd leans short: a divergence worth watching.');
            }
            if (isFinite(oiChg) && Math.abs(oiChg) >= 5) out.push('Open interest ' + (oiChg > 0 ? 'rose ' : 'fell ') + Math.abs(oiChg).toFixed(1) + '% over 24h, so leverage is ' + (oiChg > 0 ? 'building' : 'being unwound') + '.');
            const tk = taker && taker[taker.length - 1];
            if (tk) {
                const r = parseFloat(tk.buySellRatio);
                if (r >= 1.15) out.push('Aggressive buying dominates the latest hour (taker buy/sell ' + r.toFixed(2) + ').');
                else if (r <= 0.87) out.push('Aggressive selling dominates the latest hour (taker buy/sell ' + r.toFixed(2) + ').');
            }
            return out;
        }

        async function load() {
            const a = currentAsset();
            const my = ++token;
            if (!a) { pane.innerHTML = skeleton('Select a coin to see its futures data.'); return; }
            const perp = perpFor(a);
            if (!perp) { pane.innerHTML = skeleton(a.baseAsset + ' has no USDT perpetual on Binance, so there is no funding, open interest or long/short data.'); return; }
            const s = perp.symbol;
            const q = '?symbol=' + s;
            const res = await Promise.allSettled([
                jget(FAPI + '/fapi/v1/premiumIndex' + q),
                jget(FAPI + '/futures/data/openInterestHist' + q + '&period=1h&limit=25'),
                jget(FAPI + '/futures/data/globalLongShortAccountRatio' + q + '&period=1h&limit=24'),
                jget(FAPI + '/futures/data/topLongShortPositionRatio' + q + '&period=1h&limit=24'),
                jget(FAPI + '/futures/data/takerlongshortRatio' + q + '&period=1h&limit=24')
            ]);
            if (my !== token) return; // user switched coin while loading
            const v = res.map(r => r.status === 'fulfilled' ? r.value : null);
            const prem = v[0];
            if (!prem || prem.code) { errBox(pane, 'Could not load futures data for ' + s + '. Binance may be rate limiting or blocking this region.', load); return; }
            const oi = v[1] || [], glsr = v[2] || [], top = v[3] || [], taker = v[4] || [];
            const mark = parseFloat(prem.markPrice), idx = parseFloat(prem.indexPrice);
            const basis = (mark / idx - 1) * 100;
            const fr = parseFloat(prem.lastFundingRate);
            nextFunding = prem.nextFundingTime;
            const oiVals = oi.map(x => parseFloat(x.sumOpenInterestValue));
            const oiNow = oiVals[oiVals.length - 1], oiThen = oiVals[0];
            const oiChg = oiVals.length > 1 ? (oiNow / oiThen - 1) * 100 : NaN;
            const tk = taker[taker.length - 1];
            const tkRatios = taker.map(x => parseFloat(x.buySellRatio));

            pane.innerHTML =
                '<div class="pd-grid">' +
                '<div class="pd-tile" title="Mark price versus the spot index. Positive basis means perp trades above spot."><div class="pd-k">Basis (mark vs index)</div><div class="pd-v ' + cls(basis) + '">' + pct(basis, 3) + '</div><div class="pd-sub"><span>Mark $' + priceStr(mark) + '</span><span>Index $' + priceStr(idx) + '</span></div></div>' +
                '<div class="pd-tile" title="Funding is paid between longs and shorts every funding interval (usually 8h). Annualised assumes the current rate repeats every 8h."><div class="pd-k">Funding rate</div><div class="pd-v ' + cls(fr) + '">' + pct(fr * 100, 4) + '</div><div class="pd-sub"><span>' + pct(fr * 3 * 365 * 100, 1) + ' / yr</span><span>next in <b id="pd-fund-cd">--</b></span></div></div>' +
                '<div class="pd-tile" title="Total notional value of open futures contracts over the last 24 hours."><div class="pd-k">Open interest</div><div class="pd-v">' + usd(oiNow) + '</div><div class="pd-sub"><span class="' + cls(oiChg) + '">' + pct(oiChg, 1) + ' 24h</span></div>' + spark(oiVals, '#ffb020') + '</div>' +
                '<div class="pd-tile" title="Taker buy volume divided by taker sell volume. Above 1 means aggressive buyers are winning."><div class="pd-k">Taker buy / sell (1h)</div><div class="pd-v ' + (tk ? cls(parseFloat(tk.buySellRatio) - 1) : '') + '">' + (tk ? parseFloat(tk.buySellRatio).toFixed(2) : '--') + '</div><div class="pd-sub"><span>' + (tk ? usd(parseFloat(tk.buyVol) * mark) + ' buy' : '') + '</span><span>' + (tk ? usd(parseFloat(tk.sellVol) * mark) + ' sell' : '') + '</span></div>' + spark(tkRatios, '#14d38a') + '</div>' +
                ratioRow('Long / short, all accounts', glsr, 'Ratio of accounts holding net long versus net short positions (1h snapshots, last 24h).') +
                ratioRow('Long / short, top traders', top, 'Position ratio of the largest accounts on Binance (1h snapshots, last 24h).') +
                '</div>' +
                '<div class="pd-notes"><div class="pd-k">Positioning notes</div><ul>' + notes(prem, oiChg, glsr, top, taker).map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' +
                '<p class="pd-fine">Descriptive only, from Binance public data. Not a trade signal or financial advice.</p></div>';
            tickCountdown();
        }

        function tickCountdown() {
            const el = $('#pd-fund-cd');
            if (!el || !nextFunding) return;
            const ms = Math.max(0, nextFunding - Date.now());
            const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
            el.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        }
        tabs.deriv = {
            start() {
                pane.innerHTML = skeleton('Loading futures data...');
                load();
                clearInterval(timer); clearInterval(cd);
                timer = setInterval(() => { if (visible()) load(); }, 60000);
                cd = setInterval(tickCountdown, 1000);
            },
            stop() { clearInterval(timer); clearInterval(cd); timer = cd = null; },
            onAsset() { this.start(); }
        };
    })();

    // =====================================================================
    // TAB: LIVE LIQUIDATIONS
    // =====================================================================
    const liq = { events: [], ws: null, retry: 0, timer: null, state: 'idle' };
    (function liqTab() {
        const pane = panes.liq;
        const MAX = 1500;
        let minUsd = store.get('cw_pd_liq_min', 25000);
        let win = store.get('cw_pd_liq_win', 15);
        let onlyCoin = store.get('cw_pd_liq_coin', false);
        let render = null;

        function connect() {
            if (liq.ws || !('WebSocket' in window)) return;
            liq.state = 'connecting';
            try { liq.ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr'); } catch (e) { liq.state = 'error'; return; }
            liq.ws.onopen = () => { liq.state = 'live'; liq.retry = 0; paintState(); };
            liq.ws.onmessage = (m) => {
                try {
                    const d = JSON.parse(m.data), o = d.o;
                    if (!o) return;
                    const qty = parseFloat(o.z) || parseFloat(o.q), px = parseFloat(o.ap) || parseFloat(o.p);
                    if (!(qty > 0 && px > 0)) return;
                    liq.events.push({ t: o.T || d.E || Date.now(), s: o.s, side: o.S, px: px, usd: qty * px });
                    if (liq.events.length > MAX) liq.events.splice(0, liq.events.length - MAX);
                    updateBadge();
                    if (activeTab === 'liq' && render) render();
                } catch (e) { /* ignore malformed frame */ }
            };
            const lost = () => {
                liq.ws = null; liq.state = 'reconnecting'; paintState();
                clearTimeout(liq.timer);
                liq.timer = setTimeout(connect, Math.min(30000, 1000 * Math.pow(2, liq.retry++)));
            };
            liq.ws.onclose = lost;
            liq.ws.onerror = () => { try { liq.ws.close(); } catch (e) { /* already closed */ } };
        }
        function paintState() {
            const el = $('#pd-liq-state');
            if (el) { el.textContent = liq.state === 'live' ? 'live' : liq.state; el.className = 'pd-state pd-state-' + liq.state; }
        }
        function updateBadge() {
            const b = $('[data-pd-tab="liq"] .pd-badge');
            if (!b) return;
            const cut = Date.now() - 300000;
            const n = liq.events.filter(e => e.t >= cut && e.usd >= 25000).length;
            b.textContent = n ? String(n) : '';
        }

        function draw() {
            const a = currentAsset();
            const since = Date.now() - win * 60000;
            let ev = liq.events.filter(e => e.t >= since && e.usd >= minUsd);
            if (onlyCoin && a) ev = ev.filter(e => e.s === a.symbol);
            const longs = ev.filter(e => e.side === 'SELL'), shorts = ev.filter(e => e.side === 'BUY');
            const lSum = longs.reduce((s, e) => s + e.usd, 0), sSum = shorts.reduce((s, e) => s + e.usd, 0);
            const tot = lSum + sSum || 1;
            const biggest = ev.reduce((m, e) => (e.usd > (m ? m.usd : 0) ? e : m), null);
            const rows = ev.slice(-40).reverse();
            const sum = $('#pd-liq-sum');
            if (!sum) return;
            sum.innerHTML =
                '<div class="pd-tile"><div class="pd-k">Longs liquidated</div><div class="pd-v pd-dn">' + usd(lSum) + '</div><div class="pd-sub"><span>' + longs.length + ' orders</span></div></div>' +
                '<div class="pd-tile"><div class="pd-k">Shorts liquidated</div><div class="pd-v pd-up">' + usd(sSum) + '</div><div class="pd-sub"><span>' + shorts.length + ' orders</span></div></div>' +
                '<div class="pd-tile pd-wide"><div class="pd-k">Long vs short pain</div><div class="pd-bar pd-bar-liq" aria-label="' + (lSum / tot * 100).toFixed(0) + '% of liquidated value was longs"><i class="pd-bar-s" style="width:' + (lSum / tot * 100).toFixed(1) + '%"></i></div><div class="pd-sub"><span class="pd-dn">longs ' + (lSum / tot * 100).toFixed(0) + '%</span><span>' + (biggest ? 'largest ' + usd(biggest.usd) + ' ' + esc(biggest.s.replace('USDT', '')) : 'no orders in window') + '</span><span class="pd-up">shorts ' + (sSum / tot * 100).toFixed(0) + '%</span></div></div>';
            const body = $('#pd-liq-rows');
            if (!body) return;
            body.innerHTML = rows.length ? rows.map(e =>
                '<tr data-sym="' + esc(e.s) + '"><td>' + clock(e.t) + '</td><td class="pd-sym">' + esc(e.s.replace('USDT', '')) + '</td><td class="' + (e.side === 'SELL' ? 'pd-dn' : 'pd-up') + '">' + (e.side === 'SELL' ? 'Long liquidated' : 'Short liquidated') + '</td><td class="pd-r">$' + priceStr(e.px) + '</td><td class="pd-r pd-strong">' + usd(e.usd) + '</td></tr>').join('')
                : '<tr><td colspan="5" class="pd-empty">' + (liq.state === 'live' ? 'Listening. No liquidations above ' + usd(minUsd) + ' in the last ' + win + ' minutes yet.' : 'Connecting to Binance futures liquidation stream...') + '</td></tr>';
        }
        render = (function throttle() { let last = 0, pend = null; return function () { const now = Date.now(); if (now - last > 500) { last = now; draw(); } else if (!pend) { pend = setTimeout(() => { pend = null; last = Date.now(); draw(); }, 500); } }; })();

        function exportCsv() {
            const lines = ['time,symbol,side,price,usd'].concat(liq.events.map(e => [new Date(e.t).toISOString(), e.s, e.side === 'SELL' ? 'long_liquidated' : 'short_liquidated', e.px, e.usd.toFixed(2)].join(',')));
            const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = 'cryptobolt-liquidations.csv'; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        }

        pane.innerHTML =
            '<div class="pd-controls">' +
            '<label>Min size <select id="pd-liq-min" aria-label="Minimum liquidation size">' + [[5000, '$5K'], [25000, '$25K'], [100000, '$100K'], [500000, '$500K'], [1000000, '$1M']].map(o => '<option value="' + o[0] + '"' + (o[0] === minUsd ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
            '<label>Window <select id="pd-liq-win" aria-label="Time window">' + [[5, '5 min'], [15, '15 min'], [60, '1 hour'], [240, '4 hours']].map(o => '<option value="' + o[0] + '"' + (o[0] === win ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
            '<label class="pd-check"><input type="checkbox" id="pd-liq-coin"' + (onlyCoin ? ' checked' : '') + '> Selected coin only</label>' +
            '<span class="pd-ctl-right"><span id="pd-liq-state" class="pd-state">idle</span><button type="button" class="pd-btn" id="pd-liq-csv">Export CSV</button></span></div>' +
            '<div class="pd-grid pd-grid-3" id="pd-liq-sum"></div>' +
            '<div class="pd-tablewrap"><table class="pd-table"><thead><tr><th>Time</th><th>Coin</th><th>Event</th><th class="pd-r">Price</th><th class="pd-r">Size</th></tr></thead><tbody id="pd-liq-rows"></tbody></table></div>' +
            '<p class="pd-fine">Binance reports at most one liquidation per symbol per second, so very busy moments are understated. History starts when this page opens.</p>';
        $('#pd-liq-min', pane).addEventListener('change', (e) => { minUsd = +e.target.value; store.set('cw_pd_liq_min', minUsd); draw(); });
        $('#pd-liq-win', pane).addEventListener('change', (e) => { win = +e.target.value; store.set('cw_pd_liq_win', win); draw(); });
        $('#pd-liq-coin', pane).addEventListener('change', (e) => { onlyCoin = e.target.checked; store.set('cw_pd_liq_coin', onlyCoin); draw(); });
        $('#pd-liq-csv', pane).addEventListener('click', exportCsv);
        $('#pd-liq-rows', pane).addEventListener('click', (e) => { const tr = e.target.closest('tr[data-sym]'); if (tr) pickSymbol(tr.dataset.sym, true); });

        tabs.liq = { start() { connect(); paintState(); draw(); }, stop() { }, onAsset() { if (onlyCoin) draw(); } };
        liq.connect = connect;
    })();

    // =====================================================================
    // TAB: FUNDING RADAR (all perpetuals)
    // =====================================================================
    (function radarTab() {
        const pane = panes.radar;
        let timer = null, data = null, mode = store.get('cw_pd_radar_mode', 'funding'), token = 0;

        function volOf(sym) { const m = typeof marketMap !== 'undefined' ? marketMap[sym + '_F'] : null; return m ? m.volume : 0; }

        function draw() {
            if (!data) return;
            const minVol = 20e6;
            const list = data.filter(x => volOf(x.symbol) >= minVol).map(x => {
                const fr = parseFloat(x.lastFundingRate) * 100;
                const mark = parseFloat(x.markPrice), idx = parseFloat(x.indexPrice);
                return { sym: x.symbol, fr: fr, ann: fr * 3 * 365, basis: (mark / idx - 1) * 100, vol: volOf(x.symbol) };
            }).filter(x => isFinite(x.fr) && isFinite(x.basis));
            const key = mode === 'basis' ? 'basis' : 'fr';
            const hi = list.slice().sort((a, b) => b[key] - a[key]).slice(0, 8);
            const lo = list.slice().sort((a, b) => a[key] - b[key]).slice(0, 8);
            const avg = list.reduce((s, x) => s + x.fr, 0) / (list.length || 1);
            const posN = list.filter(x => x.fr > 0).length;
            const row = (x) => '<tr data-sym="' + esc(x.sym) + '"><td class="pd-sym">' + esc(x.sym.replace('USDT', '')) + '</td><td class="pd-r ' + cls(x.fr) + '">' + pct(x.fr, 4) + '</td><td class="pd-r ' + cls(x.ann) + '">' + pct(x.ann, 0) + '</td><td class="pd-r ' + cls(x.basis) + '">' + pct(x.basis, 3) + '</td><td class="pd-r">' + usd(x.vol, 0) + '</td></tr>';
            const head = '<thead><tr><th>Coin</th><th class="pd-r">Funding</th><th class="pd-r">Per year</th><th class="pd-r">Basis</th><th class="pd-r">24h vol</th></tr></thead>';
            pane.innerHTML =
                '<div class="pd-controls"><label>Rank by <select id="pd-radar-mode" aria-label="Rank by"><option value="funding"' + (mode === 'funding' ? ' selected' : '') + '>Funding rate</option><option value="basis"' + (mode === 'basis' ? ' selected' : '') + '>Basis (mark vs index)</option></select></label>' +
                '<span class="pd-ctl-right"><span class="pd-fine">' + list.length + ' perps with 24h volume above $20M &middot; average funding <b class="' + cls(avg) + '">' + pct(avg, 4) + '</b> &middot; ' + posN + ' positive / ' + (list.length - posN) + ' negative</span></span></div>' +
                '<div class="pd-two"><div><div class="pd-k pd-up">Most crowded longs (highest ' + (mode === 'basis' ? 'basis' : 'funding') + ')</div><div class="pd-tablewrap"><table class="pd-table">' + head + '<tbody>' + hi.map(row).join('') + '</tbody></table></div></div>' +
                '<div><div class="pd-k pd-dn">Most crowded shorts (lowest ' + (mode === 'basis' ? 'basis' : 'funding') + ')</div><div class="pd-tablewrap"><table class="pd-table">' + head + '<tbody>' + lo.map(row).join('') + '</tbody></table></div></div></div>' +
                '<p class="pd-fine">Funding is the periodic payment between longs and shorts. Extreme values show where positioning is one-sided, which can precede sharp reversals, but it does not time them. Annualised assumes an 8h interval.</p>';
            $('#pd-radar-mode', pane).addEventListener('change', (e) => { mode = e.target.value; store.set('cw_pd_radar_mode', mode); draw(); });
            $$('tr[data-sym]', pane).forEach(tr => tr.addEventListener('click', () => pickSymbol(tr.dataset.sym, true)));
        }
        async function load() {
            const my = ++token;
            try {
                const d = await jget(FAPI + '/fapi/v1/premiumIndex', 12000);
                if (my !== token) return;
                if (!Array.isArray(d)) throw new Error('unexpected response');
                data = d.filter(x => x && typeof x.symbol === 'string' && x.symbol.endsWith('USDT'));
                draw();
            } catch (e) {
                if (!data) errBox(pane, 'Could not load funding data from Binance futures (' + e.message + ').', load);
            }
        }
        tabs.radar = {
            start() { if (!data) pane.innerHTML = skeleton('Scanning every USDT perpetual...'); load(); clearInterval(timer); timer = setInterval(() => { if (visible()) load(); }, 60000); },
            stop() { clearInterval(timer); timer = null; }
        };
    })();

    // =====================================================================
    // TAB: ORDER FLOW (CVD + large trades) for the selected symbol
    // =====================================================================
    (function flowTab() {
        const pane = panes.flow;
        const BUCKET = 5000, KEEP = 30 * 60 * 1000;
        let ws = null, sym = null, isF = false, buckets = [], whales = [], retry = 0, rt = null, paint = null, whaleMode = store.get('cw_pd_whale', 'auto'), since = 0;

        function threshold() {
            if (whaleMode !== 'auto') return +whaleMode;
            const a = currentAsset();
            const v = a ? a.volume : 5e8;
            return Math.max(5000, Math.min(500000, Math.round(v / 4000 / 1000) * 1000));
        }
        function stopWs() {
            clearTimeout(rt);
            if (ws) { ws.onclose = null; ws.onerror = null; ws.onmessage = null; try { ws.close(); } catch (e) { /* closed */ } ws = null; }
        }
        function connect() {
            const a = currentAsset();
            if (!a || !('WebSocket' in window)) return;
            stopWs();
            if (a.symbol !== sym || a.isFutures !== isF) { buckets = []; whales = []; since = Date.now(); }
            sym = a.symbol; isF = a.isFutures;
            const url = (isF ? 'wss://fstream.binance.com/ws/' : 'wss://stream.binance.com:9443/ws/') + sym.toLowerCase() + '@aggTrade';
            try { ws = new WebSocket(url); } catch (e) { return; }
            const mine = ws;
            ws.onmessage = (m) => {
                try {
                    const d = JSON.parse(m.data);
                    const px = parseFloat(d.p), q = parseFloat(d.q);
                    if (!(px > 0 && q > 0)) return;
                    const t = d.T || Date.now(), val = px * q;
                    const buy = !d.m; // buyer is the maker => the aggressor sold
                    const b0 = Math.floor(t / BUCKET) * BUCKET;
                    let b = buckets[buckets.length - 1];
                    if (!b || b.t !== b0) { b = { t: b0, buy: 0, sell: 0, n: 0 }; buckets.push(b); }
                    if (buy) b.buy += val; else b.sell += val;
                    b.n++;
                    if (val >= threshold()) { whales.push({ t: t, buy: buy, px: px, usd: val }); if (whales.length > 60) whales.shift(); }
                    const cut = t - KEEP;
                    while (buckets.length && buckets[0].t < cut) buckets.shift();
                    if (activeTab === 'flow' && paint) paint();
                } catch (e) { /* ignore */ }
            };
            ws.onclose = () => { if (ws !== mine) return; ws = null; rt = setTimeout(() => { if (activeTab === 'flow') connect(); }, Math.min(15000, 1000 * Math.pow(2, retry++))); };
            ws.onopen = () => { retry = 0; };
        }

        function draw() {
            const a = currentAsset();
            if (!a) { pane.innerHTML = skeleton('Select a coin to stream its order flow.'); return; }
            const now = Date.now();
            const win = function (ms) {
                const bs = buckets.filter(b => b.t >= now - ms);
                const buy = bs.reduce((s, b) => s + b.buy, 0), sell = bs.reduce((s, b) => s + b.sell, 0);
                return { buy: buy, sell: sell, d: buy - sell, n: bs.reduce((s, b) => s + b.n, 0) };
            };
            const w1 = win(60000), w5 = win(300000), w15 = win(900000);
            let c = 0;
            const cvd = buckets.map(b => (c += b.buy - b.sell));
            const th = threshold();
            const card = (label, w) => {
                const tot = w.buy + w.sell || 1;
                return '<div class="pd-tile"><div class="pd-k">' + label + '</div><div class="pd-v ' + cls(w.d) + '">' + (w.d >= 0 ? '+' : '-') + usd(Math.abs(w.d)).replace('-', '') + '</div>' +
                    '<div class="pd-bar" aria-label="' + (w.buy / tot * 100).toFixed(0) + '% market buys"><i class="pd-bar-l" style="width:' + (w.buy / tot * 100).toFixed(1) + '%"></i></div>' +
                    '<div class="pd-sub"><span class="pd-up">buy ' + (w.buy / tot * 100).toFixed(0) + '%</span><span class="pd-dn">sell ' + (w.sell / tot * 100).toFixed(0) + '%</span></div></div>';
            };
            const ctl = $('#pd-flow-ctl');
            if (!ctl) {
                pane.innerHTML =
                    '<div class="pd-controls" id="pd-flow-ctl"><span class="pd-fine" id="pd-flow-title"></span><span class="pd-ctl-right"><label>Large trade &ge; <select id="pd-flow-whale" aria-label="Large trade threshold"></select></label></span></div>' +
                    '<div class="pd-grid pd-grid-3" id="pd-flow-cards"></div>' +
                    '<div class="pd-cvd" id="pd-flow-cvd"></div>' +
                    '<div class="pd-k">Large trade tape</div><div class="pd-tablewrap pd-tape"><table class="pd-table"><tbody id="pd-flow-tape"></tbody></table></div>' +
                    '<p class="pd-fine">Delta = market buys minus market sells (aggressor side) streamed from Binance since you opened this tab. It is a live pressure gauge, not a prediction.</p>';
                const sel = $('#pd-flow-whale', pane);
                sel.innerHTML = '<option value="auto">Auto</option>' + [[10000, '$10K'], [50000, '$50K'], [100000, '$100K'], [250000, '$250K'], [1000000, '$1M']].map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('');
                sel.value = whaleMode;
                sel.addEventListener('change', () => { whaleMode = sel.value; store.set('cw_pd_whale', whaleMode); whales = []; draw(); });
            }
            $('#pd-flow-title').textContent = a.baseAsset + ' ' + (a.isFutures ? 'perp' : 'spot') + ' flow, 5s buckets, ' + (buckets.length ? Math.max(1, Math.round((now - since) / 60000)) + ' min of data' : 'waiting for trades');
            $('#pd-flow-cards').innerHTML = card('Delta 1 min', w1) + card('Delta 5 min', w5) + card('Delta 15 min', w15);
            $('#pd-flow-cvd').innerHTML = '<div class="pd-k">Cumulative volume delta (last 30 min)</div>' + (cvd.length > 1 ? spark(cvd, cvd[cvd.length - 1] >= 0 ? '#14d38a' : '#ff4d6a', 600, 70) : '<p class="pd-empty">Collecting trades...</p>');
            $('#pd-flow-tape').innerHTML = whales.length ? whales.slice().reverse().slice(0, 14).map(w => '<tr><td>' + clock(w.t) + '</td><td class="' + (w.buy ? 'pd-up' : 'pd-dn') + '">' + (w.buy ? 'Market buy' : 'Market sell') + '</td><td class="pd-r">$' + priceStr(w.px) + '</td><td class="pd-r pd-strong">' + usd(w.usd) + '</td></tr>').join('')
                : '<tr><td class="pd-empty">No trades of ' + usd(th) + ' or more yet.</td></tr>';
        }
        paint = (function throttle() { let last = 0, pend = null; return function () { const n = Date.now(); if (n - last > 1000) { last = n; draw(); } else if (!pend) { pend = setTimeout(() => { pend = null; last = Date.now(); draw(); }, 1000); } }; })();

        tabs.flow = { start() { draw(); connect(); }, stop() { stopWs(); }, onAsset() { draw(); connect(); } };
    })();

    // =====================================================================
    // TAB: CORRELATION
    // =====================================================================
    (function corrTab() {
        const pane = panes.corr;
        let iv = store.get('cw_pd_corr_iv', '1h'), cache = {}, token = 0;
        const STABLES = /^(USDC|FDUSD|TUSD|BUSD|USDP|DAI|USDE|EUR|AEUR|PYUSD|XUSD|USD1)$/;

        function coins() {
            if (typeof marketMap === 'undefined') return [];
            const top = Object.keys(marketMap).map(k => marketMap[k]).filter(a => !a.isFutures && !STABLES.test(a.baseAsset) && a.volume > 0)
                .sort((a, b) => b.volume - a.volume).slice(0, 12).map(a => a.baseAsset);
            const out = ['BTC'];
            top.forEach(b => { if (!out.includes(b)) out.push(b); });
            const a = currentAsset();
            if (a && !out.includes(a.baseAsset) && marketMap[a.baseAsset + 'USDT_S']) out.splice(1, 0, a.baseAsset);
            return out.slice(0, 10);
        }
        function returns(closes) { const r = []; for (let i = 1; i < closes.length; i++) r.push(Math.log(closes[i] / closes[i - 1])); return r; }
        function corr(x, y) {
            const n = Math.min(x.length, y.length);
            if (n < 10) return NaN;
            const xs = x.slice(-n), ys = y.slice(-n);
            const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
            let sxy = 0, sxx = 0, syy = 0;
            for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
            return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
        }
        function beta(x, btc) {
            const n = Math.min(x.length, btc.length);
            if (n < 10) return NaN;
            const xs = x.slice(-n), bs = btc.slice(-n);
            const mx = xs.reduce((s, v) => s + v, 0) / n, mb = bs.reduce((s, v) => s + v, 0) / n;
            let c = 0, v = 0;
            for (let i = 0; i < n; i++) { c += (xs[i] - mx) * (bs[i] - mb); v += (bs[i] - mb) * (bs[i] - mb); }
            return v ? c / v : NaN;
        }
        function cellStyle(c) {
            if (!isFinite(c)) return '';
            const a = Math.min(1, Math.abs(c));
            return c >= 0 ? 'background:rgba(20,211,138,' + (0.10 + a * 0.55).toFixed(2) + ')' : 'background:rgba(255,77,106,' + (0.10 + a * 0.55).toFixed(2) + ')';
        }
        async function load() {
            const my = ++token;
            const list = coins();
            if (!list.length) { pane.innerHTML = skeleton('Waiting for market data...'); return; }
            pane.innerHTML = skeleton('Fetching ' + list.length + ' candle series...');
            const key = iv + ':' + list.join(',');
            let series = cache[key] && Date.now() - cache[key].t < 60000 ? cache[key].s : null;
            if (!series) {
                const res = await Promise.allSettled(list.map(b => jget(SAPI + '/api/v3/klines?symbol=' + b + 'USDT&interval=' + iv + '&limit=120', 12000)));
                if (my !== token) return;
                series = {};
                res.forEach((r, i) => {
                    if (r.status === 'fulfilled' && Array.isArray(r.value) && r.value.length > 20) series[list[i]] = r.value.map(k => parseFloat(k[4]));
                });
                cache[key] = { t: Date.now(), s: series };
            }
            const names = list.filter(b => series[b]);
            if (names.length < 3 || !series.BTC) { errBox(pane, 'Not enough candle data came back from Binance.', load); return; }
            const rets = {}; names.forEach(b => { rets[b] = returns(series[b]); });
            const head = '<tr><th></th>' + names.map(b => '<th class="pd-r">' + esc(b) + '</th>').join('') + '<th class="pd-r">Beta to BTC</th><th class="pd-r">Return</th></tr>';
            const body = names.map(a => {
                const ch = (series[a][series[a].length - 1] / series[a][0] - 1) * 100;
                return '<tr><th scope="row" class="pd-sym" data-sym="' + esc(a) + 'USDT">' + esc(a) + '</th>' + names.map(b => {
                    const c = a === b ? 1 : corr(rets[a], rets[b]);
                    return '<td class="pd-r pd-cell" style="' + cellStyle(c) + '">' + (isFinite(c) ? c.toFixed(2) : '--') + '</td>';
                }).join('') + '<td class="pd-r">' + (a === 'BTC' ? '1.00' : (isFinite(beta(rets[a], rets.BTC)) ? beta(rets[a], rets.BTC).toFixed(2) : '--')) + '</td><td class="pd-r ' + cls(ch) + '">' + pct(ch, 1) + '</td></tr>';
            }).join('');
            const rest = names.filter(b => b !== 'BTC' && isFinite(corr(rets[b], rets.BTC)));
            const lowest = rest.slice().sort((x, y) => corr(rets[x], rets.BTC) - corr(rets[y], rets.BTC))[0];
            const avgC = rest.reduce((s, b) => s + corr(rets[b], rets.BTC), 0) / (rest.length || 1);
            pane.innerHTML =
                '<div class="pd-controls"><label>Candles <select id="pd-corr-iv" aria-label="Candle interval">' + ['15m', '1h', '4h', '1d'].map(x => '<option' + (x === iv ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label>' +
                '<span class="pd-ctl-right"><span class="pd-fine">Last 120 ' + iv + ' candles &middot; average correlation to BTC <b>' + avgC.toFixed(2) + '</b>' + (lowest ? ' &middot; most independent: <b>' + esc(lowest) + '</b> (' + corr(rets[lowest], rets.BTC).toFixed(2) + ')' : '') + '</span></span></div>' +
                '<div class="pd-tablewrap"><table class="pd-table pd-matrix"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
                '<p class="pd-fine">Correlation of candle-to-candle log returns (1 = move together, 0 = unrelated, negative = opposite). Beta above 1 means the coin has tended to move more than BTC. Past relationships can break quickly.</p>';
            $('#pd-corr-iv', pane).addEventListener('change', (e) => { iv = e.target.value; store.set('cw_pd_corr_iv', iv); load(); });
            $$('th[data-sym]', pane).forEach(th => th.addEventListener('click', () => pickSymbol(th.dataset.sym, false)));
        }
        tabs.corr = { start() { load(); }, stop() { }, onAsset() { } };
    })();


    // =====================================================================
    // TAB: LIQUIDITY (order book depth, spread, walls, slippage)
    // =====================================================================
    (function depthTab() {
        const pane = panes.depth;
        let timer = null, token = 0;

        function walk(levels, notional) {
            let rem = notional, qty = 0;
            for (let i = 0; i < levels.length && rem > 0; i++) {
                const take = Math.min(rem, levels[i][0] * levels[i][1]);
                qty += take / levels[i][0]; rem -= take;
            }
            return rem > 0 ? null : notional / qty;
        }
        function curve(bids, asks, mid) {
            const W = 600, H = 120, span = 0.02;
            const cum = (lv, dir) => { let c = 0; const out = []; lv.forEach(l => { const d = Math.abs(l[0] / mid - 1); if (d <= span) { c += l[0] * l[1]; out.push([d * dir, c]); } }); return out; };
            const b = cum(bids, -1), a = cum(asks, 1);
            const max = Math.max(b.length ? b[b.length - 1][1] : 0, a.length ? a[a.length - 1][1] : 0) || 1;
            const x = (d) => (W / 2 + d / span * (W / 2)).toFixed(1), y = (v) => (H - 2 - v / max * (H - 8)).toFixed(1);
            const path = (arr, col) => arr.length < 2 ? '' : '<polyline fill="none" stroke="' + col + '" stroke-width="1.8" points="' + arr.map(p => x(p[0]) + ',' + y(p[1])).join(' ') + '"/>';
            return '<svg class="pd-depthsvg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Cumulative depth within 2% of the mid price"><line x1="' + W / 2 + '" y1="0" x2="' + W / 2 + '" y2="' + H + '" stroke="#2a3040" stroke-dasharray="3 3"/>' + path(b, '#14d38a') + path(a, '#ff4d6a') + '</svg>';
        }
        async function load() {
            const a = currentAsset(); const my = ++token;
            if (!a) { pane.innerHTML = skeleton('Select a coin to analyse its order book.'); return; }
            let d;
            try { d = await jget((a.isFutures ? FAPI + '/fapi/v1/depth' : SAPI + '/api/v3/depth') + '?symbol=' + a.symbol + '&limit=1000', 10000); }
            catch (e) { if (my === token) errBox(pane, 'Could not load the order book for ' + a.symbol + ' (' + e.message + ').', load); return; }
            if (my !== token) return;
            const bids = (d.bids || []).map(x => [parseFloat(x[0]), parseFloat(x[1])]).filter(x => x[0] > 0);
            const asks = (d.asks || []).map(x => [parseFloat(x[0]), parseFloat(x[1])]).filter(x => x[0] > 0);
            if (!bids.length || !asks.length) { pane.innerHTML = skeleton('The order book came back empty.'); return; }
            const bb = bids[0][0], ba = asks[0][0], mid = (bb + ba) / 2;
            const spreadBps = (ba - bb) / mid * 1e4;
            const band = (lv, p, dir) => lv.reduce((s, l) => s + (dir * (l[0] / mid - 1) <= p ? l[0] * l[1] : 0), 0);
            const bandRows = [0.001, 0.005, 0.01, 0.02].map(p => {
                const bv = band(bids, p, -1), av = band(asks, p, 1), im = (bv - av) / ((bv + av) || 1) * 100;
                return '<tr><td>&plusmn;' + (p * 100).toFixed(1) + '%</td><td class="pd-r pd-up">' + usd(bv) + '</td><td class="pd-r pd-dn">' + usd(av) + '</td><td class="pd-r ' + cls(im) + '">' + pct(im, 0) + '</td></tr>';
            }).join('');
            const slipRows = [10000, 100000, 1000000].map(n => {
                const buy = walk(asks, n), sell = walk(bids, n);
                const f = (v, ref, dir) => v === null ? '<td class="pd-r pd-fine">not enough depth</td>' : '<td class="pd-r ' + (dir * (v / ref - 1) > 0.002 ? 'pd-dn' : '') + '">' + pct(dir * (v / ref - 1) * 100, 3) + '</td>';
                return '<tr><td>' + usd(n, 0) + '</td>' + f(buy, ba, 1) + f(sell, bb, -1) + '</tr>';
            }).join('');
            const walls = (lv, side) => lv.filter(l => Math.abs(l[0] / mid - 1) <= 0.03).sort((x, y) => y[0] * y[1] - x[0] * x[1]).slice(0, 3)
                .map(l => '<tr><td class="' + side + '">$' + priceStr(l[0]) + '</td><td class="pd-r">' + pct((l[0] / mid - 1) * 100, 2) + '</td><td class="pd-r pd-strong">' + usd(l[0] * l[1]) + '</td></tr>').join('') || '<tr><td colspan="3" class="pd-empty">none within 3%</td></tr>';
            const b1 = band(bids, 0.01, -1), a1 = band(asks, 0.01, 1), im1 = (b1 - a1) / ((b1 + a1) || 1) * 100;
            pane.innerHTML =
                '<div class="pd-grid pd-grid-3"><div class="pd-tile"><div class="pd-k">Spread</div><div class="pd-v">' + spreadBps.toFixed(2) + ' bps</div><div class="pd-sub"><span>bid $' + priceStr(bb) + '</span><span>ask $' + priceStr(ba) + '</span></div></div>' +
                '<div class="pd-tile" title="Bid depth minus ask depth within 1% of the mid price, as a share of both."><div class="pd-k">Depth imbalance (&plusmn;1%)</div><div class="pd-v ' + cls(im1) + '">' + pct(im1, 0) + '</div><div class="pd-sub"><span class="pd-up">bids ' + usd(b1) + '</span><span class="pd-dn">asks ' + usd(a1) + '</span></div></div>' +
                '<div class="pd-tile"><div class="pd-k">Book</div><div class="pd-v">' + a.baseAsset + ' ' + (a.isFutures ? 'perp' : 'spot') + '</div><div class="pd-sub"><span>top ' + bids.length + ' bid / ' + asks.length + ' ask levels</span></div></div></div>' +
                curve(bids, asks, mid) +
                '<div class="pd-two"><div><div class="pd-k">Resting liquidity within the band</div><div class="pd-tablewrap"><table class="pd-table"><thead><tr><th>Band</th><th class="pd-r">Bids</th><th class="pd-r">Asks</th><th class="pd-r">Imbalance</th></tr></thead><tbody>' + bandRows + '</tbody></table></div></div>' +
                '<div><div class="pd-k">Market-order slippage vs best price</div><div class="pd-tablewrap"><table class="pd-table"><thead><tr><th>Order size</th><th class="pd-r">Buy</th><th class="pd-r">Sell</th></tr></thead><tbody>' + slipRows + '</tbody></table></div></div>' +
                '<div><div class="pd-k pd-up">Largest bid walls (within 3%)</div><div class="pd-tablewrap"><table class="pd-table"><tbody>' + walls(bids, 'pd-up') + '</tbody></table></div></div>' +
                '<div><div class="pd-k pd-dn">Largest ask walls (within 3%)</div><div class="pd-tablewrap"><table class="pd-table"><tbody>' + walls(asks, 'pd-dn') + '</tbody></table></div></div></div>' +
                '<p class="pd-fine">Snapshot of the top 1,000 levels, refreshed every 10 seconds. Walls can be pulled at any moment, so treat them as context, not support or resistance.</p>';
        }
        tabs.depth = {
            start() { pane.innerHTML = skeleton('Loading order book...'); load(); clearInterval(timer); timer = setInterval(() => { if (visible()) load(); }, 10000); },
            stop() { clearInterval(timer); timer = null; },
            onAsset() { this.start(); }
        };
    })();

    // =====================================================================
    // TAB: MY POSITIONS (read-only view of the Trade page paper account)
    // =====================================================================
    (function mineTab() {
        const pane = panes.mine;
        let timer = null;
        const read = (k, d) => store.get(k, d);
        const px = (sym) => { const m = typeof marketMap !== 'undefined' ? (marketMap[sym + 'USDT_S'] || marketMap[sym + 'USDT_F']) : null; return m ? m.price : null; };
        const fpx = (sym) => { const m = typeof marketMap !== 'undefined' ? (marketMap[sym + 'USDT_F'] || marketMap[sym + 'USDT_S']) : null; return m ? m.price : null; };

        function draw() {
            const cash = read('cw_paper_cash', null);
            const hold = read('cw_paper_holdings', []), fut = read('cw_paper_futures', []), ords = read('cw_paper_orders', []), dep = read('cw_paper_deposited', null);
            if (cash === null && !hold.length && !fut.length) {
                pane.innerHTML = '<div class="pd-empty">No paper account yet. Open the Trade page, place a practice order, and your positions will show up here live.<br><br><a class="pd-btn pd-link" href="trade">Open Trade</a></div>';
                return;
            }
            let upnl = 0, margin = 0, spotVal = 0;
            const hRows = hold.map(h => {
                const m = px(h.symbol), v = (m || h.avgCost) * h.qty, pl = m ? (m - h.avgCost) * h.qty : null;
                spotVal += v; if (pl !== null) upnl += pl;
                return '<tr data-sym="' + esc(h.symbol) + 'USDT" data-f="0"><td class="pd-sym">' + esc(h.symbol) + '</td><td class="pd-r">' + h.qty + '</td><td class="pd-r">$' + priceStr(h.avgCost) + '</td><td class="pd-r">' + (m ? '$' + priceStr(m) : '--') + '</td><td class="pd-r pd-strong">' + usd(v) + '</td><td class="pd-r ' + cls(pl) + '">' + (pl === null ? '--' : (pl >= 0 ? '+' : '') + usd(pl) + ' (' + pct(pl / (h.avgCost * h.qty) * 100, 1) + ')') + '</td><td class="pd-r pd-fine">' + (h.slPrice ? 'SL $' + priceStr(h.slPrice) : '') + (h.tpPrice ? ' TP $' + priceStr(h.tpPrice) : '') + '</td></tr>';
            }).join('');
            const fRows = fut.map(p => {
                const m = fpx(p.symbol), pl = m ? ((p.side === 'long' ? m - p.entryPrice : p.entryPrice - m) * p.qty - (p.fundingPaid || 0)) : null;
                margin += p.margin || 0; if (pl !== null) upnl += pl;
                const shift = p.fundingPaid && p.qty > 0 ? p.fundingPaid / p.qty : 0;
                const liqP = p.liqPrice != null ? (p.side === 'long' ? p.liqPrice + shift : p.liqPrice - shift) : null;
                const dist = m && liqP ? (p.side === 'long' ? (m - liqP) / m : (liqP - m) / m) * 100 : null;
                return '<tr data-sym="' + esc(p.symbol) + 'USDT" data-f="1"><td class="pd-sym">' + esc(p.symbol) + ' <span class="' + (p.side === 'long' ? 'pd-up' : 'pd-dn') + '">' + esc(p.side) + ' ' + esc(p.leverage) + 'x</span></td><td class="pd-r">$' + priceStr(p.entryPrice) + '</td><td class="pd-r">' + (m ? '$' + priceStr(m) : '--') + '</td><td class="pd-r ' + (dist !== null && dist < 5 ? 'pd-dn' : '') + '">' + (liqP ? '$' + priceStr(liqP) + ' (' + dist.toFixed(1) + '%)' : '--') + '</td><td class="pd-r pd-strong">' + usd(p.margin || 0) + '</td><td class="pd-r ' + cls(pl) + '">' + (pl === null ? '--' : (pl >= 0 ? '+' : '') + usd(pl) + ' (' + pct(p.margin > 0 ? pl / p.margin * 100 : NaN, 1) + ')') + '</td></tr>';
            }).join('');
            const equity = (cash || 0) + spotVal + margin + fut.reduce((s, p) => { const m = fpx(p.symbol); return s + (m ? ((p.side === 'long' ? m - p.entryPrice : p.entryPrice - m) * p.qty - (p.fundingPaid || 0)) : 0); }, 0);
            const total = dep ? equity - dep : NaN;
            const curve = read('cw_paper_equity_curve', []).map(x => x.equity);
            const worst = fut.map(p => { const m = fpx(p.symbol); if (!m || p.liqPrice == null) return null; return (p.side === 'long' ? (m - p.liqPrice) / m : (p.liqPrice - m) / m) * 100; }).filter(x => x !== null).sort((a, b) => a - b)[0];
            pane.innerHTML =
                '<div class="pd-grid pd-grid-3"><div class="pd-tile"><div class="pd-k">Equity</div><div class="pd-v">' + usd(equity) + '</div><div class="pd-sub"><span class="' + cls(total) + '">' + (isFinite(total) ? (total >= 0 ? '+' : '') + usd(total) + ' all-time' : '') + '</span></div>' + (curve.length > 2 ? spark(curve.slice(-120), '#4fd8e8') : '') + '</div>' +
                '<div class="pd-tile"><div class="pd-k">Unrealised P&amp;L</div><div class="pd-v ' + cls(upnl) + '">' + (upnl >= 0 ? '+' : '') + usd(upnl) + '</div><div class="pd-sub"><span>cash ' + usd(cash || 0) + '</span><span>margin ' + usd(margin) + '</span></div></div>' +
                '<div class="pd-tile" title="Smallest distance between price and a liquidation price across your open futures."><div class="pd-k">Closest to liquidation</div><div class="pd-v ' + (worst !== undefined && worst < 5 ? 'pd-dn' : '') + '">' + (worst !== undefined ? worst.toFixed(1) + '%' : 'none') + '</div><div class="pd-sub"><span>' + fut.length + ' futures &middot; ' + hold.length + ' spot &middot; ' + ords.length + ' pending</span></div></div></div>' +
                (fRows ? '<div class="pd-k">Futures positions</div><div class="pd-tablewrap"><table class="pd-table"><thead><tr><th>Position</th><th class="pd-r">Entry</th><th class="pd-r">Mark</th><th class="pd-r">Liquidation</th><th class="pd-r">Margin</th><th class="pd-r">P&amp;L</th></tr></thead><tbody>' + fRows + '</tbody></table></div>' : '') +
                (hRows ? '<div class="pd-k" style="margin-top:.8rem">Spot holdings</div><div class="pd-tablewrap"><table class="pd-table"><thead><tr><th>Coin</th><th class="pd-r">Qty</th><th class="pd-r">Avg cost</th><th class="pd-r">Price</th><th class="pd-r">Value</th><th class="pd-r">P&amp;L</th><th class="pd-r">Exits</th></tr></thead><tbody>' + hRows + '</tbody></table></div>' : '') +
                '<p class="pd-fine">Live view of your practice account (virtual money). Place, close and manage orders on the <a class="pd-a" href="trade">Trade page</a>. Click a row to chart that coin.</p>';
            $$('tr[data-sym]', pane).forEach(tr => tr.addEventListener('click', () => pickSymbol(tr.dataset.sym, tr.dataset.f === '1')));
        }
        tabs.mine = {
            start() { draw(); clearInterval(timer); timer = setInterval(() => { if (visible()) draw(); }, 2000); },
            stop() { clearInterval(timer); timer = null; }
        };
    })();

    // ---------- market breadth meter (top strip) ----------
    function breadth() {
        if (typeof marketMap === 'undefined') return;
        const spot = Object.keys(marketMap).map(k => marketMap[k]).filter(a => !a.isFutures && a.volume > 1e6);
        if (spot.length < 10) return;
        const up = spot.filter(a => a.changePct > 0).length, p = up / spot.length * 100;
        const el = $('#pd-breadth'), f = $('#pd-breadth-fill');
        if (el) { el.textContent = p.toFixed(0) + '% up'; el.className = 'text-sm font-mono font-bold ' + (p >= 55 ? 'pd-up' : p <= 45 ? 'pd-dn' : 'text-gray-300'); }
        if (f) f.style.width = p.toFixed(0) + '%';
    }
    setInterval(breadth, 3000);

    // ---------- follow the selected coin ----------
    function watchAsset() {
        const a = currentAsset();
        const id = a ? a.id : null;
        const symEl = $('#pd-sym');
        if (id !== lastAssetId) {
            lastAssetId = id;
            if (symEl) symEl.textContent = a ? a.baseAsset + (a.isFutures ? ' perp' : ' spot') : '';
            const t = tabs[activeTab];
            if (t && t.onAsset && visible()) t.onAsset();
        }
    }
    setInterval(watchAsset, 500);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { const t = tabs[activeTab]; if (t && t.stop) t.stop(); }
        else if (tabs[activeTab] && tabs[activeTab].start) tabs[activeTab].start();
    });

    // Start the open tab only once the Pro Desk is near the viewport, so first paint stays fast.
    let started = false;
    function boot() {
        if (started) return;
        started = true;
        showTab(activeTab);
        // keep the liquidation counter on its tab alive in the background after a short delay
        setTimeout(() => { if (liq.connect) liq.connect(); }, 4000);
    }
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((en) => { if (en.some(e => e.isIntersecting)) { io.disconnect(); boot(); } }, { rootMargin: '300px' });
        io.observe(root);
    } else { boot(); }
    // show the right tab highlight immediately (no data fetch yet)
    tabBtns.forEach(b => b.classList.toggle('is-on', b.dataset.pdTab === activeTab));
    Object.keys(panes).forEach(n => { panes[n].hidden = n !== activeTab; });
})();