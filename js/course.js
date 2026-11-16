/* Free trading course: progress, quizzes and small calculators. Everything stays in this browser. */
(function () {
  'use strict';
  var KEY = 'cb-course-v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  var data = load(); data.done = data.done || {}; data.checks = data.checks || {}; data.plan = data.plan || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var num = function (id) { var el = document.getElementById(id); var v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? NaN : v; };
  var money = function (v) { return isFinite(v) ? '$' + v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 4 : 2 }) : '-'; };
  var pct = function (v, d) { return isFinite(v) ? v.toFixed(d == null ? 2 : d) + '%' : '-'; };
  var set = function (root, k, v) { var el = $('[data-out="' + k + '"]', root); if (el) el.textContent = v; };

  /* ---- progress ---- */
  function slugs() { return $$('[data-lesson-link],[data-lesson-card]').map(function (a) { return a.getAttribute('data-lesson-link') || a.getAttribute('data-lesson-card'); }).filter(function (s, i, a) { return a.indexOf(s) === i; }); }
  function paint() {
    var all = slugs(), n = 0;
    $$('[data-lesson-link],[data-lesson-card]').forEach(function (a) {
      var s = a.getAttribute('data-lesson-link') || a.getAttribute('data-lesson-card');
      var d = !!data.done[s]; a.classList.toggle('is-done', d);
      if (d && all.indexOf(s) > -1) { /* counted below */ }
    });
    all.forEach(function (s) { if (data.done[s]) n++; });
    $$('[data-progress-wrap]').forEach(function (w) {
      var bar = $('[data-progress-bar]', w), t = $('[data-progress-text]', w), total = all.length || 12;
      if (bar) { bar.setAttribute('aria-valuenow', n); $('i', bar).style.width = Math.round(n / total * 100) + '%'; }
      if (t) t.textContent = n + ' of ' + total + ' lessons complete';
    });
    var start = $('[data-start-link]');
    if (start && all.length) {
      var next = all.filter(function (s) { return !data.done[s]; })[0];
      if (n > 0 && next) { start.textContent = 'Continue with lesson ' + (all.indexOf(next) + 1); start.setAttribute('href', next); }
      else if (n >= all.length) { start.textContent = 'Review lesson 1'; }
    }
  }

  /* ---- lesson completion ---- */
  var lesson = $('[data-lesson]');
  if (lesson) {
    var slug = lesson.getAttribute('data-lesson'), btn = $('[data-complete]'), msg = $('[data-complete-msg]');
    var show = function () {
      var d = !!data.done[slug]; btn.setAttribute('aria-pressed', d ? 'true' : 'false');
      btn.textContent = d ? 'Completed. Click to undo' : 'Mark lesson complete';
      msg.textContent = d ? 'Nice work. Your progress is saved in this browser only.' : 'Your progress is saved in this browser only.';
    };
    btn.addEventListener('click', function () { if (data.done[slug]) delete data.done[slug]; else data.done[slug] = 1; save(data); show(); paint(); });
    show();
  }

  /* ---- quizzes ---- */
  $$('[data-quiz]').forEach(function (qz) {
    var qs = $$('.cc-q', qz), check = $('[data-quiz-check]', qz), reset = $('[data-quiz-reset]', qz), score = $('[data-quiz-score]', qz);
    check.addEventListener('click', function () {
      var right = 0, answered = 0;
      qs.forEach(function (q) {
        var ans = q.getAttribute('data-answer'), sel = $('input:checked', q);
        $$('.cc-opt', q).forEach(function (o) { o.classList.remove('is-right', 'is-wrong'); });
        if (sel) { answered++; var lab = sel.closest('.cc-opt'); if (sel.value === ans) { right++; lab.classList.add('is-right'); } else { lab.classList.add('is-wrong'); } }
        var correct = $('input[value="' + ans + '"]', q); if (correct && sel) correct.closest('.cc-opt').classList.add('is-right');
        var ex = $('.cc-explain', q); if (ex && sel) ex.hidden = false;
      });
      if (!answered) { score.textContent = 'Pick an answer for each question first.'; return; }
      score.textContent = answered < qs.length ? 'You answered ' + answered + ' of ' + qs.length + '. Score so far: ' + right + '.' : 'Score: ' + right + ' of ' + qs.length + (right === qs.length ? '. Perfect!' : right >= qs.length - 1 ? '. Great job.' : '. Read the explanations and try again.');
      reset.hidden = false;
    });
    reset.addEventListener('click', function () {
      qs.forEach(function (q) { $$('input', q).forEach(function (i) { i.checked = false; }); $$('.cc-opt', q).forEach(function (o) { o.classList.remove('is-right', 'is-wrong'); }); var ex = $('.cc-explain', q); if (ex) ex.hidden = true; });
      score.textContent = ''; reset.hidden = true;
    });
  });

  /* ---- tools ---- */
  var tools = {
    candle: function (r) {
      var o = num('cd-o'), h = num('cd-h'), l = num('cd-l'), c = num('cd-c'), svg = $('[data-candle]', r), m = $('[data-out="msg"]', r);
      m.className = 'cc-msg';
      if ([o, h, l, c].some(isNaN)) { svg.innerHTML = ''; m.textContent = 'Enter all four prices.'; return; }
      if (h < Math.max(o, c) || l > Math.min(o, c)) { svg.innerHTML = ''; m.className = 'cc-msg is-warn'; m.textContent = 'Not possible: the high must be the highest price and the low the lowest.'; return; }
      var span = Math.max(h - l, 1e-9), y = function (p) { return 20 + (h - p) / span * 200; };
      var up = c >= o, col = up ? '#14d38a' : '#ff4d6a', top = y(Math.max(o, c)), bot = y(Math.min(o, c));
      svg.innerHTML = '<line x1="80" y1="' + y(h) + '" x2="80" y2="' + y(l) + '" stroke="' + col + '" stroke-width="4"/><rect x="52" y="' + top + '" width="56" height="' + Math.max(bot - top, 2) + '" rx="3" fill="' + col + '"/>';
      var body = Math.abs(c - o), up_w = h - Math.max(o, c), lo_w = Math.min(o, c) - l, txt = up ? 'Green candle: it closed above its open.' : 'Red candle: it closed below its open.';
      if (up_w > body * 1.5 && up_w > span * 0.3) txt += ' The long upper wick shows buyers pushed up but were rejected.';
      else if (lo_w > body * 1.5 && lo_w > span * 0.3) txt += ' The long lower wick shows sellers pushed down but were rejected.';
      else if (body < span * 0.1) txt += ' A tiny body means little progress: indecision.';
      m.textContent = txt;
    },
    cost: function (r) {
      var s = num('co-size'), f = num('co-fee'), sp = num('co-spread'), sl = num('co-slip');
      if ([s, f, sp, sl].some(isNaN)) return;
      var be = 2 * f + sp + 2 * sl, cost = s * be / 100;
      set(r, 'cost', money(cost)); set(r, 'be', pct(be, 3)); set(r, 'day', money(cost * 10) + ' (' + pct(be * 10, 2) + ' of size)');
    },
    leverage: function (r) {
      var m = num('lv-margin'), lev = num('lv-lev'), e = num('lv-entry'), dir = document.getElementById('lv-dir').value;
      if ([m, lev, e].some(isNaN) || lev < 1 || e <= 0) return;
      var pos = m * lev, d = 1 / lev, liq = dir === 'long' ? e * (1 - d) : e * (1 + d);
      set(r, 'pos', money(pos)); set(r, 'liq', money(liq)); set(r, 'dist', pct(d * 100, 2) + ' (about)');
      set(r, 'up', '+' + money(pos * 0.05) + ' (' + pct(5 * lev, 0) + ' of margin)'); set(r, 'down', '-' + money(Math.min(pos * 0.05, m)) + (5 * lev >= 100 ? ' (margin wiped out)' : ' (' + pct(5 * lev, 0) + ' of margin)'));
    },
    size: function (r) {
      var a = num('sz-acct'), rk = num('sz-risk'), e = num('sz-entry'), s = num('sz-stop'), m = $('[data-out="msg"]', r);
      m.className = 'cc-msg';
      if ([a, rk, e, s].some(isNaN) || e <= 0) return;
      if (e === s) { m.className = 'cc-msg is-warn'; m.textContent = 'Entry and stop cannot be the same price.'; ['risk', 'rpc', 'size', 'val'].forEach(function (k) { set(r, k, '-'); }); return; }
      var risk = a * rk / 100, rpc = Math.abs(e - s), size = risk / rpc, val = size * e;
      set(r, 'risk', money(risk)); set(r, 'rpc', money(rpc)); set(r, 'size', size.toLocaleString('en-US', { maximumFractionDigits: 6 })); set(r, 'val', money(val) + ' (' + pct(val / a * 100, 0) + ' of account)');
      if (val > a) { m.className = 'cc-msg is-warn'; m.textContent = 'This position is larger than your whole account, so it would need leverage. A stop this tight for this risk is a warning sign: use a smaller risk % or a wider, better-placed stop with a smaller position.'; }
      else m.textContent = 'If your stop is hit, you lose about ' + money(risk) + '. That is ' + pct(rk, 1) + ' of the account.';
    },
    rr: function (r) {
      var e = num('rr-entry'), s = num('rr-stop'), t = num('rr-target'), w = num('rr-win'), m = $('[data-out="msg"]', r);
      m.className = 'cc-msg';
      if ([e, s, t].some(isNaN)) return;
      var long = s < e && t > e, short = s > e && t < e;
      if (!long && !short) { m.className = 'cc-msg is-warn'; m.textContent = 'For a long, the stop must be below entry and the target above. For a short, the reverse.'; ['risk', 'reward', 'rr', 'be', 'exp'].forEach(function (k) { set(r, k, '-'); }); return; }
      var risk = Math.abs(e - s), rew = Math.abs(t - e), rr = rew / risk, be = 100 / (1 + rr);
      set(r, 'risk', money(risk)); set(r, 'reward', money(rew)); set(r, 'rr', '1 : ' + rr.toFixed(2)); set(r, 'be', pct(be, 1));
      if (!isNaN(w)) { var ex = w / 100 * rr - (1 - w / 100); set(r, 'exp', (ex >= 0 ? '+' : '') + ex.toFixed(2) + 'R (before costs)');
        m.className = 'cc-msg ' + (ex > 0 ? 'is-good' : 'is-warn');
        m.textContent = ex > 0 ? 'With a ' + pct(w, 0) + ' win rate this plan has positive expectancy on paper. Real results depend on whether you can truly win that often, and costs reduce it.' : 'With a ' + pct(w, 0) + ' win rate this plan loses money on average. You need a higher win rate (at least ' + pct(be, 1) + ') or a better reward-to-risk.'; }
    }
  };
  $$('[data-tool]').forEach(function (r) {
    var f = tools[r.getAttribute('data-tool')]; if (!f) return;
    $$('input,select', r).forEach(function (i) { i.addEventListener('input', function () { f(r); }); i.addEventListener('change', function () { f(r); }); });
    f(r);
  });

  /* ---- checklist ---- */
  $$('[data-save-check]').forEach(function (cb) {
    var k = cb.getAttribute('data-save-check'); cb.checked = !!data.checks[k];
    cb.addEventListener('change', function () { if (cb.checked) data.checks[k] = 1; else delete data.checks[k]; save(data); ck(); });
  });
  function ck() {
    var all = $$('[data-save-check]'); if (!all.length) return;
    var n = all.filter(function (c) { return c.checked; }).length, m = $('[data-tool="checklist"] [data-out="msg"]');
    if (m) { m.className = 'cc-msg' + (n === all.length ? ' is-good' : ''); m.textContent = n === all.length ? 'All done. You are ready to keep practising, and any real-money step should still be tiny.' : n + ' of ' + all.length + ' ticked. Keep practising until the rest are honest ticks.'; }
  }
  ck();

  /* ---- plan builder ---- */
  var plan = $('[data-tool="plan"]');
  if (plan) {
    var pm = $('[data-out="msg"]', plan);
    $$('[data-plan-field]', plan).forEach(function (t) {
      var k = t.getAttribute('data-plan-field'); if (data.plan[k]) t.value = data.plan[k];
      t.addEventListener('input', function () { data.plan[k] = t.value; save(data); });
    });
    $('[data-plan-copy]', plan).addEventListener('click', function () {
      var txt = 'MY TRADING PLAN\n\n' + $$('[data-plan-field]', plan).map(function (t) { var l = $('label[for="' + t.id + '"]', plan).textContent; return l + '\n' + (t.value || '(not filled in yet)'); }).join('\n\n');
      var done = function () { pm.textContent = 'Copied. Paste it into a note you will keep.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { pm.textContent = 'Could not copy automatically. Select the text in the boxes and copy it.'; });
      else pm.textContent = 'Copying is not available here. Select the text in the boxes and copy it.';
    });
    $('[data-plan-clear]', plan).addEventListener('click', function () { $$('[data-plan-field]', plan).forEach(function (t) { t.value = ''; }); data.plan = {}; save(data); pm.textContent = 'Cleared.'; });
  }
  paint();
})();