// ---------------------------------------------------------------------------
// Light/dark theme toggle.
//
// Re-themes the "Signal Deck" design-system surfaces built on the --cw-*
// CSS custom properties (see css/styles.css, ":root" and ":root[data-theme=light]")
// by setting a data-theme attribute on <html>. Loaded as its own file — same as
// consent-default.js — and placed early in <head>, BEFORE the stylesheet <link>
// tags, so the attribute is set before first paint and there's no flash of the
// wrong theme. This also means it must stay dependency-free, CSP-safe
// (no inline <script>, no eval), and safe to run before <body> exists.
//
// Preference order: an explicit choice stored in localStorage under 'cw_theme'
// ('light' or 'dark'), falling back to the OS-level prefers-color-scheme media
// query, falling back to 'dark' (this site's original, only theme).
//
// NOTE on coverage: only elements styled through var(--cw-*) respond to this
// toggle. A handful of older elements use hardcoded Tailwind gray utility
// classes (bg-gray-900, text-gray-400, etc.) directly instead of the shared
// variables and will keep their dark styling under light mode until migrated —
// see the comment above ":root[data-theme=light]" in css/styles.css.
// ---------------------------------------------------------------------------

(function () {
    var STORAGE_KEY = 'cw_theme';

    function getStoredTheme() {
        try {
            var v = window.localStorage.getItem(STORAGE_KEY);
            return (v === 'light' || v === 'dark') ? v : null;
        } catch (e) {
            return null; // localStorage unavailable (private mode, disabled, etc.) — fall through
        }
    }

    function systemPrefersLight() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    }

    function currentTheme() {
        return getStoredTheme() || (systemPrefersLight() ? 'light' : 'dark');
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    // Run immediately — this is the whole point of loading this file this early.
    applyTheme(currentTheme());

    function setTheme(theme) {
        applyTheme(theme);
        try { window.localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* best-effort */ }
        updateToggleButtons();
    }

    function updateToggleButtons() {
        var theme = document.documentElement.getAttribute('data-theme') || 'dark';
        var buttons = document.querySelectorAll('[data-theme-toggle]');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            btn.setAttribute('aria-pressed', String(theme === 'light'));
            var label = btn.querySelector('[data-theme-toggle-label]');
            var icon = btn.querySelector('[data-theme-toggle-icon]');
            if (label) label.textContent = theme === 'light' ? 'Light' : 'Dark';
            if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
        }
    }

    // Exposed for anything else that wants to read/set the theme programmatically
    // (and so this file's behavior can be exercised from a test without a real DOM).
    window.cwTheme = { get: currentTheme, set: setTheme, toggle: function () { setTheme(currentTheme() === 'light' ? 'dark' : 'light'); } };

    document.addEventListener('DOMContentLoaded', function () {
        updateToggleButtons();
        var buttons = document.querySelectorAll('[data-theme-toggle]');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', function () { window.cwTheme.toggle(); });
        }
    });
})();