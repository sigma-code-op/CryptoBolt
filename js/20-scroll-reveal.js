// ---------- Scroll-reveal for cards (shared across every bundle) ----------
// Cards marked `.cw-reveal` fade/slide into view the first time they cross into the viewport,
// then stay revealed (no re-hiding on scroll-out) — a common, tasteful modern-dashboard touch.
// This used to live inline in 12-events-init.js, which only ships in bundle-home.js — any page
// whose bundle didn't include that file (trade.html, account.html, ...) rendered every
// `.cw-reveal` card permanently stuck at opacity:0 (see css/styles.css), i.e. a blank page below
// the header. Pulled out into its own tiny module, included in every bundle, so that can't
// happen again regardless of which other modules a given page needs.
(function setupScrollReveal() {
    const cards = document.querySelectorAll('.cw-reveal');
    if (!('IntersectionObserver' in window)) {
        cards.forEach(el => el.classList.add('cw-in-view'));
        return;
    }

    // Cards already sitting in the viewport at page-load time would otherwise still
    // fade/slide in (IntersectionObserver's first callback fires for them almost
    // immediately) — the visitor never scrolled to "reveal" them, so all that
    // translateY animation was actually doing was moving already-visible layout on
    // every load, which is exactly what the Cumulative Layout Shift metric penalizes.
    // Reveal those instantly, with no transition; only cards below the fold — the ones
    // an actual scroll brings into view — get the animated version.
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const toObserve = [];
    cards.forEach((el) => {
        if (el.getBoundingClientRect().top < vh) {
            el.classList.add('cw-reveal-instant', 'cw-in-view');
        } else {
            toObserve.push(el);
        }
    });
    if (!toObserve.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('cw-in-view');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    toObserve.forEach((el, i) => {
        el.style.transitionDelay = `${Math.min(i * 40, 240)}ms`;
        observer.observe(el);
    });
})();