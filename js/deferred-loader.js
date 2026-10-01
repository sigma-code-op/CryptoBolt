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

    // Only pages whose <script> tag carries data-ads ever had AdSense.
    var wantsAds = !!(document.currentScript && document.currentScript.hasAttribute('data-ads'));
    if (!wantsAds) return;

    var adsLoaded = false;
    function loadAds() {
        if (adsLoaded) return;
        adsLoaded = true;
        var s = document.createElement('script');
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7149913639439821';
        document.head.appendChild(s);
    }

    ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
        window.addEventListener(ev, loadAds, { once: true, passive: true });
    });
    function afterLoad() { setTimeout(loadAds, 3500); }
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad);
})();