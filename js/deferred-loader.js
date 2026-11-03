// ---------------------------------------------------------------------------
// Keeps third-party work off the critical path (lower Total Blocking Time).
//   1. Google Fonts <link data-async-css media="print"> -> media="all", so the
//      font stylesheet no longer blocks first render (font-display: swap is
//      already set in the URL).
//   2. AdSense (adsbygoogle.js) loads after the page is idle / first user
//      interaction instead of competing with the page's own scripts at startup.
// External file (not inline) so script-src can stay free of 'unsafe-inline'.
// ---------------------------------------------------------------------------
(function () {
    'use strict';

    var links = document.querySelectorAll('link[data-async-css]');
    for (var i = 0; i < links.length; i++) links[i].media = 'all';

    var me = document.currentScript;
    var lazyGtag = !!(me && (me.hasAttribute('data-gtag-lazy') || me.hasAttribute('data-ads-idle')));

    // Google Analytics (gtag.js, ~150KB) loads on the first interaction or 6s after load. consent-default.js
    // has already queued the consent + config calls on dataLayer, so no event is lost; the tag just no
    // longer competes with the page's own scripts during startup.
    var gtagLoaded = false;
    function loadGtag() {
        if (gtagLoaded) return;
        gtagLoaded = true;
        if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return;
        var g = document.createElement('script');
        g.async = true;
        g.src = 'https://www.googletagmanager.com/gtag/js?id=G-BEK3KJ2TEV';
        document.head.appendChild(g);
    }
    if (lazyGtag) {
        ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
            window.addEventListener(ev, loadGtag, { once: true, passive: true });
        });
        var gtagAfterLoad = function () { setTimeout(loadGtag, 6000); };
        if (document.readyState === 'complete') gtagAfterLoad();
        else window.addEventListener('load', gtagAfterLoad);
    }

    // Only pages whose <script> tag carries data-ads ever had AdSense.
    var wantsAds = !!(me && me.hasAttribute('data-ads'));
    if (!wantsAds) return;

    // Terminal pages (data-ads-idle) wait for a real interaction so ads never compete with the live feed.
    var idleOnly = !!me.hasAttribute('data-ads-idle');
    var adsLoaded = false;
    function loadAds() {
        if (adsLoaded) return;
        adsLoaded = true;
        // Pages that already carry the AdSense <script> in their HTML (e.g. the homepage)
        // must not load it a second time.
        if (document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) return;
        var s = document.createElement('script');
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7149913639439821';
        document.head.appendChild(s);
    }

    ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
        window.addEventListener(ev, loadAds, { once: true, passive: true });
    });
    function afterLoad() { if (!idleOnly) setTimeout(loadAds, 3500); }

    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad);
})();