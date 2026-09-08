// ---------- Referrals: "Invite friends, both of you get $500 virtual cash" ----------
// Runs on every page that includes it (index.html, trade.html, account.html). Three jobs,
// each independent of the others so this works no matter which subset of markup a page has:
//
//   1. On ANY page: if the URL has ?ref=USERNAME, remember it in localStorage so it survives
//      navigating to wherever the visitor actually signs up. js/17-auth.js reads it back via
//      window.cwReferral.getStoredRefCode() and sends it along with signUp() — a database
//      trigger (handle_new_user(), see supabase/schema.sql) does the actual bookkeeping.
//   2. On account.html (if #referral-link-input is present): shows the signed-in visitor their
//      own shareable link and how many friends have signed up through it.
//   3. On trade.html (if window.cwPaperTrading is present): once signed in, claims any
//      outstanding referral bonus (server-side, via claim_referral_bonus() — safe to call
//      repeatedly, it only ever pays out once per referral) and deposits it as virtual cash.
//
// Depends on window.cwAuth (js/17-auth.js, must load first) and, for job 3, on
// window.cwPaperTrading (js/16-paper-trading.js, must load first).

(function () {
    const REF_STORAGE_KEY = 'cw_referral_code';
    const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

    // ---------- Job 1: capture ?ref= from the URL (runs unconditionally) ----------
    try {
        const params = new URLSearchParams(window.location.search);
        const ref = (params.get('ref') || '').trim();
        // Never overwrite an already-stored code — first link a visitor clicked wins, so
        // clicking their own trade.html link later (e.g. after signing in) can't stomp it.
        if (ref && USERNAME_RE.test(ref) && !localStorage.getItem(REF_STORAGE_KEY)) {
            localStorage.setItem(REF_STORAGE_KEY, ref);
        }
    } catch (err) {
        // Storage can throw in locked-down/private-browsing contexts — referral capture just
        // silently no-ops, it's not essential to the page working.
    }

    window.cwReferral = {
        getStoredRefCode: () => {
            try { return localStorage.getItem(REF_STORAGE_KEY) || ''; } catch { return ''; }
        },
    };

    if (!window.cwAuth) return; // page doesn't load js/17-auth.js — nothing else to do here

    function showToast(message, tone = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toneMap = { success: { color: 'var(--cw-green)', icon: '✓' }, error: { color: 'var(--cw-red)', icon: '✕' }, info: { color: 'var(--cw-cyan)', icon: 'ℹ' } };
        const { color, icon } = toneMap[tone] || toneMap.info;
        const el = document.createElement('div');
        el.className = 'toast-enter cw-toast rounded-lg pr-4 py-2.5 text-xs shadow-2xl max-w-xs border border-gray-800';
        el.style.setProperty('--cw-tone', color);
        el.innerText = ''; // set via child spans below (avoids re-parsing `message` as HTML)
        const iconSpan = document.createElement('span');
        iconSpan.className = 'cw-toast-icon text-[13px]';
        iconSpan.innerText = icon;
        const msgSpan = document.createElement('span');
        msgSpan.className = 'font-mono leading-snug pt-px';
        msgSpan.style.color = color;
        msgSpan.innerText = message;
        el.appendChild(iconSpan);
        el.appendChild(msgSpan);
        container.appendChild(el);
        setTimeout(() => { el.style.transition = 'opacity 0.4s, transform 0.4s'; el.style.opacity = '0'; el.style.transform = 'translateX(16px)'; setTimeout(() => el.remove(), 400); }, 5500);
    }

    function fmtUsd(n) {
        return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // ---------- Job 2: account.html "Invite & Earn" card ----------
    const linkInput = document.getElementById('referral-link-input');
    const copyBtn = document.getElementById('referral-copy-btn');
    const countEl = document.getElementById('referral-count');
    const msgEl = document.getElementById('referral-msg');

    if (linkInput && copyBtn) {
        function showInviteMsg(text, tone) {
            if (!msgEl) return;
            msgEl.innerText = text;
            msgEl.style.color = tone === 'error' ? 'var(--cw-red)' : 'var(--cw-green)';
            msgEl.classList.remove('hidden');
        }

        async function renderInviteCard(user) {
            const client = window.cwAuth.getClient();
            if (!user || !client) {
                linkInput.value = '';
                linkInput.placeholder = 'Sign in to get your invite link';
                if (countEl) countEl.textContent = '0';
                return;
            }
            try {
                const { data: profile } = await client.from('profiles').select('username').eq('id', user.id).single();
                if (profile?.username) {
                    linkInput.value = `${window.location.origin}/trade.html?ref=${encodeURIComponent(profile.username)}`;
                }
            } catch (err) {
                console.error('[CryptoBolt] Failed to load referral link:', err.message);
            }
            try {
                const { count } = await client.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', user.id);
                if (countEl) countEl.textContent = String(count || 0);
            } catch (err) {
                console.error('[CryptoBolt] Failed to load referral count:', err.message);
            }
        }

        window.cwAuth.onChange((user) => { renderInviteCard(user); });

        copyBtn.addEventListener('click', async () => {
            if (!linkInput.value) { showInviteMsg('Sign in first to get your personal invite link.', 'error'); return; }
            try {
                await navigator.clipboard.writeText(linkInput.value);
                showInviteMsg('Link copied — share it anywhere!', 'success');
            } catch (err) {
                linkInput.removeAttribute('readonly');
                linkInput.select();
                document.execCommand('copy');
                linkInput.setAttribute('readonly', 'true');
                showInviteMsg('Link copied!', 'success');
            }
        });
    }

    // ---------- Job 3: trade.html — claim any outstanding bonus ----------
    if (window.cwPaperTrading && typeof window.cwPaperTrading.addBonusCash === 'function') {
        let claimed = false; // guards against onChange firing more than once per page load
        window.cwAuth.onChange(async (user, configured) => {
            if (!user || !configured || claimed) return;
            claimed = true;
            const client = window.cwAuth.getClient();
            if (!client) return;
            try {
                const { data, error } = await client.rpc('claim_referral_bonus');
                if (error) throw error;
                const amount = Number(data) || 0;
                if (amount > 0) {
                    window.cwPaperTrading.addBonusCash(amount);
                    showToast(`Referral bonus: +${fmtUsd(amount)} virtual cash added to your account!`, 'success');
                }
            } catch (err) {
                console.error('[CryptoBolt] Failed to claim referral bonus:', err.message);
                claimed = false; // allow a retry on the next auth event (e.g. token refresh)
            }
        });
    }
})();