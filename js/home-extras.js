/* Home page: leverage reality check slider and "pick your path" tabs. */
(function () {
  'use strict';
  var lev = document.getElementById('hx-lev');
  if (lev) {
    var val = document.getElementById('hx-lev-val'), drop = document.getElementById('hx-risk-drop'),
      pos = document.getElementById('hx-risk-pos'), one = document.getElementById('hx-risk-1pct'),
      fill = document.getElementById('hx-risk-fill');
    var fmt = function (n) { return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 }); };
    var update = function () {
      var l = parseInt(lev.value, 10), d = l === 1 ? null : Math.max(1 / l - 0.005, 0);
      val.textContent = l + 'x';
      drop.textContent = d === null ? 'none' : (d * 100).toFixed(d < 0.1 ? 2 : 1) + '%';
      pos.textContent = fmt(1000 * l);
      one.textContent = fmt(10 * l);
      fill.style.width = (d === null ? 100 : Math.min(d * 100 * 2.5, 100)) + '%';
      fill.className = d !== null && d < 0.05 ? 'hot' : '';
    };
    lev.addEventListener('input', update); update();
  }
  document.querySelectorAll('[data-hx-paths]').forEach(function (root) {
    var tabs = [].slice.call(root.querySelectorAll('[role=tab]')), panels = [].slice.call(root.querySelectorAll('[role=tabpanel]'));
    var select = function (i, focus) {
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; });
      panels.forEach(function (p, j) { p.hidden = j !== i; });
      if (focus) tabs[i].focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); select((i + tabs.length - 1) % tabs.length, true); }
      });
    });
  });
})();