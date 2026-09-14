// ---------------------------------------------------------------------------
// Uncaught frontend error reporting.
//
// Every other error-handling path in this codebase (an AI call failing, a WS reconnect, cloud
// sync) already shows the visitor a toast and moves on — this is for the OTHER kind of bug: an
// uncaught exception or unhandled promise rejection that a visitor hits with no way to tell you
// about it except emailing in. Reports POST to /api/client-error (see that file for exactly
// what is and isn't sent) and are entirely best-effort: a failed report is silently dropped,
// never retried, never shown to the visitor. Loaded as its own file — same pattern as
// consent-default.js/theme-init.js — so it's attached before the rest of the page's scripts run
// and can catch errors from anywhere, including a syntax error in a later bundle.
// ---------------------------------------------------------------------------

(function () {
    var MAX_REPORTS_PER_PAGE = 20; // a real bug can throw on every tick — cap it, don't loop forever
    var sentCount = 0;

    function resolveApiUrl(path) {
        var base = (typeof CW_CONFIG !== 'undefined' && CW_CONFIG.apiBaseUrl ? CW_CONFIG.apiBaseUrl : '').replace(/\/$/, '');
        return base + path;
    }

    function report(message, stack) {
        if (sentCount >= MAX_REPORTS_PER_PAGE) return;
        sentCount++;
        try {
            fetch(resolveApiUrl('/api/client-error'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: String(message || '').slice(0, 500),
                    stack: String(stack || '').slice(0, 4000),
                    url: window.location.href,
                }),
                keepalive: true, // so a report tied to a page-unload error still has a chance to send
            }).catch(function () { /* best-effort — no retry, no visible failure */ });
        } catch (e) { /* fetch itself unavailable/blocked — nothing more to do */ }
    }

    window.addEventListener('error', function (event) {
        // Ignore cross-origin script errors (event.error is null and message is the generic
        // "Script error." string browsers substitute for security) — there's no useful stack to
        // report anyway, and third-party scripts (ad/analytics tags) firing these would otherwise
        // dominate the reports for something this codebase can't fix.
        if (!event.error && event.message === 'Script error.') return;
        report(event.message, event.error && event.error.stack);
    });

    window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason;
        var message = reason && reason.message ? reason.message : String(reason);
        var stack = reason && reason.stack ? reason.stack : '';
        report('Unhandled promise rejection: ' + message, stack);
    });
})();