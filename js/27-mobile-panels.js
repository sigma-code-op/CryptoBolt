// ---------- Mobile-friendly panels, chart toolbar and table scrolling (app.html) ----------
// 1. Collapsible panels: any element marked data-cw-panel="<id>" (chart, order book, recent
//    trades, alerts, portfolio, futures) gets a chevron in its header. Tapping the header title
//    collapses/expands it, and the choice is remembered in localStorage (cw_panel_prefs).
// 2. Chart toolbar: on phones the long "Overlays / Compare / On-chart" strips fold behind one
//    "Indicators & tools" button (state remembered too); Interval and Type stay visible.
// 3. Chart fullscreen: iPhone Safari has no Element.requestFullscreen() for non-video elements,
//    so fall back to a fixed-position CSS fullscreen with a visible Exit button.
// 4. Tables: toggle the right-edge fade only while there is more to scroll to.
// Everything degrades silently: with no JS (or no localStorage) every panel simply stays open.
(function setupMobilePanels() {
    const PREFS_KEY = 'cw_panel_prefs'; // { collapsed: { [panelId]: true }, toolsOpen: bool } — local only, not cloud-synced
    const CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

    function loadPrefs() {
        try {
            const p = JSON.parse(localStorage.getItem(PREFS_KEY));
            if (p && typeof p === 'object') return p;
        } catch (e) { /* storage blocked or corrupt — start fresh */ }
        return {};
    }
    const prefs = loadPrefs();
    if (!prefs.collapsed || typeof prefs.collapsed !== 'object') prefs.collapsed = {};
    function savePrefs() {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
    }

    // ---------- Collapsible panels ----------
    function setCollapsed(panel, collapsed, persist) {
        const id = panel.dataset.cwPanel;
        panel.classList.toggle('cw-collapsed', collapsed);
        const btn = panel.querySelector('.cw-collapse-btn');
        if (btn) {
            btn.setAttribute('aria-expanded', String(!collapsed));
            btn.setAttribute('aria-label', (collapsed ? 'Expand ' : 'Collapse ') + (btn.dataset.title || id));
        }
        if (id === 'chart') {
            // The toolbar is a sibling card above the chart, so it follows the chart's state.
            const tb = document.getElementById('chart-toolbar');
            if (tb) tb.classList.toggle('cw-panel-hidden', collapsed);
        }
        if (persist) {
            if (collapsed) prefs.collapsed[id] = true; else delete prefs.collapsed[id];
            savePrefs();
        }
    }

    function setupPanel(panel) {
        const id = panel.dataset.cwPanel;
        let head;
        if (id === 'chart') {
            // The chart card has no header of its own — add a slim one.
            head = document.createElement('div');
            head.className = 'cw-panel-head cw-chart-head';
            head.innerHTML = '<span class="cw-chart-head-title">Chart</span>' +
                '<button type="button" class="cw-fs-exit" aria-label="Exit fullscreen">&#10005; Exit</button>';
            panel.insertBefore(head, panel.firstChild);
            panel.classList.add('cw-has-head');
            head.querySelector('.cw-fs-exit').addEventListener('click', () => window.cwToggleChartFullscreen());
        } else {
            head = panel.firstElementChild;
            if (!head) return;
            head.classList.add('cw-panel-head');
        }
        const titleEl = head.firstElementChild;
        if (!titleEl) return;
        const title = panel.dataset.cwTitle || (titleEl.textContent || id).replace(/\s+/g, ' ').trim();

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cw-collapse-btn';
        btn.dataset.title = title;
        btn.innerHTML = CHEVRON;
        titleEl.insertBefore(btn, titleEl.firstChild);
        titleEl.classList.add('cw-panel-title');

        // One listener on the whole title: the button's own click bubbles here, and the label is a bigger
        // tap target than the chevron alone. Real controls inside the title are left alone.
        titleEl.addEventListener('click', (e) => {
            if (e.target.closest('a, input, select, textarea') ) return;
            setCollapsed(panel, !panel.classList.contains('cw-collapsed'), true);
        });

        setCollapsed(panel, !!prefs.collapsed[id], false);
    }

    // ---------- Chart toolbar: fold the long tool strips on phones ----------
    function setupToolbar() {
        const toolbar = document.getElementById('chart-toolbar');
        const typeRow = toolbar && toolbar.querySelector('.cw-tb-type');
        if (!toolbar || !typeRow) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'cw-tools-toggle';
        btn.className = 'cw-tools-toggle';
        btn.setAttribute('aria-controls', 'chart-toolbar');
        typeRow.insertAdjacentElement('afterend', btn);

        function render() {
            const open = toolbar.classList.contains('cw-tools-open');
            const n = toolbar.querySelectorAll('.ind-btn.active').length;
            btn.innerHTML = '<span>Indicators &amp; tools</span>' + (n ? '<span class="cw-count">' + n + ' on</span>' : '') + CHEVRON;
            btn.setAttribute('aria-expanded', String(open));
        }
        toolbar.classList.toggle('cw-tools-open', !!prefs.toolsOpen);
        render();

        btn.addEventListener('click', () => {
            const open = toolbar.classList.toggle('cw-tools-open');
            prefs.toolsOpen = open;
            savePrefs();
            render();
        });
        // Indicator buttons flip their own .active state first; refresh the "N on" badge afterwards.
        toolbar.addEventListener('click', (e) => { if (e.target.closest('.ind-btn')) setTimeout(render, 0); });
        window.addEventListener('load', render);
    }

    // ---------- Chart fullscreen (native where available, CSS fallback elsewhere) ----------
    function chartCard() { return document.getElementById('chart-card'); }
    function exitFallback() {
        const card = chartCard();
        if (card) card.classList.remove('cw-fs-fallback');
        document.documentElement.classList.remove('cw-fs-lock');
    }
    function enterFallback() {
        const card = chartCard();
        if (!card) return;
        card.classList.add('cw-fs-fallback');
        document.documentElement.classList.add('cw-fs-lock');
    }
    window.cwToggleChartFullscreen = function () {
        const card = chartCard();
        if (!card) return;
        if (document.fullscreenElement) { document.exitFullscreen && document.exitFullscreen(); return; }
        if (card.classList.contains('cw-fs-fallback')) { exitFallback(); return; }
        if (card.classList.contains('cw-collapsed')) setCollapsed(card, false, true); // nothing to show otherwise
        if (card.requestFullscreen) {
            try {
                const r = card.requestFullscreen();
                if (r && typeof r.catch === 'function') r.catch(enterFallback);
            } catch (e) { enterFallback(); }
        } else {
            enterFallback();
        }
    };
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const card = chartCard();
            if (card && card.classList.contains('cw-fs-fallback')) exitFallback();
        }
    });

    // ---------- Tables: only fade the right edge while there is more to scroll ----------
    function setupTableScroll(el) {
        const update = () => {
            el.classList.toggle('cw-at-end', el.scrollWidth - el.clientWidth - el.scrollLeft <= 2);
        };
        el.addEventListener('scroll', update, { passive: true });
        update();
        if ('ResizeObserver' in window) {
            const ro = new ResizeObserver(update);
            ro.observe(el);
            const table = el.querySelector('table');
            if (table) ro.observe(table);
        }
    }

    function init() {
        document.querySelectorAll('[data-cw-panel]').forEach(setupPanel);
        setupToolbar();
        document.querySelectorAll('.cw-table-scroll').forEach(setupTableScroll);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();