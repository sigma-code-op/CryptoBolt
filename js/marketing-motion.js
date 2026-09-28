// ---------------------------------------------------------------------------
// CryptoBolt marketing site — motion layer (2026 redesign, pass 2).
//
// Everything here is additive and defensive on purpose: this ships on public
// pages that also carry a live WebSocket ticker, so it (a) never blocks or
// delays real content, and (b) degrades to "static but fully visible" if a
// CDN is slow/blocked, WebGL isn't available, or the visitor has asked for
// reduced motion. Nothing in here is required for the page to work.
//
// Depends on (loaded before this file, in order): three.min.js, gsap.min.js,
// ScrollTrigger.min.js — all from cdn.jsdelivr.net, already allow-listed in
// script-src (see scripts/build-csp.js). Every entry point below checks for
// its dependency before touching it.
// ---------------------------------------------------------------------------
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const noHover = window.matchMedia('(hover: none)').matches;
    // Phones/tablets get a lighter version of the same effects rather than none:
    // fewer particles, no antialiasing, lower pixel ratio, ~30fps cap, and touch
    // input (finger parallax + scroll-linked rotation) instead of a mouse.
    const isTouch = noHover || window.matchMedia('(pointer: coarse)').matches;
    const conn = navigator.connection || {};
    // Data-saver or clearly low-end hardware: draw one static frame, no animation loop.
    const lowPower = !!conn.saveData ||
        (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

    /* ================= Scroll reveal (GSAP + ScrollTrigger) ================= */
    // Targets plain marketing classes already in the HTML — no data-* markup
    // needed, so this applies to every current and future page that reuses
    // these components without further edits.
    function initReveal() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        gsap.registerPlugin(ScrollTrigger);
        if (reduceMotion) return; // leave elements at their default, fully-visible CSS state

        const selector = [
            '.mk-section-head', '.mk-step', '.mk-card', '.mk-blog-card',
            '.mk-compare-col', '.mk-ai-poster', '.mk-cta-band', '.mk-feature-row',
            '.mk-trust-bar',
        ].join(', ');
        const els = document.querySelectorAll(selector);
        if (!els.length) return;

        els.forEach((el, i) => {
            gsap.fromTo(el,
                { autoAlpha: 0, y: 26, scale: 0.98 },
                {
                    autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out',
                    delay: (i % 3) * 0.06,
                    scrollTrigger: { trigger: el, start: 'top 90%', once: true },
                }
            );
        });
    }

    /* ================= Trust-bar counters ================= */
    function initCounters() {
        if (typeof gsap === 'undefined') return;
        const nums = document.querySelectorAll('.mk-trust-num');
        if (!nums.length) return;

        nums.forEach((el) => {
            const m = el.textContent.trim().match(/^(\D*)([\d,]+)(.*)$/);
            if (!m) return;
            const prefix = m[1], target = parseInt(m[2].replace(/,/g, ''), 10), suffix = m[3];
            if (isNaN(target)) return;

            const run = () => {
                if (reduceMotion) { el.textContent = prefix + target.toLocaleString('en-US') + suffix; return; }
                const counter = { val: 0 };
                gsap.to(counter, {
                    val: target, duration: 1.2, ease: 'power2.out',
                    onUpdate: () => { el.textContent = prefix + Math.round(counter.val).toLocaleString('en-US') + suffix; },
                });
            };
            if (typeof ScrollTrigger !== 'undefined') {
                ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: run });
            } else {
                run();
            }
        });
    }

    /* ================= 3D tilt on cards ================= */
    function initTilt() {
        if (reduceMotion || noHover) return;
        const cards = document.querySelectorAll('.mk-card, .mk-blog-card');
        cards.forEach((card) => {
            let raf = null;
            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - 0.5;
                const py = (e.clientY - r.top) / r.height - 0.5;
                if (raf) cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => {
                    card.style.transform =
                        `perspective(700px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg) translateY(-3px)`;
                });
            });
            card.addEventListener('mouseleave', () => {
                if (raf) cancelAnimationFrame(raf);
                card.style.transform = '';
            });
        });
    }

    /* ================= Touch "press tilt" on cards (phones/tablets) ================= */
    // Same 3D feel as the desktop hover tilt, driven by where a finger presses.
    // Passive listeners only, so scrolling is never blocked; the browser sends
    // touchcancel when a drag turns into a scroll, which resets the card.
    function initTouchTilt() {
        if (reduceMotion || !isTouch) return;
        document.querySelectorAll('.mk-card, .mk-blog-card').forEach((card) => {
            const tiltTo = (t) => {
                const r = card.getBoundingClientRect();
                const px = (t.clientX - r.left) / r.width - 0.5;
                const py = (t.clientY - r.top) / r.height - 0.5;
                card.style.transform =
                    `perspective(700px) rotateX(${(-py * 9).toFixed(2)}deg) rotateY(${(px * 12).toFixed(2)}deg) scale(0.985)`;
            };
            const reset = () => { card.style.transform = ''; };
            card.addEventListener('touchstart', (e) => tiltTo(e.touches[0]), { passive: true });
            card.addEventListener('touchmove', (e) => tiltTo(e.touches[0]), { passive: true });
            card.addEventListener('touchend', reset, { passive: true });
            card.addEventListener('touchcancel', reset, { passive: true });
        });
    }

    /* ================= Magnetic primary CTA in the hero ================= */
    function initMagnetic() {
        if (reduceMotion || noHover) return;
        document.querySelectorAll('.mk-hero .mk-btn-primary, .mk-cta-band .mk-btn-primary').forEach((btn) => {
            btn.addEventListener('mousemove', (e) => {
                const r = btn.getBoundingClientRect();
                const x = (e.clientX - r.left - r.width / 2) * 0.25;
                const y = (e.clientY - r.top - r.height / 2) * 0.35;
                btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
            });
            btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
        });
    }

    /* ================= 3D hero visual (Three.js) ================= */
    // A wireframe + particle field behind the hero copy. Runs on every device:
    // desktop gets mouse parallax and the full particle count; phones get a
    // lighter scene (fewer particles, no antialiasing, lower pixel ratio, ~30fps)
    // driven by finger movement and scroll position. Paused whenever the hero is
    // off-screen or the tab is hidden, since this page also runs a live ticker.
    function initHero3D() {
        const canvas = document.getElementById('mk-hero-canvas');
        if (!canvas || typeof THREE === 'undefined') return;

        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isTouch });
        } catch (e) { return; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.5));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.z = 9;

        const group = new THREE.Group();
        scene.add(group);

        [
            { radius: 2.4, detail: 1, color: 0x1fcf8c, opacity: 0.5, speed: -0.09 },
            { radius: 3.6, detail: 0, color: 0x4fd8e8, opacity: 0.22, speed: 0.05 },
        ].forEach(({ radius, detail, color, opacity, speed }) => {
            const edges = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(radius, detail));
            const mesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
            mesh.userData.speed = speed;
            group.add(mesh);
        });

        const count = isTouch ? 70 : 160;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = 4.6 + Math.random() * 2.4;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }
        const pgeo = new THREE.BufferGeometry();
        pgeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particles = new THREE.Points(pgeo, new THREE.PointsMaterial({ color: 0x1fcf8c, size: isTouch ? 0.06 : 0.045, transparent: true, opacity: 0.5 }));
        group.add(particles);

        // Input: mouse on desktop, finger on touch, plus scroll position on both.
        let inX = 0, inY = 0, curX = 0, curY = 0, scrollRot = 0;
        if (isTouch) {
            const onTouch = (e) => {
                const t = e.touches[0];
                inX = (t.clientX / window.innerWidth) - 0.5;
                inY = (t.clientY / window.innerHeight) - 0.5;
            };
            window.addEventListener('touchstart', onTouch, { passive: true });
            window.addEventListener('touchmove', onTouch, { passive: true });
        } else {
            window.addEventListener('mousemove', (e) => {
                inX = (e.clientX / window.innerWidth) - 0.5;
                inY = (e.clientY / window.innerHeight) - 0.5;
            }, { passive: true });
        }
        window.addEventListener('scroll', () => { scrollRot = window.scrollY * 0.0016; }, { passive: true });

        function resize() {
            const w = canvas.clientWidth, h = canvas.clientHeight;
            if (!w || !h) return;
            renderer.setSize(w, h, false);
            const aspect = w / h;
            camera.aspect = aspect;
            // Portrait screens: pull the camera back so the shape fits the narrow
            // width, and lift it toward the top of the hero (behind the headline).
            camera.position.z = aspect < 1.2 ? Math.min(20, 8.2 / (0.828 * aspect)) : 9;
            group.position.y = aspect < 1 ? 0.25 * 0.828 * camera.position.z : 0;
            camera.updateProjectionMatrix();
        }
        window.addEventListener('resize', resize, { passive: true });
        resize();

        const clock = new THREE.Clock();
        const minFrameMs = isTouch ? 33 : 0; // ~30fps on phones
        let raf = null, lastDraw = 0;
        let tabVisible = !document.hidden;
        let heroVisible = true;

        function draw(dt) {
            group.children.forEach((m) => { if (m.userData.speed) m.rotation.y += m.userData.speed * dt; });
            particles.rotation.y -= 0.012 * dt;
            curX += (inX - curX) * 0.05;
            curY += (inY - curY) * 0.05;
            group.rotation.y = curX * 0.6 + scrollRot;
            group.rotation.x = curY * 0.35 + scrollRot * 0.4;
            renderer.render(scene, camera);
        }
        function frame(now) {
            raf = requestAnimationFrame(frame);
            if (minFrameMs && now - lastDraw < minFrameMs) return;
            lastDraw = now;
            draw(Math.min(clock.getDelta(), 0.1));
        }
        function start() { if (!raf) { clock.getDelta(); raf = requestAnimationFrame(frame); } }
        function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

        if (reduceMotion || lowPower) {
            renderer.render(scene, camera); // one static frame, no loop
            return;
        }

        start();
        new IntersectionObserver((entries) => {
            heroVisible = entries[0].isIntersecting;
            if (heroVisible && tabVisible) start(); else stop();
        }, { threshold: 0 }).observe(canvas);
        document.addEventListener('visibilitychange', () => {
            tabVisible = !document.hidden;
            if (heroVisible && tabVisible) start(); else stop();
        });
    }

    function boot() {
        initReveal();
        initCounters();
        initTilt();
        initTouchTilt();
        initMagnetic();
        initHero3D();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();