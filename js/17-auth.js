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
                    if (error) {
                        // Some Supabase configs throw this outright for a duplicate email.
                        if (/already registered|already exists|user already/i.test(error.message || '')) {
                            setMode('signin');
                            emailInput.value = email;
                            passwordInput.value = '';
                            showError('An account with this email already exists — sign in instead, or use "Forgot password?" below.');
                            passwordInput.focus();
                            return;
                        }
                        throw error;
                    }
                    // With email confirmations on, Supabase deliberately returns a *success*
                    // response (no error) for a duplicate email too, to avoid leaking which
                    // emails are registered. The tell is an empty `identities` array — a
                    // genuinely new signup always has one identity attached.
                    const alreadyRegistered = !!data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
                    if (alreadyRegistered) {
                        setMode('signin');
                        emailInput.value = email;
                        passwordInput.value = '';
                        showError('An account with this email already exists — sign in instead, or use "Forgot password?" below.');
                        passwordInput.focus();
                        return;
                    }
                    if (data.session) {
                        showInfo('Account created! You\'re signed in.');
                        setTimeout(closeModal, 900);
                    } else {
                        showInfo('Account created — check your email to confirm before signing in.');
                    }
                } else {
                    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                    if (error) {
                        if (/invalid login credentials/i.test(error.message || '')) {
                            showError('Incorrect email or password. New here? Use the Sign Up tab instead.');
                            return;
                        }
                        throw error;
                    }
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
            const originalLabel = forgotLink.innerText;
            forgotLink.innerText = 'Sending…';
            try {
                // redirectTo must land on a page that includes this same script, since the
                // reset link carries a #type=recovery token that this file listens for below
                // (see the PASSWORD_RECOVERY branch) in order to show the "set a new password"
                // form — without that listener, the link just silently signs the user in.
                const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account.html` });
                if (error) throw error;
                showInfo('Password reset email sent — click the link in that email, then set your new password there.');
            } catch (err) {
                showError(err.message || 'Could not send reset email.');
            } finally {
                forgotLink.innerText = originalLabel;
            }
        });
    }

    // ---------- Continue with Google ----------
    // Present on the same modal markup on index.html and account.html. Google handles both
    // "sign up" and "sign in" as a single flow — Supabase creates the account on first use and
    // just signs the user in on every visit after, so this button works regardless of which
    // tab (Sign In / Sign Up) is active.
    const googleBtn = document.getElementById('auth-google-btn');
    googleBtn?.addEventListener('click', async () => {
        if (!supabaseClient) {
            document.getElementById('auth-config-warning')?.classList.remove('hidden');
            return;
        }
        googleBtn.disabled = true;
        const originalHtml = googleBtn.innerHTML;
        googleBtn.innerHTML = 'Redirecting…';
        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
            });
            if (error) throw error;
            // On success the browser is being navigated to Google right now — nothing else to do.
        } catch (err) {
            const errorEl = document.getElementById('auth-error');
            const infoEl = document.getElementById('auth-info');
            if (errorEl) {
                errorEl.innerText = err.message || 'Could not start Google sign-in. Make sure the Google provider is enabled in your Supabase project.';
                errorEl.classList.remove('hidden');
            }
            infoEl?.classList.add('hidden');
            googleBtn.disabled = false;
            googleBtn.innerHTML = originalHtml;
        }
    });

    // ---------- "Forgot password" reset flow ----------
    // Supabase's reset-password link signs the visitor in automatically (that's how it proves
    // they own the inbox) and fires a PASSWORD_RECOVERY auth event instead of the usual
    // SIGNED_IN — so the fix for "it redirects but doesn't reset" is to catch that event and
    // make the visitor actually choose a new password before treating them as a normal
    // logged-in user. This modal is injected on demand so it works on any page that loads this
    // script, without needing matching markup added to every HTML file.
    let recoveryModal = null;
    function ensureRecoveryModal() {
        if (recoveryModal) return recoveryModal;
        const wrap = document.createElement('div');
        wrap.id = 'recovery-modal';
        wrap.className = 'cw-modal-backdrop';
        wrap.innerHTML = `
            <div class="cw-modal-card" style="max-width:380px;" role="dialog" aria-modal="true" aria-label="Set a new password">
                <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#1e222b]">
                    <span class="text-sm font-bold">Set a new password</span>
                    <button type="button" data-recovery-close aria-label="Close" class="text-gray-500 hover:text-white cursor-pointer text-lg leading-none">✕</button>
                </div>
                <div class="p-4 space-y-3">
                    <p class="text-[11px] text-gray-500 leading-relaxed">You followed a password reset link. Choose a new password below to finish resetting it.</p>
                    <div>
                        <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">New password</label>
                        <input type="password" data-recovery-password placeholder="At least 6 characters" autocomplete="new-password"
                            class="w-full bg-gray-900 border border-gray-800 rounded text-sm px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#14d38a]">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Confirm new password</label>
                        <input type="password" data-recovery-password-confirm placeholder="Repeat password" autocomplete="new-password"
                            class="w-full bg-gray-900 border border-gray-800 rounded text-sm px-3 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#14d38a]">
                    </div>
                    <div data-recovery-error class="hidden text-[11px] text-[#ff4d6a] bg-[#ff4d6a]/10 border border-[#ff4d6a]/20 rounded p-2"></div>
                    <div data-recovery-info class="hidden text-[11px] text-[#14d38a] bg-[#14d38a]/10 border border-[#14d38a]/20 rounded p-2"></div>
                    <button type="button" data-recovery-submit class="w-full text-sm font-bold uppercase py-2.5 rounded bg-[#14d38a] text-[#0b0e11] hover:opacity-90 transition-all cursor-pointer">Set new password</button>
                </div>
            </div>`;
        document.body.appendChild(wrap);

        const pwInput = wrap.querySelector('[data-recovery-password]');
        const pwConfirmInput = wrap.querySelector('[data-recovery-password-confirm]');
        const errEl = wrap.querySelector('[data-recovery-error]');
        const infEl = wrap.querySelector('[data-recovery-info]');
        const submit = wrap.querySelector('[data-recovery-submit]');

        function showErr(msg) { errEl.innerText = msg; errEl.classList.remove('hidden'); infEl.classList.add('hidden'); }
        function showInf(msg) { infEl.innerText = msg; infEl.classList.remove('hidden'); errEl.classList.add('hidden'); }
        function close() { wrap.classList.remove('cw-visible'); }

        wrap.querySelector('[data-recovery-close]').addEventListener('click', close);
        wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });

        submit.addEventListener('click', async () => {
            const pw = pwInput.value;
            const pw2 = pwConfirmInput.value;
            if (!pw || pw.length < 6) { showErr('Password must be at least 6 characters.'); return; }
            if (pw !== pw2) { showErr('Passwords do not match.'); return; }
            submit.disabled = true;
            const original = submit.innerText;
            submit.innerText = 'Please wait…';
            try {
                const { error } = await supabaseClient.auth.updateUser({ password: pw });
                if (error) throw error;
                showInf('Password updated — you\'re signed in with your new password.');
                pwInput.value = '';
                pwConfirmInput.value = '';
                // Strip the recovery token out of the URL so refreshing the page doesn't
                // re-open this modal.
                window.history.replaceState({}, document.title, window.location.pathname);
                setTimeout(close, 1400);
            } catch (err) {
                showErr(err.message || 'Could not update password — the reset link may have expired. Request a new one and try again.');
            } finally {
                submit.disabled = false;
                submit.innerText = original;
            }
        });

        recoveryModal = wrap;
        return wrap;
    }
    function openRecoveryModal() {
        modal?.classList.remove('cw-visible'); // don't show both modals stacked at once
        ensureRecoveryModal().classList.add('cw-visible');
    }

    // ---------- Boot: check existing session, then react to changes ----------
    if (supabaseClient) {
        supabaseClient.auth.getSession().then(({ data }) => {
            currentUser = data?.session?.user || null;
            renderHeader();
            broadcastAuth();
        });
        supabaseClient.auth.onAuthStateChange((event, session) => {
            currentUser = session?.user || null;
            renderHeader();
            broadcastAuth();
            if (event === 'PASSWORD_RECOVERY') {
                openRecoveryModal();
            }
        });
    } else {
        renderHeader();
        broadcastAuth();
    }
})();