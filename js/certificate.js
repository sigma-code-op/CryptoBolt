/* CryptoBolt course certificate: unlock rules, badges, certificate drawing and PNG/PDF export.
   Everything runs in this browser. Progress comes from the course's own saved data (cb-course-v1);
   the name and issue date are kept separately in cb-cert-v1. Nothing is sent to a server. */
(function () {
  'use strict';
  var COURSE_KEY = 'cb-course-v1', CERT_KEY = 'cb-cert-v1';
  var SLUGS = ['course-what-is-trading', 'course-how-markets-work', 'course-how-to-read-candlestick-charts', 'course-order-types', 'course-trading-costs', 'course-leverage-for-beginners', 'course-position-sizing', 'course-stop-loss-and-risk-reward', 'course-trading-psychology', 'course-trend-support-resistance', 'course-trading-plan-and-journal', 'course-first-30-days'];
  var MODULES = ['Foundations', 'Placing your first trade', 'Protecting your money', 'Building a process'];
  var DISTINCTION_PCT = 90;
  var SHARE_URL = 'https://cryptobolt.io/trading-course';

  /* ---------- pure helpers (also exported for tests) ---------- */
  function cleanName(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function hash(str) { var h = 0x811c9dc5, i; for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  function pad(s, n) { s = String(s); while (s.length < n) s = '0' + s; return s; }
  function certId(name, iso) {
    var n = String(name).toLowerCase(), a = pad(hash('cb|' + n + '|' + iso).toString(36).toUpperCase(), 4).slice(-4), b = pad(hash(iso + '|' + n + '|bolt').toString(36).toUpperCase(), 4).slice(-4);
    return 'CB-' + a + '-' + b + '-' + String(iso).replace(/-/g, '').slice(2);
  }
  function summary(course, slugs) {
    slugs = slugs || SLUGS; course = course || {};
    var done = course.done || {}, quiz = course.quiz || {}, n = 0, taken = 0, got = 0, tot = 0, next = null, i, q;
    for (i = 0; i < slugs.length; i++) {
      if (done[slugs[i]]) n++; else if (!next) next = slugs[i];
      q = quiz[slugs[i]];
      if (q && q.total > 0) { taken++; got += Math.min(q.best, q.total); tot += q.total; }
    }
    var complete = n === slugs.length, pct = tot ? Math.round(got / tot * 100) : null;
    return { done: n, total: slugs.length, next: next, taken: taken, pct: pct, complete: complete, distinction: complete && taken === slugs.length && pct >= DISTINCTION_PCT };
  }
  function iso(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2); }
  function longDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return '';
    var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return parseInt(m[3], 10) + ' ' + names[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }
  /* Wrap one JPEG in a one-page PDF (page matches the certificate's proportions). */
  function jpegToPdf(jpeg, w, h) {
    var pw = 842, ph = Math.round(842 * h / w), chunks = [], offs = [], len = 0;
    function str(s) { var u = new Uint8Array(s.length), i; for (i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }
    function push(u) { chunks.push(u); len += u.length; }
    function obj(n, body) { offs[n] = len; push(str(n + ' 0 obj\n' + body + '\nendobj\n')); }
    push(str('%PDF-1.4\n'));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    offs[4] = len;
    push(str('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n'));
    push(jpeg); push(str('\nendstream\nendobj\n'));
    var content = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
    obj(5, '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
    var xref = len, x = 'xref\n0 6\n0000000000 65535 f \n', i;
    for (i = 1; i <= 5; i++) x += pad(offs[i], 10) + ' 00000 n \n';
    push(str(x + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF'));
    var out = new Uint8Array(len), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }

  /* ---------- certificate drawing ---------- */
  var SANS = '"Space Grotesk","Inter",system-ui,-apple-system,"Segoe UI",sans-serif', MONO = '"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace', SERIF = 'Georgia,"Times New Roman",serif';
  var DARK = { bg1: '#06090f', bg2: '#0f1b2b', ink: '#eef1f4', dim: '#9aa7b4', line: 'rgba(255,255,255,.16)', grid: 'rgba(255,255,255,.025)', chip: 'rgba(255,255,255,.06)', a: '#14d38a', b: '#4fd8e8', c: '#a78bfa', gold: '#e8c36a', logoInk: '#06130d', glow: true };
  var LIGHT = { bg1: '#fffdf8', bg2: '#f1eee4', ink: '#0e1826', dim: '#566472', line: 'rgba(14,24,38,.22)', grid: 'rgba(14,24,38,.03)', chip: 'rgba(14,24,38,.05)', a: '#0a9a68', b: '#1393a8', c: '#7c5cd6', gold: '#9a6f0f', logoInk: '#ffffff', glow: false };
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function spaced(c, text, cx, y, sp) {
    var ws = [], w = 0, i; for (i = 0; i < text.length; i++) { ws[i] = c.measureText(text.charAt(i)).width; w += ws[i] + (i < text.length - 1 ? sp : 0); }
    var x = cx - w / 2, al = c.textAlign; c.textAlign = 'left';
    for (i = 0; i < text.length; i++) { c.fillText(text.charAt(i), x, y); x += ws[i] + sp; }
    c.textAlign = al;
  }
  function bolt(c, x, y, s) { var p = [[.60, .04], [.18, .56], [.46, .56], [.38, .96], [.82, .38], [.54, .38]]; c.beginPath(); p.forEach(function (q, i) { if (i) c.lineTo(x + q[0] * s, y + q[1] * s); else c.moveTo(x + q[0] * s, y + q[1] * s); }); c.closePath(); c.fill(); }

  function draw(canvas, o) {
    var W = 1600, H = 1131; canvas.width = W; canvas.height = H;
    var c = canvas.getContext('2d'), P = o.theme === 'light' ? LIGHT : DARK, g, i;
    g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (P.glow) {
      g = c.createRadialGradient(W / 2, 110, 10, W / 2, 110, 720); g.addColorStop(0, 'rgba(20,211,138,.20)'); g.addColorStop(1, 'rgba(20,211,138,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      g = c.createRadialGradient(W - 120, H - 60, 10, W - 120, H - 60, 620); g.addColorStop(0, 'rgba(167,139,250,.16)'); g.addColorStop(1, 'rgba(167,139,250,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    c.strokeStyle = P.grid; c.lineWidth = 1; c.beginPath();
    for (i = 0; i < W; i += 40) { c.moveTo(i, 0); c.lineTo(i, H); } for (i = 0; i < H; i += 40) { c.moveTo(0, i); c.lineTo(W, i); } c.stroke();
    g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, P.a); g.addColorStop(.5, P.b); g.addColorStop(1, P.c);
    c.lineWidth = 5; c.strokeStyle = g; rr(c, 34, 34, W - 68, H - 68, 24); c.stroke();
    c.lineWidth = 1.5; c.strokeStyle = P.line; rr(c, 62, 62, W - 124, H - 124, 14); c.stroke();
    c.strokeStyle = P.gold; c.lineWidth = 5; c.lineCap = 'round';
    [[84, 84, 1, 1], [W - 84, 84, -1, 1], [84, H - 84, 1, -1], [W - 84, H - 84, -1, -1]].forEach(function (k) { c.beginPath(); c.moveTo(k[0] + k[2] * 72, k[1]); c.lineTo(k[0], k[1]); c.lineTo(k[0], k[1] + k[3] * 72); c.stroke(); });
    c.lineCap = 'butt';
    /* logo */
    c.textBaseline = 'alphabetic'; c.font = '700 38px ' + SANS; var tw = c.measureText('CryptoBolt').width, x0 = (W - (70 + 18 + tw)) / 2;
    g = c.createLinearGradient(x0, 110, x0 + 70, 180); g.addColorStop(0, P.a); g.addColorStop(1, P.b); c.fillStyle = g; rr(c, x0, 110, 70, 70, 17); c.fill();
    c.fillStyle = P.logoInk; bolt(c, x0 + 14, 124, 42);
    c.fillStyle = P.ink; c.textAlign = 'left'; c.fillText('CryptoBolt', x0 + 88, 157); c.textAlign = 'center';
    /* title */
    c.fillStyle = P.ink; c.font = '700 46px ' + SANS; spaced(c, 'CERTIFICATE OF COMPLETION', W / 2, 270, 9);
    c.strokeStyle = P.line; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W / 2 - 330, 304); c.lineTo(W / 2 - 22, 304); c.moveTo(W / 2 + 22, 304); c.lineTo(W / 2 + 330, 304); c.stroke();
    c.fillStyle = P.gold; c.beginPath(); c.moveTo(W / 2, 294); c.lineTo(W / 2 + 10, 304); c.lineTo(W / 2, 314); c.lineTo(W / 2 - 10, 304); c.closePath(); c.fill();
    if (o.distinction) {
      c.fillStyle = P.gold; c.globalAlpha = .16; rr(c, W / 2 - 190, 334, 380, 46, 23); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = P.gold; c.lineWidth = 1.5; rr(c, W / 2 - 190, 334, 380, 46, 23); c.stroke();
      c.fillStyle = P.gold; c.font = '700 21px ' + SANS; spaced(c, 'WITH DISTINCTION', W / 2, 364, 6);
    }
    c.fillStyle = P.dim; c.font = '400 27px ' + SANS; c.fillText('This certificate is proudly presented to', W / 2, 452);
    /* name */
    var name = o.name || 'Your Name Here', size = 112;
    do { c.font = 'italic 700 ' + size + 'px ' + SERIF; size -= 4; } while (c.measureText(name).width > 1180 && size > 40);
    var nw = c.measureText(name).width; c.fillStyle = P.ink; c.fillText(name, W / 2, 566);
    var uw = Math.min(Math.max(nw + 140, 720), 1260); g = c.createLinearGradient(W / 2 - uw / 2, 0, W / 2 + uw / 2, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.2, P.a); g.addColorStop(.8, P.b); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(W / 2 - uw / 2, 592, uw, 3);
    c.fillStyle = P.dim; c.font = '400 27px ' + SANS; c.fillText('for successfully completing all 12 lessons of the free course', W / 2, 656);
    c.font = '700 58px ' + SANS; var cw = c.measureText('Trading for Absolute Beginners').width;
    g = c.createLinearGradient(W / 2 - cw / 2, 0, W / 2 + cw / 2, 0); g.addColorStop(0, P.a); g.addColorStop(1, P.b); c.fillStyle = g; c.fillText('Trading for Absolute Beginners', W / 2, 728);
    /* module chips */
    var fs = 21, total;
    do { c.font = '600 ' + fs + 'px ' + SANS; total = 0; MODULES.forEach(function (m) { total += c.measureText(m).width + 44 + 16; }); total -= 16; fs--; } while (total > 1380 && fs > 14);
    var cx = (W - total) / 2; c.textAlign = 'left';
    MODULES.forEach(function (m) { var w = c.measureText(m).width + 44; c.fillStyle = P.chip; rr(c, cx, 756, w, 46, 23); c.fill(); c.strokeStyle = P.line; c.lineWidth = 1.2; rr(c, cx, 756, w, 46, 23); c.stroke(); c.fillStyle = P.ink; c.fillText(m, cx + 22, 786); cx += w + 16; });
    c.textAlign = 'center'; c.fillStyle = P.dim; c.font = '400 23px ' + SANS;
    c.fillText('12 lessons  \u00b7  4 modules  \u00b7  48 quiz questions  \u00b7  30-day practice plan' + (o.pct != null ? '  \u00b7  Quiz average ' + o.pct + '%' : ''), W / 2, 844);
    /* bottom row */
    function block(x, label, value, font) {
      c.fillStyle = P.ink; c.font = font; c.fillText(value, x, 932);
      c.strokeStyle = P.line; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 190, 952); c.lineTo(x + 190, 952); c.stroke();
      c.fillStyle = P.dim; c.font = '600 16px ' + SANS; spaced(c, label, x, 982, 4);
    }
    block(300, 'DATE OF COMPLETION', longDate(o.date), '600 30px ' + SANS);
    block(1300, 'CERTIFICATE ID', o.id, '600 28px ' + MONO);
    /* seal */
    var sx = W / 2, sy = 938, R = 68; c.beginPath();
    for (i = 0; i <= 360; i += 2) { var th = i * Math.PI / 180, r = R + 5 * Math.sin(th * 28); if (i) c.lineTo(sx + r * Math.cos(th), sy + r * Math.sin(th)); else c.moveTo(sx + r, sy); }
    c.closePath(); g = c.createLinearGradient(sx - R, sy - R, sx + R, sy + R);
    if (o.distinction) { g.addColorStop(0, '#f6dd94'); g.addColorStop(1, '#c99a2e'); } else { g.addColorStop(0, P.a); g.addColorStop(1, P.b); }
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 3; c.beginPath(); c.arc(sx, sy, R - 14, 0, Math.PI * 2); c.stroke();
    c.fillStyle = o.distinction ? '#4a3408' : '#06130d'; bolt(c, sx - 21, sy - 31, 42);
    c.font = '700 10px ' + SANS; spaced(c, o.distinction ? 'DISTINCTION' : 'COMPLETED', sx, sy + 38, 2);
    c.fillStyle = P.dim; c.font = '400 16px ' + SANS;
    c.fillText('Issued by CryptoBolt for finishing an educational course. It is not a professional qualification, an accreditation or financial advice.', W / 2, 1040);
    c.fillText('cryptobolt.io/trading-course', W / 2, 1060);
  }

  /* ---------- storage ---------- */
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function sync() {
    var st = summary(readJSON(COURSE_KEY)), cert = readJSON(CERT_KEY);
    if (st.complete && !cert.finished) { cert.finished = iso(); writeJSON(CERT_KEY, cert); }
    else if (!st.complete && cert.finished) { delete cert.finished; writeJSON(CERT_KEY, cert); }
    return { st: st, cert: cert };
  }

  /* ---------- UI bits ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ICON = {
    cap: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    ok: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>'
  };
  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var box = document.createElement('div'), cols = ['#14d38a', '#4fd8e8', '#a78bfa', '#e8c36a', '#ff6b8b'], i, p;
    box.className = 'cert-confetti'; box.setAttribute('aria-hidden', 'true');
    for (i = 0; i < 70; i++) {
      p = document.createElement('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = cols[i % cols.length];
      p.style.animationDelay = (Math.random() * 0.9).toFixed(2) + 's'; p.style.animationDuration = (2.6 + Math.random() * 2).toFixed(2) + 's';
      p.style.transform = 'rotate(' + Math.round(Math.random() * 360) + 'deg)'; box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 5800);
  }
  function download(href, file) { var a = document.createElement('a'); a.href = href; a.download = file; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.parentNode.removeChild(a); }
  function slugName(n) { return n.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'Student'; }

  /* ---------- course hub ---------- */
  function initHub(root) {
    root.classList.add('cert-js');
    var canvas = $('[data-cert-canvas]', root), lock = $('[data-cert-lock]', root), status = $('[data-cert-status]', root), dots = $('[data-cert-dots]', root), badges = $('[data-cert-badges]', root),
      nameIn = $('[data-cert-name]', root), themeSel = $('[data-cert-theme]', root), acts = $$('[data-act]', root), msg = $('[data-cert-msg]', root), form = $('[data-cert-form]', root);
    var titles = {}, mods = [];
    $$('[data-lesson-card]').forEach(function (a) { var s = a.getAttribute('data-lesson-card'), t = $('strong', a); titles[s] = t ? t.textContent : s; });
    $$('.cc-mod').forEach(function (m) { var h = $('h3', m); mods.push({ name: h ? h.textContent : '', slugs: $$('[data-lesson-card]', m).map(function (a) { return a.getAttribute('data-lesson-card'); }) }); });
    var saved = readJSON(CERT_KEY); nameIn.value = cleanName(saved.name || ''); if (saved.theme === 'light') themeSel.value = 'light';
    var timer = null, drawn = '';

    function render() {
      var s = sync(), st = s.st, course = readJSON(COURSE_KEY), name = cleanName(nameIn.value), theme = themeSel.value, doneMap = course.done || {};
      dots.innerHTML = '';
      SLUGS.forEach(function (sl, i) {
        var li = document.createElement('li'), a = document.createElement('a'); a.href = sl; a.textContent = i + 1; a.title = (titles[sl] || 'Lesson ' + (i + 1)) + (doneMap[sl] ? ' (complete)' : ''); a.className = 'cert-dot' + (doneMap[sl] ? ' is-on' : '');
        a.setAttribute('aria-label', 'Lesson ' + (i + 1) + (doneMap[sl] ? ', complete' : ', not complete')); li.appendChild(a); dots.appendChild(li);
      });
      var t;
      if (st.complete) t = 'All 12 lessons complete. Add your name below and your certificate is ready.';
      else if (st.done === 0) t = 'Your certificate unlocks when all 12 lessons are marked complete. Start with lesson 1.';
      else t = st.done + ' of 12 lessons complete. ' + (12 - st.done) + ' to go.';
      t += st.taken < 12 ? ' Quizzes taken: ' + st.taken + ' of 12.' : ' Quiz average: ' + st.pct + '%.';
      if (st.complete) t += st.distinction ? ' You qualify for the With Distinction version.' : ' Score ' + DISTINCTION_PCT + '% or more across all 12 quizzes to earn With Distinction.';
      else t += ' Score ' + DISTINCTION_PCT + '% or more across all 12 quizzes for the With Distinction version.';
      status.textContent = t;
      /* badges */
      var list = [{ n: 'First step', h: 'Complete 1 lesson', on: st.done >= 1 }];
      mods.forEach(function (m) { list.push({ n: m.name, h: 'Finish the module', on: m.slugs.length > 0 && m.slugs.every(function (x) { return !!doneMap[x]; }) }); });
      var ace = false, q = course.quiz || {}; Object.keys(q).forEach(function (k) { if (q[k] && q[k].total > 0 && q[k].best === q[k].total) ace = true; });
      list.push({ n: 'Quiz ace', h: 'Score 4 of 4 on any quiz', on: ace }); list.push({ n: 'Graduate', h: 'Finish all 12 lessons', on: st.complete });
      badges.innerHTML = ''; list.forEach(function (b) { var li = document.createElement('li'); li.className = 'cert-badge' + (b.on ? ' is-on' : ''); li.innerHTML = '<span class="cert-badge-i" aria-hidden="true">' + (b.on ? ICON.ok : '') + '</span>'; var d = document.createElement('span'); d.innerHTML = '<strong></strong><small></small>'; d.firstChild.textContent = b.n; d.lastChild.textContent = b.on ? 'Unlocked' : b.h; li.appendChild(d); badges.appendChild(li); });
      /* canvas */
      var can = st.complete && name.length >= 2, o = { theme: theme, name: can ? name : '', date: s.cert.finished || iso(), distinction: st.distinction, pct: st.taken === 12 ? st.pct : null };
      o.id = certId(o.name || 'preview', o.date);
      var key = JSON.stringify(o); if (key !== drawn) { drawn = key; draw(canvas, o); }
      canvas.classList.toggle('is-locked', !st.complete); lock.hidden = st.complete;
      form.classList.toggle('is-off', !st.complete); nameIn.disabled = !st.complete; themeSel.disabled = !st.complete;
      acts.forEach(function (b) { b.disabled = !can; });
      if (st.complete && !can) msg.textContent = 'Type your name (at least 2 letters) to generate the certificate.';
      else if (!st.complete || msg.textContent.indexOf('Type your name') === 0) msg.textContent = '';
      return { can: can, name: name, o: o };
    }
    function later() { clearTimeout(timer); timer = setTimeout(render, 120); }
    nameIn.addEventListener('input', function () { var c = readJSON(CERT_KEY); c.name = cleanName(nameIn.value); writeJSON(CERT_KEY, c); later(); });
    themeSel.addEventListener('change', function () { var c = readJSON(CERT_KEY); c.theme = themeSel.value; writeJSON(CERT_KEY, c); render(); });
    acts.forEach(function (b) {
      b.addEventListener('click', function () {
        var r = render(); if (!r.can) return; var act = b.getAttribute('data-act'), file = 'CryptoBolt-Certificate-' + slugName(r.name);
        if (act === 'png') { canvas.toBlob(function (bl) { if (!bl) return; var u = URL.createObjectURL(bl); download(u, file + '.png'); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); msg.textContent = 'Downloaded the PNG image.'; }, 'image/png'); }
        else if (act === 'pdf') {
          try {
            var d = canvas.toDataURL('image/jpeg', 0.95).split(',')[1], bin = atob(d), u8 = new Uint8Array(bin.length), i; for (i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            var url = URL.createObjectURL(new Blob([jpegToPdf(u8, canvas.width, canvas.height)], { type: 'application/pdf' })); download(url, file + '.pdf'); setTimeout(function () { URL.revokeObjectURL(url); }, 4000); msg.textContent = 'Downloaded the PDF.';
          } catch (e) { msg.textContent = 'Could not create the PDF here. Use the PNG download instead.'; }
        } else if (act === 'print') {
          var img = document.createElement('img'); img.className = 'cert-print-img'; img.alt = 'Certificate of completion'; img.src = canvas.toDataURL('image/png');
          var clean = function () { document.documentElement.classList.remove('cert-printing'); if (img.parentNode) img.parentNode.removeChild(img); window.removeEventListener('afterprint', clean); };
          document.body.appendChild(img); document.documentElement.classList.add('cert-printing'); window.addEventListener('afterprint', clean);
          img.onload = function () { window.print(); }; if (img.complete) window.print();
          setTimeout(clean, 60000);
        } else if (act === 'x' || act === 'li') {
          var text = 'I just completed the free \u201cTrading for Absolute Beginners\u201d course on CryptoBolt: 12 lessons, quizzes and a 30-day practice plan.';
          var href = act === 'x' ? 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SHARE_URL) : 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(SHARE_URL);
          window.open(href, '_blank', 'noopener'); msg.textContent = 'Opened the share window. Download your certificate to attach it to the post.';
        }
      });
    });
    window.addEventListener('storage', function (e) { if (e.key === COURSE_KEY || e.key === CERT_KEY) render(); });
    var go = function () { render(); if (location.hash === '#certificate' && root.scrollIntoView) { try { root.scrollIntoView(); } catch (e) {} } };
    if (document.fonts && document.fonts.load) { Promise.all([document.fonts.load('700 40px "Space Grotesk"'), document.fonts.load('600 20px "JetBrains Mono"')]).then(go, go); } else go();
    render();
  }

  /* ---------- lesson page panel ---------- */
  function initLesson(root) {
    var lesson = $('[data-lesson]'), slug = lesson ? lesson.getAttribute('data-lesson') : '', btn = $('[data-complete]');
    var was = sync().st.complete;
    function render(celebrate) {
      var st = sync().st, next = null, i; for (i = 0; i < SLUGS.length; i++) { if (SLUGS[i] !== slug && !((readJSON(COURSE_KEY).done || {})[SLUGS[i]])) { next = SLUGS[i]; break; } }
      var pc = Math.round(st.done / st.total * 100);
      if (st.complete) {
        root.innerHTML = '<div class="cert-l cert-l--done"><span class="cert-l-ico" aria-hidden="true">' + ICON.cap + '</span><div><h3>You finished the whole course</h3><p>All 12 lessons are complete. Your certificate is ready: add your name, then download it as an image or PDF.</p></div><a class="mk-btn mk-btn-primary" href="trading-course#certificate">Get my certificate</a></div>';
        if (celebrate) confetti();
      } else {
        var left = st.total - st.done;
        root.innerHTML = '<div class="cert-l"><span class="cert-l-ico" aria-hidden="true">' + ICON.cap + '</span><div><h3>Your certificate: ' + st.done + ' of 12 lessons done</h3><p>' + left + (left === 1 ? ' lesson' : ' lessons') + ' to go. Mark each lesson complete as you finish it; finish all 12 to unlock a personal certificate you can download.</p><div class="cert-l-bar" role="progressbar" aria-label="Certificate progress" aria-valuemin="0" aria-valuemax="12" aria-valuenow="' + st.done + '"><i style="width:' + pc + '%"></i></div></div>' + (next ? '<a class="mk-btn mk-btn-ghost" href="' + next + '">Next: lesson ' + (SLUGS.indexOf(next) + 1) + '</a>' : '<a class="mk-btn mk-btn-ghost" href="trading-course#certificate">See requirements</a>') + '</div>';
      }
    }
    render(false);
    if (btn) btn.addEventListener('click', function () { setTimeout(function () { var now = sync().st.complete; render(now && !was); was = now; }, 0); });
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { cleanName: cleanName, certId: certId, summary: summary, jpegToPdf: jpegToPdf, longDate: longDate, SLUGS: SLUGS }; }
  if (typeof document !== 'undefined') {
    var hub = $('[data-cert]'); if (hub) initHub(hub);
    var lp = $('[data-cert-lesson]'); if (lp) initLesson(lp);
  }
})();