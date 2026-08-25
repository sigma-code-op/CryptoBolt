// ---------- Scroll-reveal for cards (shared across every bundle) ----------
// Cards marked `.cw-reveal` fade/slide into view the first time they cross into the viewport,
// then stay revealed (no re-hiding on scroll-out) — a common, tasteful modern-dashboard touch.
// This used to live inline in 12-events-init.js, which only ships in bundle-home.js — any page
// whose bundle didn't include that file (trade.html, account.html, ...) rendered every
// `.cw-reveal` card permanently stuck at opacity:0 (see css/styles.css), i.e. a blank page below
// the header. Pulled out into its own tiny module, included in every bundle, so that can't
// happen again regardless of which other modules a given page needs.
(function setupScrollReveal() {
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.cw-reveal').forEach(el => el.classList.add('cw-in-view'));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('cw-in-view');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.cw-reveal').forEach((el, i) => {
        el.style.transitionDelay = `${Math.min(i * 40, 240)}ms`;
        observer.observe(el);
    });
})();