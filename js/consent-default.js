// ---------------------------------------------------------------------------
// Google Consent Mode v2 — default state (denied) set BEFORE gtag.js and
// adsbygoogle.js load. Extracted from an inline <head> script so every page
// can be served under a Content-Security-Policy without 'unsafe-inline' in
// script-src. See js/cookie-consent.js for the actual accept/reject banner,
// which later calls gtag('consent', 'update', ...) once the visitor chooses.
// ---------------------------------------------------------------------------

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
});
gtag('js', new Date());
gtag('config', 'G-BEK3KJ2TEV');