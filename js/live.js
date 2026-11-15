// CryptoBolt "living" layer: reveal-on-scroll, hero aurora, card spotlight,
// button ripple, scroll progress and back-to-top. Self-contained (no libraries),
// additive, and safe to fail: if anything throws, pages stay fully readable
// because all styling is scoped under html.lv-on and reveals have a fallback.
(function () {
    'use strict';
    var root = document.documentElement;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var saver = !!(navigator.connection && navigator.connection.saveData);
    var NS = 'http://www.w3.org/2000/svg';

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    function init() {
        root.classList.add('lv-on');
        progress();
        navShadow();
        if (!reduce && !saver) aurora();
        spotlight();
        ripple();
        if (!reduce && finePointer) { magnetic(); tilt(); }
        reveal();
        backToTop();
    }

    /* ---------- scroll progress bar ---------- */
    var onScrollFns = [];
    var ticking = false;
    window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            ticking = false;
            for (var i = 0; i < onScrollFns.length; i++) onScrollFns[i]();
        });
    }, { passive: true });

    function scrollRatio() {
        var h = root.scrollHeight - window.innerHeight;
        return h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
    }

    function progress() {
        var bar = document.createElement('div');
        bar.className = 'lv-progress';
        bar.setAttribute('aria-hidden', 'true');
        var i = document.createElement('i');
        bar.appendChild(i);
        document.body.appendChild(bar);
        function update() { i.style.transform = 'scaleX(' + scrollRatio().toFixed(4) + ')'; }
        onScrollFns.push(update);
        update();
    }

    /* ---------- nav shadow ---------- */
    function navShadow() {
        var nav = document.querySelector('.mk-nav');
        if (!nav) return;
        function update() { nav.classList.toggle('lv-scrolled', window.scrollY > 8); }
        onScrollFns.push(update);
        update();
    }

    /* ---------- hero aurora that leans toward the pointer ---------- */
    function aurora() {
        var heroes = document.querySelectorAll('.mk-hero, .mk-fhero');
        if (!heroes.length) return;
        heroes.forEach(function (hero) {
            var a = document.createElement('div');
            a.className = 'lv-aurora';
            a.setAttribute('aria-hidden', 'true');
            a.innerHTML = '<b></b><b></b><b></b>';
            hero.insertBefore(a, hero.firstChild);
            if ('IntersectionObserver' in window) {
                new IntersectionObserver(function (en) {
                    a.classList.toggle('lv-paused', !en[0].isIntersecting);
                }).observe(hero);
            }
        });
        if (!finePointer) return;
        var raf = 0, px = 0, py = 0;
        window.addEventListener('pointermove', function (e) {
            px = (e.clientX / window.innerWidth - 0.5) * 2;
            py = (e.clientY / window.innerHeight - 0.5) * 2;
            if (raf) return;
            raf = requestAnimationFrame(function () {
                raf = 0;
                root.style.setProperty('--lv-px', px.toFixed(3));
                root.style.setProperty('--lv-py', py.toFixed(3));
            });
        }, { passive: true });
    }

    /* ---------- card spotlight + lift ---------- */
    function spotlight() {
        var sel = '.mk-card, .mk-step, .mk-blog-card, .mk-compare-col, .mk-feature-copy';
        var cards = document.querySelectorAll(sel);
        cards.forEach(function (card) {
            if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
            card.classList.add('lv-card');
            var g = document.createElement('span');
            g.className = 'lv-glow';
            g.setAttribute('aria-hidden', 'true');
            card.insertBefore(g, card.firstChild);
        });
        if (!finePointer || reduce) return;
        var raf = 0, target = null, mx = 0, my = 0;
        document.addEventListener('pointermove', function (e) {
            var c = e.target.closest ? e.target.closest('.lv-card') : null;
            if (!c) return;
            target = c; mx = e.clientX; my = e.clientY;
            if (raf) return;
            raf = requestAnimationFrame(function () {
                raf = 0;
                var r = target.getBoundingClientRect();
                target.style.setProperty('--lx', (mx - r.left) + 'px');
                target.style.setProperty('--ly', (my - r.top) + 'px');
            });
        }, { passive: true });
    }

    /* ---------- button ripple ---------- */
    function ripple() {
        if (reduce) return;
        document.addEventListener('pointerdown', function (e) {
            var b = e.target.closest ? e.target.closest('.mk-btn') : null;
            if (!b) return;
            var r = b.getBoundingClientRect();
            var d = Math.max(r.width, r.height) * 2;
            var s = document.createElement('span');
            s.className = 'lv-rip';
            s.style.width = s.style.height = d + 'px';
            s.style.left = (e.clientX - r.left - d / 2) + 'px';
            s.style.top = (e.clientY - r.top - d / 2) + 'px';
            b.appendChild(s);
            setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
        }, { passive: true });
    }


    /* ---------- magnetic primary buttons ---------- */
    function magnetic() {
        document.querySelectorAll('.mk-btn-lg, .mk-hero .mk-btn-primary').forEach(function (b) {
            b.classList.add('lv-mag');
            b.addEventListener('pointermove', function (e) {
                var r = b.getBoundingClientRect();
                var x = (e.clientX - r.left - r.width / 2) * 0.18;
                var y = (e.clientY - r.top - r.height / 2) * 0.28 - 2;
                b.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
            });
            b.addEventListener('pointerleave', function () { b.style.translate = ''; });
        });
    }

    /* ---------- gentle 3D tilt on mockups and figures ---------- */
    function tilt() {
        document.querySelectorAll('.mk-mockup, .mk-figure, .mk-ai-poster').forEach(function (el) {
            el.classList.add('lv-tilt');
            var raf = 0;
            el.addEventListener('pointermove', function (e) {
                var r = el.getBoundingClientRect();
                var px = (e.clientX - r.left) / r.width - 0.5;
                var py = (e.clientY - r.top) / r.height - 0.5;
                if (raf) return;
                raf = requestAnimationFrame(function () {
                    raf = 0;
                    el.classList.add('lv-tilting');
                    el.style.transform = 'perspective(900px) rotateY(' + (px * 6).toFixed(2) + 'deg) rotateX(' + (-py * 5).toFixed(2) + 'deg) scale(1.01)';
                });
            });
            el.addEventListener('pointerleave', function () {
                el.classList.remove('lv-tilting');
                el.style.transform = '';
            });
        });
    }

    /* ---------- reveal on scroll ---------- */
    function reveal() {
        if (reduce || !('IntersectionObserver' in window)) return;
        // Pages that load the GSAP marketing layer already animate these.
        var gsapPage = !!document.querySelector('script[src*="marketing-motion"]');
        var gsapOwned = '.mk-section-head,.mk-step,.mk-card,.mk-blog-card,.mk-compare-col,.mk-cta-band,.mk-feature-row,.mk-trust-bar';
        var sel = [
            '.mk-article > *', '.cb-vextra > *', '.cb-video > h2', '.cb-video > p', '.cb-video > ul',
            '.cb-video > details', '.mk-callout', '.mk-figure', '.cb-vtable', '.mk-faq > *',
            '.mk-section-head', '.mk-step', '.mk-card', '.mk-blog-card', '.mk-compare-col', '.mk-cta-band'
        ].join(',');
        var els = Array.prototype.filter.call(document.querySelectorAll(sel), function (el) {
            if (el.closest('.lv-aurora')) return false;
            if (gsapPage && el.matches(gsapOwned)) return false;
            // skip anything already on screen at load so nothing flashes
            return el.getBoundingClientRect().top > window.innerHeight * 0.9;
        });
        if (!els.length) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                en.target.classList.add('lv-in');
                io.unobserve(en.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
        var lastParent = null, n = 0;
        els.forEach(function (el) {
            if (el.parentNode !== lastParent) { lastParent = el.parentNode; n = 0; }
            el.style.setProperty('--lv-delay', Math.min(n, 5) * 0.06 + 's');
            n++;
            el.classList.add('lv-r');
            io.observe(el);
        });
        // Safety net: never leave content hidden (print, anchors, slow scroll).
        setTimeout(function () {
            els.forEach(function (el) {
                if (el.getBoundingClientRect().top < window.innerHeight * 1.5) el.classList.add('lv-in');
            });
        }, 2500);
        window.addEventListener('beforeprint', function () {
            els.forEach(function (el) { el.classList.add('lv-in'); });
        });
        window.addEventListener('hashchange', function () {
            els.forEach(function (el) { el.classList.add('lv-in'); });
        });
    }

    /* ---------- back to top with progress ring ---------- */
    function backToTop() {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lv-top';
        btn.setAttribute('aria-label', 'Back to top');
        var ring = document.createElementNS(NS, 'svg');
        ring.setAttribute('class', 'lv-ring');
        ring.setAttribute('viewBox', '0 0 44 44');
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', '22'); c.setAttribute('cy', '22'); c.setAttribute('r', '20');
        var len = 2 * Math.PI * 20;
        c.style.strokeDasharray = len.toFixed(1);
        c.style.strokeDashoffset = len.toFixed(1);
        ring.appendChild(c);
        var arrow = document.createElementNS(NS, 'svg');
        arrow.setAttribute('viewBox', '0 0 24 24');
        arrow.setAttribute('fill', 'none');
        arrow.setAttribute('stroke', 'currentColor');
        arrow.setAttribute('stroke-width', '2.4');
        arrow.setAttribute('stroke-linecap', 'round');
        arrow.setAttribute('stroke-linejoin', 'round');
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', 'M12 19V5M5 12l7-7 7 7');
        arrow.appendChild(p);
        btn.appendChild(ring); btn.appendChild(arrow);
        document.body.appendChild(btn);
        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        });
        function update() {
            btn.classList.toggle('lv-show', window.scrollY > 700);
            c.style.strokeDashoffset = (len * (1 - scrollRatio())).toFixed(1);
        }
        onScrollFns.push(update);
        update();
    }

    ready(function () {
        try { init(); } catch (e) { root.classList.remove('lv-on'); }
    });
})();