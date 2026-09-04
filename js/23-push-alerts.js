// ---------- Closed-tab push alerts (js/23-push-alerts.js) ----------
// Companion to 07-alerts.js: that module's checkPriceAlerts() only runs while a CryptoBolt
// tab is open and pulling live ticker data. This module lets the SAME alerts (already synced
// to Supabase by 19-cloud-sync.js) also be checked server-side and delivered as a Web Push
// notification, so closing the tab doesn't silently disable the alert.
//
// Fully optional and fails silent at every step: no Push API support, no CW_CONFIG backend,
// not signed in, permission denied, deployment hasn't set up VAPID keys — any of these just
// means push alerts stay off, and in-tab alerts (07-alerts.js) keep working exactly as before.
// Depends on window.cwAuth (17-auth.js) and CW_CONFIG (00-config.js), so must load after both.

(function () {
    const ENABLED_FLAG_KEY = 'cw_push_alerts_enabled'; // this browser's own opt-in, remembered locally only
    const SW_PATH = '/sw.js';
    let swRegistrationPromise = null;

    function supported() {
        return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }

    function resolveApiUrl(path) {
        const base = (typeof CW_CONFIG !== 'undefined' && CW_CONFIG.apiBaseUrl ? CW_CONFIG.apiBaseUrl : '').replace(/\/$/, '');
        return /^https?:\/\//i.test(path) ? path : `${base}${path}`;
    }

    // Web Push wants the VAPID public key as a Uint8Array, but servers hand it out
    // base64url-encoded (see server/src/lib/push.js) since that's copy-pasteable in an .env file.
    function urlBase64ToUint8Array(base64Url) {
        const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
        const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        return bytes;
    }

    function registerServiceWorker() {
        if (!swRegistrationPromise) {
            swRegistrationPromise = navigator.serviceWorker.register(SW_PATH).catch((err) => {
                console.info('[CryptoBolt] Service worker registration failed — push alerts unavailable:', err.message);
                return null;
            });
        }
        return swRegistrationPromise;
    }

    async function getAccessToken() {
        if (!window.cwAuth || !window.cwAuth.isConfigured() || !window.cwAuth.getUser()) return null;
        const client = window.cwAuth.getClient();
        try {
            const { data } = await client.auth.getSession();
            return data?.session?.access_token || null;
        } catch {
            return null;
        }
    }

    async function fetchVapidPublicKey() {
        try {
            const res = await fetch(resolveApiUrl('/api/push/vapid-public-key'));
            if (!res.ok) return null; // 503 = this deployment hasn't configured push — stay quiet
            const data = await res.json();
            return data?.publicKey || null;
        } catch {
            return null; // backend unreachable — same as above, just stay quiet
        }
    }

    /**
     * Subscribes this browser to push alerts for the signed-in visitor. Safe to call more than
     * once (e.g. every page load) — getSubscription() reuses an existing one instead of
     * creating duplicates, and the server upserts on endpoint anyway.
     * silent: true suppresses the "enabled" toast — used for the automatic re-subscribe on
     * page load so returning visitors aren't re-notified every time.
     */
    async function subscribeToPush({ silent = false } = {}) {
        if (!supported()) return false;

        const token = await getAccessToken();
        if (!token) {
            if (!silent) showToast('Sign in to get alerts even when this tab is closed.', 'info');
            return false;
        }

        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return false;
        } else if (Notification.permission === 'denied') {
            return false;
        }

        const publicKey = await fetchVapidPublicKey();
        if (!publicKey) return false; // deployment hasn't set PUSH_VAPID_* env vars — nothing to do

        const registration = await registerServiceWorker();
        if (!registration) return false;

        let subscription;
        try {
            subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey),
                });
            }
        } catch (err) {
            console.info('[CryptoBolt] Push subscribe failed:', err.message);
            return false;
        }

        try {
            const res = await fetch(resolveApiUrl('/api/push/subscribe'), {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ subscription: subscription.toJSON() }),
            });
            if (!res.ok) return false;
        } catch {
            return false;
        }

        try { localStorage.setItem(ENABLED_FLAG_KEY, '1'); } catch { /* storage full/unavailable — not critical */ }
        if (!silent) showToast('Alerts will now reach you even with this tab closed.', 'success');
        return true;
    }

    async function unsubscribeFromPush() {
        if (!supported()) return;
        const registration = await registerServiceWorker();
        if (!registration) return;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;

        const token = await getAccessToken();
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => {});

        if (token) {
            fetch(resolveApiUrl('/api/push/unsubscribe'), {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ endpoint }),
            }).catch(() => {});
        }
        try { localStorage.removeItem(ENABLED_FLAG_KEY); } catch { /* ignore */ }
        showToast('Closed-tab alerts turned off for this browser.', 'info');
    }

    window.cwPushAlerts = {
        isSupported: supported,
        enable: () => subscribeToPush({ silent: false }),
        disable: unsubscribeFromPush,
        isEnabledOnThisBrowser: () => {
            try { return localStorage.getItem(ENABLED_FLAG_KEY) === '1'; } catch { return false; }
        },
    };

    // Quietly re-establish the subscription on load for a visitor who already opted in on this
    // browser before — a push subscription can be dropped by the browser (cleared site data,
    // long inactivity) without notice, so this is a no-op in the common case and a silent
    // repair in the uncommon one. Only runs once auth has resolved so getAccessToken() has a
    // real answer instead of racing the initial session check.
    if (window.cwAuth) {
        window.cwAuth.onChange((user) => {
            if (user && window.cwPushAlerts.isEnabledOnThisBrowser()) {
                subscribeToPush({ silent: true });
            }
        });
    }
})();