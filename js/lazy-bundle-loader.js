// ---------------------------------------------------------------------------
// Lazy-loads js/dist/bundle-home-lazy.js (AI insight panel, closed-tab push alerts,
// referrals, screener, exchange-compare) — none of which are needed for first paint or
// for the terminal's core price/chart/portfolio flow, since every one of them is reached
// by clicking something. Shipping that ~72KB of script up front was pure wasted
// main-thread work during the page's busiest moment (see scripts/build-js.js for the
// bundle split and why it's safe — every module in the lazy bundle already guards its
// calls with `typeof x === 'function'` / truthy checks).
//
// Loaded once the browser is idle after startup, or immediately on the visitor's first
// pointer/keyboard interaction if that happens sooner, so a fast click on e.g. the
// Screener button never has to wait for an idle window that hasn't happened yet.
//
// Extracted to its own file (same reason as js/consent-default.js, js/error-reporter.js,
// etc. — see scripts/build-csp.js) rather than an inline <script>, so the page's CSP can
// keep script-src free of 'unsafe-inline'.
(function () {
    var loaded = false;
    var INTERACTION_EVENTS = ['pointerdown', 'keydown', 'touchstart'];

    function loadLazyBundle() {
        if (loaded) return;
        loaded = true;
        var s = document.createElement('script');
        s.src = 'js/dist/bundle-home-lazy.js?v=20260916';
        document.body.appendChild(s);
        INTERACTION_EVENTS.forEach(function (evt) {
            document.removeEventListener(evt, loadLazyBundle);
        });
    }

    INTERACTION_EVENTS.forEach(function (evt) {
        document.addEventListener(evt, loadLazyBundle, { passive: true });
    });

    if ('requestIdleCallback' in window) {
        requestIdleCallback(loadLazyBundle, { timeout: 3000 });
    } else {
        window.addEventListener('load', function () { setTimeout(loadLazyBundle, 1000); });
    }
})();