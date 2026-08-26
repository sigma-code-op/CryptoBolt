// ---------- CryptoBolt: marketing-page mobile nav toggle ----------
// Powers the .mk-burger button added to index/features/blog. No dependency
// on the rest of the page's JS bundle so it works even on pages that don't
// load one.
(function () {
    var burger = document.querySelector('.mk-burger');
    var panel = document.getElementById('mk-mobile-panel');
    if (!burger || !panel) return;

    burger.addEventListener('click', function () {
        var open = panel.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close the panel after a nav link is tapped, and whenever the viewport
    // is resized back past the breakpoint where the burger is hidden.
    panel.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
            panel.classList.remove('is-open');
            burger.setAttribute('aria-expanded', 'false');
        });
    });
    window.addEventListener('resize', function () {
        if (window.innerWidth > 880) {
            panel.classList.remove('is-open');
            burger.setAttribute('aria-expanded', 'false');
        }
    });
})();