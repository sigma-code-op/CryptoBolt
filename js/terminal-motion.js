// ---------------------------------------------------------------------------
// CryptoBolt terminal pages (app.html, ai.html) — ambient 3D network backdrop.
//
// Purely decorative and fully independent of the trading terminal's own JS
// (chart engine, ticker sockets, order book, etc.) — it only ever touches its
// own <canvas id="cw-terminal-canvas">, never queries or mutates any
// functional element, and every dependency check below fails silently to a
// blank transparent canvas rather than throwing. These pages already run a
// live WebSocket feed and (on app.html) a charting library, so this is kept
// deliberately cheap: a static, precomputed point/line network, capped pixel
// ratio, and full pause whenever the tab is hidden.
// ---------------------------------------------------------------------------
(function () {
    'use strict';

    const canvas = document.getElementById('cw-terminal-canvas');
    if (!canvas) return;
    if (typeof THREE === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Phones/tablets get a lighter version instead of nothing: fewer nodes,
    // pixel ratio 1, ~30fps cap, and finger/scroll-driven parallax. Data-saver
    // or clearly low-end devices skip it entirely — these pages already carry a
    // live feed, so the backdrop must never compete with it.
    const isTouch = window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches;
    const conn = navigator.connection || {};
    if (conn.saveData) return;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    } catch (e) { return; }
    renderer.setPixelRatio(isTouch ? 1 : Math.min(window.devicePixelRatio || 1, 1.25));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 11;

    const group = new THREE.Group();
    scene.add(group);

    // A sparse field of points, sized/colored a touch differently so it reads
    // as data nodes rather than decoration. Positions are generated once.
    const COUNT = isTouch ? 60 : 130;
    // Keep the node cloud inside the visible width on tall/narrow screens.
    const aspect0 = window.innerWidth / Math.max(1, window.innerHeight);
    const xSpread = Math.min(22, Math.max(8, 9.1 * aspect0 * 1.5));
    const pts = [];
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
        const x = (Math.random() - 0.5) * xSpread;
        const y = (Math.random() - 0.5) * 13;
        const z = (Math.random() - 0.5) * 10;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        pts.push(new THREE.Vector3(x, y, z));
    }
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(pointsGeo, new THREE.PointsMaterial({
        color: 0x1fcf8c, size: 0.05, transparent: true, opacity: 0.55,
    }));
    group.add(points);

    // Connect each point to its 2 nearest neighbors, computed once at init —
    // no per-frame distance checks. Gives a quiet "network graph" read
    // without any ongoing CPU cost.
    const linePositions = [];
    for (let i = 0; i < pts.length; i++) {
        const distances = [];
        for (let j = 0; j < pts.length; j++) {
            if (i === j) continue;
            distances.push([j, pts[i].distanceTo(pts[j])]);
        }
        distances.sort((a, b) => a[1] - b[1]);
        for (let k = 0; k < 2; k++) {
            const [j, d] = distances[k];
            if (d > 5.5) continue; // skip far-flung neighbors, keeps the graph sparse
            linePositions.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
        }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
        color: 0x2c6f5e, transparent: true, opacity: 0.22,
    }));
    group.add(lines);

    let mouseX = 0, mouseY = 0, curX = 0, curY = 0, scrollY = 0;
    const onPoint = (x, y) => {
        mouseX = (x / window.innerWidth) - 0.5;
        mouseY = (y / window.innerHeight) - 0.5;
    };
    if (isTouch) {
        const onTouch = (e) => onPoint(e.touches[0].clientX, e.touches[0].clientY);
        window.addEventListener('touchstart', onTouch, { passive: true });
        window.addEventListener('touchmove', onTouch, { passive: true });
    } else {
        window.addEventListener('mousemove', (e) => onPoint(e.clientX, e.clientY), { passive: true });
    }
    window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true, capture: true });

    function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize, { passive: true });
    resize();

    const clock = new THREE.Clock();
    const minFrameMs = isTouch ? 33 : 0; // ~30fps on phones
    let raf = null, lastDraw = 0;
    function frame(now) {
        raf = requestAnimationFrame(frame);
        if (minFrameMs && now - lastDraw < minFrameMs) return;
        lastDraw = now;
        const dt = Math.min(clock.getDelta(), 0.1);
        group.rotation.y += 0.015 * dt;
        group.rotation.x = Math.sin(scrollY * 0.002) * 0.15;
        curX += (mouseX - curX) * 0.03;
        curY += (mouseY - curY) * 0.03;
        camera.position.x = curX * 1.2;
        camera.position.y = -curY * 0.8;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
    }
    function start() { if (!raf) { clock.getDelta(); raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    start();
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop(); else start();
    });
})();