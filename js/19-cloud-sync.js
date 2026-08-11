// ---------- Cloud Sync (Supabase) ----------
// Mirrors a curated subset of this browser's cw_ localStorage keys to Supabase's app_state
// table so a signed-in visitor sees the same watchlist, alerts, holdings, notes, and paper
// trading account on every device. Purely additive: with no Supabase config, or while signed
// out, everything behaves exactly as before (local-only, nothing changes). Depends on
// window.cwAuth from js/17-auth.js, so this must load after it. Requires supabase-js (the
// same CDN script 17-auth.js uses) and js/00-config.js.
//
// Strategy: on sign-in, pull the remote row and compare its server-set updated_at against the
// timestamp we locally remember from our last successful push. Whichever side is newer wins
// wholesale — this is a personal single-blob sync, not a field-by-field merge, so the same
// device you used most recently is the one whose data survives. Good enough for a solo
// dashboard; a person actively editing on two devices at once isn't the target use case.
// After the initial sync, a lightweight poll (comparing a JSON snapshot of the synced keys)
// detects local changes and pushes them, debounced, without requiring every other module to be
// instrumented with sync calls.

(function () {
    // Deliberately short allowlist. Excluded on purpose:
    //   - cw_groq_api_key: a personal secret, must never leave this browser.
    //   - cw_ai_history / cw_alert_history: unbounded local scrollback, not core account state.
    const SYNCED_KEYS = [
        'cw_watchlist', 'cw_alerts', 'cw_holdings', 'cw_futures_positions', 'cw_notes',
        'cw_paper_cash', 'cw_paper_deposited', 'cw_paper_equity_curve', 'cw_paper_holdings',
        'cw_paper_orders', 'cw_paper_trades', 'cw_accent', 'cw_sound_enabled', 'cw_last_selection',
    ];

    const META_KEY = 'cw_sync_meta'; // { lastPushedAt } — an ISO timestamp from the SERVER, not this browser's clock
    const POLL_MS = 4000;
    const PUSH_DEBOUNCE_MS = 2500;

    let client = null;
    let userId = null;
    let pushTimer = null;
    let pollTimer = null;
    let lastLocalSnapshot = null;
    let status = 'idle'; // idle | syncing | synced | error
    const statusListeners = [];

    function setStatus(next) {
        status = next;
        statusListeners.forEach((cb) => { try { cb(status); } catch { /* listener's problem, not ours */ } });
        renderStatusUI();
    }

    function readMeta() {
        try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
    }
    function writeMeta(meta) {
        try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* storage full/unavailable — sync just retries next cycle */ }
    }

    function snapshotLocal() {
        const out = {};
        for (const k of SYNCED_KEYS) {
            const v = localStorage.getItem(k);
            if (v !== null) out[k] = v;
        }
        return out;
    }

    function applyRemote(state) {
        if (!state || typeof state !== 'object') return;
        const before = JSON.stringify(snapshotLocal());
        for (const k of SYNCED_KEYS) {
            if (Object.prototype.hasOwnProperty.call(state, k)) {
                try { localStorage.setItem(k, state[k]); } catch { /* ignore individual key write failures */ }
            }
        }
        const after = JSON.stringify(snapshotLocal());
        lastLocalSnapshot = after;
        // Other modules (state/portfolio/paper-trading/alerts) read localStorage once at their
        // own load time and cache it in memory with no shared re-render hook — dispatch this for
        // any listener that wants it, and also do a one-time reload when the data we just applied
        // is actually different from what was already on this device (e.g. switching devices, or
        // clicking "sync now" after changes elsewhere). Same-device re-syncs where nothing changed
        // never hit this path.
        document.dispatchEvent(new CustomEvent('cw:cloud-sync-applied'));
        if (before !== after && document.visibilityState !== 'hidden') {
            setTimeout(() => window.location.reload(), 60);
        }
    }

    async function pushNow() {
        if (!client || !userId) return;
        setStatus('syncing');
        const state = snapshotLocal();
        try {
            const { data, error } = await client
                .from('app_state')
                .upsert({ user_id: userId, state }, { onConflict: 'user_id' })
                .select('updated_at')
                .single();
            if (error) throw error;
            writeMeta({ lastPushedAt: data?.updated_at || new Date().toISOString() });
            lastLocalSnapshot = JSON.stringify(state);
            setStatus('synced');
        } catch (err) {
            console.error('[CryptoBolt] Cloud sync push failed:', err?.message || err);
            setStatus('error');
        }
    }

    function schedulePush() {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(pushNow, PUSH_DEBOUNCE_MS);
    }

    function flushPendingPush() {
        if (pushTimer) {
            clearTimeout(pushTimer);
            pushTimer = null;
            pushNow();
        }
    }

    async function pullAndMerge() {
        if (!client || !userId) return;
        setStatus('syncing');
        try {
            const { data, error } = await client
                .from('app_state')
                .select('state, updated_at')
                .eq('user_id', userId)
                .maybeSingle();
            if (error) throw error;

            const meta = readMeta();
            const hasRemoteData = data && data.state && Object.keys(data.state).length > 0;
            const remoteIsNewer = hasRemoteData && (!meta.lastPushedAt || new Date(data.updated_at) > new Date(meta.lastPushedAt));
            const localHasAnyData = SYNCED_KEYS.some((k) => localStorage.getItem(k) !== null);

            if (hasRemoteData && (remoteIsNewer || !localHasAnyData)) {
                applyRemote(data.state);
                writeMeta({ lastPushedAt: data.updated_at });
                setStatus('synced');
                return;
            }
            // No remote row yet, or this device's local copy is the newer/authoritative one.
            await pushNow();
        } catch (err) {
            console.error('[CryptoBolt] Cloud sync pull failed:', err?.message || err);
            setStatus('error');
        }
    }

    function startPolling() {
        stopPolling();
        lastLocalSnapshot = JSON.stringify(snapshotLocal());
        pollTimer = setInterval(() => {
            const snap = JSON.stringify(snapshotLocal());
            if (snap !== lastLocalSnapshot) {
                lastLocalSnapshot = snap;
                schedulePush();
            }
        }, POLL_MS);
    }
    function stopPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = null;
    }

    // Flush any pending debounced push immediately when the tab is about to lose focus/close,
    // so a change made seconds before navigating away isn't lost.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushPendingPush();
    });

    // ---------- Optional status UI (present on pages that include the markup; safe no-op otherwise) ----------
    function renderStatusUI() {
        const wrap = document.getElementById('cloud-sync-status');
        const dot = document.getElementById('cloud-sync-dot');
        const label = document.getElementById('cloud-sync-label');
        if (!wrap) return;
        if (!userId) { wrap.classList.add('hidden'); wrap.classList.remove('flex'); return; }
        wrap.classList.remove('hidden');
        wrap.classList.add('flex');
        if (dot) dot.className = `status-dot ${status === 'error' ? 'status-error' : status === 'syncing' ? 'status-connecting' : 'status-live'}`;
        if (label) label.innerText = status === 'error' ? 'sync error' : status === 'syncing' ? 'syncing…' : 'synced';
        wrap.title = status === 'error'
            ? 'Cloud sync failed — click to retry'
            : status === 'syncing'
                ? 'Syncing your watchlist, alerts, holdings & paper account…'
                : 'Your watchlist, alerts, holdings & paper account are synced to your account. Click to sync now.';
    }

    document.getElementById && document.addEventListener('DOMContentLoaded', () => {
        const wrap = document.getElementById('cloud-sync-status');
        wrap?.addEventListener('click', () => { if (userId) pullAndMerge(); });
    });

    window.cwCloudSync = {
        getStatus: () => status,
        onStatusChange: (cb) => statusListeners.push(cb),
        syncNow: () => (userId ? pullAndMerge() : Promise.resolve()),
    };

    function boot() {
        if (typeof window.cwAuth === 'undefined') {
            console.info('[CryptoBolt] Cloud sync disabled — js/17-auth.js did not load before js/19-cloud-sync.js.');
            return;
        }
        window.cwAuth.onChange(async (user, configured) => {
            client = configured ? window.cwAuth.getClient() : null;
            if (user && client) {
                userId = user.id;
                await pullAndMerge();
                startPolling();
            } else {
                userId = null;
                stopPolling();
                setStatus('idle');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
