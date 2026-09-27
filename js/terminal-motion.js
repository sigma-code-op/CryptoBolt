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
    if (window.matchMedia('(hover: none)').matches) return;
    if (window.innerWidth < 900) return;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    } catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 11;

    const group = new THREE.Group();
    scene.add(group);

    // A sparse field of points, sized/colored a touch differently so it reads
    // as data nodes rather than decoration. Positions are generated once.
    const COUNT = 130;
    const pts = [];
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
        const x = (Math.random() - 0.5) * 22;
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

    let mouseX = 0, mouseY = 0, curX = 0, curY = 0;
    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) - 0.5;
        mouseY = (e.clientY / window.innerHeight) - 0.5;
    }, { passive: true });

    function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize, { passive: true });
    resize();

    const clock = new THREE.Clock();
    let raf = null;
    function frame() {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(clock.getDelta(), 0.1);
        group.rotation.y += 0.015 * dt;
        curX += (mouseX - curX) * 0.03;
        curY += (mouseY - curY) * 0.03;
        camera.position.x = curX * 1.2;
        camera.position.y = -curY * 0.8;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
    }
    function start() { if (!raf) frame(); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    start();
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop(); else start();
    });
})();