/* ============================================================
   CryptoBolt — shadcn/ui hand-ported components (vanilla JS)
   ------------------------------------------------------------
   Purely additive UI layer. Does not read/write any app state,
   does not touch existing IDs/classes the terminal logic relies
   on — safe to include on any page after the main bundle.

   Component 1: Tooltip
     Progressively enhances any element with a [title] attribute
     into a shadcn-style floating tooltip (instead of the native
     browser tooltip), matching the popover styling in
     css/shadcn-ui.css (.sc-tooltip).
   ============================================================ */
(function () {
    'use strict';

    var tipEl = null;
    var showTimer = null;
    var activeTarget = null;

    function ensureTip() {
        if (tipEl) return tipEl;
        tipEl = document.createElement('div');
        tipEl.className = 'sc-tooltip';
        tipEl.setAttribute('role', 'tooltip');
        document.body.appendChild(tipEl);
        return tipEl;
    }

    function position(target) {
        var tip = ensureTip();
        var r = target.getBoundingClientRect();
        var tipRect = tip.getBoundingClientRect();
        var top = r.top - tipRect.height - 8;
        var left = r.left + (r.width / 2) - (tipRect.width / 2);

        // Flip below the element if there isn't room above.
        if (top < 4) top = r.bottom + 8;
        // Clamp horizontally within the viewport.
        left = Math.max(6, Math.min(left, window.innerWidth - tipRect.width - 6));

        tip.style.top = top + 'px';
        tip.style.left = left + 'px';
    }

    function show(target) {
        var text = target.getAttribute('data-sc-title') || target.getAttribute('title');
        if (!text) return;

        // Suppress the native tooltip so we don't get two.
        target.setAttribute('data-sc-title', text);
        target.removeAttribute('title');

        var tip = ensureTip();
        tip.textContent = text;
        tip.style.visibility = 'hidden';
        tip.classList.add('sc-visible');
        // Measure once laid out, then position + reveal.
        requestAnimationFrame(function () {
            position(target);
            tip.style.visibility = 'visible';
        });
        activeTarget = target;
    }

    function hide() {
        if (!tipEl) return;
        tipEl.classList.remove('sc-visible');
        activeTarget = null;
    }

    function restoreTitle(target) {
        var text = target.getAttribute('data-sc-title');
        if (text && !target.getAttribute('title')) target.setAttribute('title', text);
    }

    function onEnter(e) {
        var target = e.target.closest('[title], [data-sc-title]');
        if (!target) return;
        clearTimeout(showTimer);
        showTimer = setTimeout(function () { show(target); }, 250);
    }

    function onLeave(e) {
        var target = e.target.closest('[title], [data-sc-title]');
        if (!target) return;
        clearTimeout(showTimer);
        hide();
    }

    function onScrollOrResize() {
        if (activeTarget) position(activeTarget);
    }

    document.addEventListener('mouseover', onEnter, true);
    document.addEventListener('mouseout', onLeave, true);
    document.addEventListener('focusin', function (e) {
        var target = e.target.closest('[title], [data-sc-title]');
        if (target) show(target);
    }, true);
    document.addEventListener('focusout', hide, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') hide();
    });
})();