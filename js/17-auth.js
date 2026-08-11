// ---------- Accounts (Supabase Auth) ----------
// Shared across every page that includes this script (index.html, account.html). Handles
// sign up / log in / log out and keeps the header's auth chip in sync. Other scripts (like
// 14-transak.js and account.html's own page script) listen for the 'cw:auth' event on
// `document` rather than reaching into this module directly, so load order doesn't matter:
//   document.addEventListener('cw:auth', (e) => { const user = e.detail.user; ... });
// `window.cwAuth.getUser()` is also available for a one-off synchronous-ish read (returns
// whatever the last known session was; null until the initial session check resolves).

(function () {
    let supabaseClient = null;
    let currentUser = null;
    let configured = false;
    let resolved = false; // true once the initial getSession() check has completed at least once
    const changeListeners = [];

    if (typeof CW_CONFIG !== 'undefined' && CW_CONFIG.supabaseUrl && CW_CONFIG.supabaseAnonKey && typeof supabase !== 'undefined') {
        try {
            supabaseClient = supabase.createClient(CW_CONFIG.supabaseUrl, CW_CONFIG.supabaseAnonKey);
            configured = true;
        } catch (err) {
            console.error('[CryptoBolt] Failed to initialize Supabase client:', err.message);
        }
    } else {
        console.info('[CryptoBolt] Supabase not configured — accounts are disabled until supabaseUrl/supabaseAnonKey are set in js/00-config.js.');
    }

    function broadcastAuth() {
        resolved = true;
        document.dispatchEvent(new CustomEvent('cw:auth', { detail: { user: currentUser, configured } }));
        changeListeners.forEach(cb => cb(currentUser, configured));
    }

    window.cwAuth = {
        getUser: () => currentUser,
        isConfigured: () => configured,
        getClient: () => supabaseClient,
        // Registers a callback for auth state changes. If the initial session check has already
        // resolved by the time this is called (a real possibility — supabase-js can resolve
        // getSession() from a cached local session before the next <script> tag even runs), the
        // callback fires immediately with the current state instead of only on the NEXT change.
        // This is the safe way for another page script to learn the current user; listening for
        // the 'cw:auth' document event alone can race and miss the first broadcast.
        onChange: (callback) => {
            changeListeners.push(callback);
            if (resolved) callback(currentUser, configured);
        },
    };

    // ---------- Header chip (present on any page that includes this markup) ----------
    const openBtn = document.getElementById('auth-open-btn');
    const userChip = document.getElementById('auth-user-chip');
    const userEmailEl = document.getElementById('auth-user-email');
    const signOutBtn = document.getElementById('auth-signout-btn');

    function renderHeader() {
        if (!openBtn || !userChip) return;
        if (currentUser) {
            openBtn.classList.add('hidden');
            userChip.classList.remove('hidden');
            userChip.classList.add('flex');
            if (userEmailEl) userEmailEl.title = currentUser.email || '';
        } else {
            openBtn.classList.remove('hidden');
            userChip.classList.add('hidden');
            userChip.classList.remove('flex');
        }
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            if (!supabaseClient) return;
            await supabaseClient.auth.signOut();
        });
    }

    // ---------- Auth modal (sign up / log in / forgot password) ----------
    const modal = document.getElementById('auth-modal');
    if (modal) {
        const tabSignIn = document.getElementById('auth-tab-signin');
        const tabSignUp = document.getElementById('auth-tab-signup');
        const emailInput = document.getElementById('auth-email-input');
        const passwordInput = document.getElementById('auth-password-input');
        const submitBtn = document.getElementById('auth-submit-btn');
        const errorEl = document.getElementById('auth-error');
        const infoEl = document.getElementById('auth-info');
        const forgotLink = document.getElementById('auth-forgot-link');
        const configWarning = document.getElementById('auth-config-warning');
        let mode = 'signin'; // 'signin' | 'signup'

        function setMode(next) {
            mode = next;
            tabSignIn.classList.toggle('auth-tab-active', mode === 'signin');
            tabSignUp.classList.toggle('auth-tab-active', mode === 'signup');
            submitBtn.innerText = mode === 'signin' ? 'Sign In' : 'Create Account';
            forgotLink.classList.toggle('hidden', mode !== 'signin');
            errorEl.classList.add('hidden');
            infoEl.classList.add('hidden');
        }
        tabSignIn?.addEventListener('click', () => setMode('signin'));
        tabSignUp?.addEventListener('click', () => setMode('signup'));

        function openModal() {
            if (!configured) {
                configWarning?.classList.remove('hidden');
            } else {
                configWarning?.classList.add('hidden');
            }
            errorEl.classList.add('hidden');
            infoEl.classList.add('hidden');
            emailInput.value = '';
            passwordInput.value = '';
            modal.classList.add('cw-visible');
            setMode('signin');
        }
        function closeModal() { modal.classList.remove('cw-visible'); }

        openBtn?.addEventListener('click', openModal);
        document.getElementById('auth-modal-close')?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('cw-visible')) closeModal(); });

        function showError(msg) { errorEl.innerText = msg; errorEl.classList.remove('hidden'); infoEl.classList.add('hidden'); }
        function showInfo(msg) { infoEl.innerText = msg; infoEl.classList.remove('hidden'); errorEl.classList.add('hidden'); }

        submitBtn?.addEventListener('click', async () => {
            if (!supabaseClient) { showError('Accounts are not set up yet on this deployment.'); return; }
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            if (!email || !/^\S+@\S+\.\S+$/.test(email)) { showError('Enter a valid email address.'); return; }
            if (!password || password.length < 6) { showError('Password must be at least 6 characters.'); return; }

            submitBtn.disabled = true;
            const originalLabel = submitBtn.innerText;
            submitBtn.innerText = 'Please wait…';
            try {
                if (mode === 'signup') {
                    const { data, error } = await supabaseClient.auth.signUp({ email, password });
                    if (error) throw error;
                    if (data.session) {
                        showInfo('Account created! You\'re signed in.');
                        setTimeout(closeModal, 900);
                    } else {
                        showInfo('Account created — check your email to confirm before signing in.');
                    }
                } else {
                    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                    closeModal();
                }
            } catch (err) {
                showError(err.message || 'Something went wrong — try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalLabel;
            }
        });

        forgotLink?.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!supabaseClient) return;
            const email = emailInput.value.trim();
            if (!email || !/^\S+@\S+\.\S+$/.test(email)) { showError('Enter your email above first, then click "Forgot password?" again.'); return; }
            try {
                const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account.html` });
                if (error) throw error;
                showInfo('Password reset email sent — check your inbox.');
            } catch (err) {
                showError(err.message || 'Could not send reset email.');
            }
        });
    }

    // ---------- Boot: check existing session, then react to changes ----------
    if (supabaseClient) {
        supabaseClient.auth.getSession().then(({ data }) => {
            currentUser = data?.session?.user || null;
            renderHeader();
            broadcastAuth();
        });
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            currentUser = session?.user || null;
            renderHeader();
            broadcastAuth();
        });
    } else {
        renderHeader();
        broadcastAuth();
    }
})();
