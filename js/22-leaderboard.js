// ---------- Paper Trading Leaderboard ----------
// Runs on trade.html only. Turns the paper trading account into a weekly/monthly
// competition between signed-in visitors: "who's made the most virtual money".
//
// Depends on window.cwAuth (js/17-auth.js, must load first) for the Supabase client + current
// user, and on window.cwPaperTrading.getEquity() (exported at the bottom of
// js/16-paper-trading.js) to read this browser's current paper account equity. With no
// Supabase config, or while signed out, the card just shows a sign-in prompt — paper trading
// itself keeps working exactly as before either way.
//
// How ranking works (see supabase/schema.sql for the full picture):
//   - Every signed-in visitor's browser periodically calls the submit_paper_equity() Postgres
//     function with its current equity. That function is the only thing allowed to decide when
//     a new week/month has started and reset that user's baseline — the client just reports a
//     number, it never sets its own "starting" value.
//   - "Gain" = current equity − equity at the start of the period, computed by the database
//     (generated columns) so ranking is a plain ORDER BY, not something recomputed per visitor.

(function () {
    const SUBMIT_INTERVAL_MS = 45000;
    const REFRESH_INTERVAL_MS = 20000;
    const TAB_ACTIVE_CLASSES = ['bg-[#14d38a]', 'text-[#0b0e11]'];
    const TAB_INACTIVE_CLASSES = ['text-gray-400'];

    function fmtUsd(n, opts) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        return `$${n.toLocaleString(undefined, opts || { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    function fmtSigned(n) {
        if (n === null || n === undefined || isNaN(n)) return '--';
        return `${n >= 0 ? '+' : ''}${fmtUsd(n)}`;
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
    function rankBadge(rank) {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    }

    const card = document.getElementById('leaderboard-card');
    if (!card) return; // this page doesn't have the leaderboard markup

    const signedOutPanel = document.getElementById('leaderboard-signed-out');
    const notConfiguredPanel = document.getElementById('leaderboard-not-configured');
    const body = document.getElementById('leaderboard-body');
    const rowsEl = document.getElementById('leaderboard-rows');
    const youRowEl = document.getElementById('leaderboard-you-row');
    const tabWeekBtn = document.getElementById('leaderboard-tab-week');
    const tabMonthBtn = document.getElementById('leaderboard-tab-month');

    document.getElementById('leaderboard-signin-btn')?.addEventListener('click', () => {
        document.getElementById('auth-open-btn')?.click();
    });

    let client = null;
    let userId = null;
    let period = 'week'; // 'week' | 'month'
    let submitTimer = null;
    let refreshTimer = null;
    let lastSubmittedEquity = null;

    function gainColumn() { return period === 'week' ? 'weekly_gain' : 'monthly_gain'; }
    function baselineColumn() { return period === 'week' ? 'week_start_equity' : 'month_start_equity'; }

    function setTab(next) {
        period = next;
        const activeBtn = period === 'week' ? tabWeekBtn : tabMonthBtn;
        const inactiveBtn = period === 'week' ? tabMonthBtn : tabWeekBtn;
        activeBtn?.classList.add(...TAB_ACTIVE_CLASSES);
        activeBtn?.classList.remove(...TAB_INACTIVE_CLASSES);
        inactiveBtn?.classList.remove(...TAB_ACTIVE_CLASSES);
        inactiveBtn?.classList.add(...TAB_INACTIVE_CLASSES);
        loadLeaderboard();
    }
    tabWeekBtn?.addEventListener('click', () => setTab('week'));
    tabMonthBtn?.addEventListener('click', () => setTab('month'));

    function showPanel(which) {
        signedOutPanel?.classList.toggle('hidden', which !== 'signed-out');
        notConfiguredPanel?.classList.toggle('hidden', which !== 'not-configured');
        if (body) {
            body.classList.toggle('hidden', which !== 'body');
            body.classList.toggle('block', which === 'body');
        }
    }

    async function loadLeaderboard() {
        if (!client || !userId || !rowsEl) return;
        const col = gainColumn();
        try {
            const { data: top, error } = await client
                .from('leaderboard_stats')
                .select(`username, equity, ${col}`)
                .order(col, { ascending: false })
                .limit(50);
            if (error) throw error;

            const rows = top || [];
            const meIdx = rows.findIndex((r) => r.username && window.__cwLeaderboardMe && r.username === window.__cwLeaderboardMe);

            if (!rows.length) {
                rowsEl.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-gray-600 text-[11px]">No traders on the board yet — be the first! Buy or sell something to get started.</td></tr>';
            } else {
                rowsEl.innerHTML = rows.map((r, i) => {
                    const gain = r[col] || 0;
                    const isMe = i === meIdx;
                    return `<tr class="${isMe ? 'bg-[#14d38a]/5' : ''}">
                        <td class="py-2 px-5 text-gray-500">${rankBadge(i + 1)}</td>
                        <td class="py-2 px-3 ${isMe ? 'text-[#14d38a] font-bold' : 'text-gray-300'}">${escapeHtml(r.username || 'trader')}${isMe ? ' <span class="text-[9px] text-gray-500 font-normal">(you)</span>' : ''}</td>
                        <td class="py-2 px-5 text-right font-bold ${pnlColorClass(gain)}">${fmtSigned(gain)}</td>
                    </tr>`;
                }).join('');
            }

            await renderYourRow(rows, meIdx, col);
            showPanel('body');
        } catch (err) {
            console.error('[CryptoBolt] Leaderboard load failed:', err?.message || err);
            rowsEl.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-gray-600 text-[11px]">Couldn\'t load the leaderboard — try again shortly.</td></tr>';
            showPanel('body');
        }
    }

    async function renderYourRow(topRows, meIdx, col) {
        if (!youRowEl) return;
        if (meIdx !== -1) {
            youRowEl.classList.add('hidden'); // already visible highlighted inside the table
            return;
        }
        // Not in the visible top 50 — fetch your own row + rank separately so you can still
        // see where you stand.
        try {
            const { data: mine, error } = await client
                .from('leaderboard_stats')
                .select(`username, ${col}`)
                .eq('user_id', userId)
                .maybeSingle();
            if (error || !mine) { youRowEl.classList.add('hidden'); return; }
            window.__cwLeaderboardMe = mine.username;
            const myGain = mine[col] || 0;
            const { count, error: countErr } = await client
                .from('leaderboard_stats')
                .select('user_id', { count: 'exact', head: true })
                .gt(col, myGain);
            const rank = countErr || count === null ? null : count + 1;
            youRowEl.classList.remove('hidden');
            youRowEl.classList.add('flex');
            youRowEl.innerHTML = `
                <span class="text-gray-400">${rank ? rankBadge(rank) : '—'} <span class="text-[#14d38a] font-bold">${escapeHtml(mine.username || 'you')}</span> <span class="text-[9px] text-gray-500">(you)</span></span>
                <span class="font-bold ${pnlColorClass(myGain)}">${fmtSigned(myGain)}</span>`;
        } catch {
            youRowEl.classList.add('hidden');
        }
    }

    async function submitEquity() {
        if (!client || !userId) return;
        const equity = window.cwPaperTrading?.getEquity ? window.cwPaperTrading.getEquity() : null;
        if (equity === null || equity === undefined || isNaN(equity)) return;
        if (lastSubmittedEquity !== null && Math.abs(equity - lastSubmittedEquity) < 0.01) return; // nothing changed
        try {
            const { error } = await client.rpc('submit_paper_equity', { p_equity: equity });
            if (error) throw error;
            lastSubmittedEquity = equity;
        } catch (err) {
            console.error('[CryptoBolt] Leaderboard equity submit failed:', err?.message || err);
        }
    }

    function startLoops() {
        stopLoops();
        submitEquity();
        loadLeaderboard();
        submitTimer = setInterval(submitEquity, SUBMIT_INTERVAL_MS);
        refreshTimer = setInterval(loadLeaderboard, REFRESH_INTERVAL_MS);
    }
    function stopLoops() {
        if (submitTimer) clearInterval(submitTimer);
        if (refreshTimer) clearInterval(refreshTimer);
        submitTimer = null;
        refreshTimer = null;
    }

    // Flush a fresh equity submission right before the tab closes/hides, so a trade made
    // seconds before navigating away still counts toward this period.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && userId) submitEquity();
    });

    function boot() {
        if (typeof window.cwAuth === 'undefined') return;
        window.cwAuth.onChange((user, configured) => {
            if (!configured) {
                showPanel('not-configured');
                stopLoops();
                return;
            }
            client = window.cwAuth.getClient();
            if (user) {
                userId = user.id;
                setTab(period); // sets tab styling + triggers first load
                startLoops();
            } else {
                userId = null;
                stopLoops();
                showPanel('signed-out');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();