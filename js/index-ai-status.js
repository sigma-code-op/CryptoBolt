// ---------------------------------------------------------------------------
// index.html: reflect whether this deployment has a shared "house" Groq key
// configured, so the homepage doesn't claim a free trial that isn't really
// there. Extracted from an inline <script> so the page can run under a
// Content-Security-Policy without 'unsafe-inline' in script-src.
// ---------------------------------------------------------------------------

(function () {
    fetch("https://api.cryptobolt.io/api/health")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
            if (!data || !data.houseKeyEnabled) return;
            var note = document.getElementById("mk-ai-key-note");
            var cta = document.getElementById("mk-ai-poster-note");
            if (note) note.textContent = "Free to try instantly — no API key needed";
            if (cta) cta.textContent = "No signup, no key — try it now";
        })
        .catch(function () { /* leave the default BYOK copy in place */ });
})();