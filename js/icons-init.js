// Renders every <i data-lucide="..."> placeholder into an inline SVG icon.
// Loaded after the lucide UMD bundle (see <script src="https://unpkg.com/lucide...">
// in <head>/<body>). Kept as its own file — not inlined — because the site's CSP
// (scripts/build-csp.js) intentionally has no 'unsafe-inline' on script-src.
//
// The trading terminal pages (app/trade/invest/account/ai) render a lot of their
// UI at runtime — alerts, AI chat bubbles, paper-trading rows, screener results —
// so a one-shot render on DOMContentLoaded isn't enough: any <i data-lucide> added
// after that point would stay an inert <i> tag. A MutationObserver re-renders on
// every DOM change instead, batched with requestAnimationFrame so a burst of
// updates (e.g. a table re-render) only triggers one pass.
(function () {
    var pending = false;

    function renderIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function scheduleRender() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
            pending = false;
            renderIcons();
        });
    }

    function nodeHasIconPlaceholder(node) {
        if (node.nodeType !== 1) return false; // element nodes only
        if (node.hasAttribute && node.hasAttribute('data-lucide')) return true;
        return !!(node.querySelector && node.querySelector('[data-lucide]'));
    }

    function start() {
        renderIcons();
        if (!window.MutationObserver) return;
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    if (nodeHasIconPlaceholder(added[j])) {
                        scheduleRender();
                        return;
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();