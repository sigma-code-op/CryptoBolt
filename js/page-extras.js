/* Blog and calculators hub: search box and category chips that filter the existing cards. */
(function () {
  'use strict';
  var grids = [].slice.call(document.querySelectorAll('.mk-blog-grid'));
  if (!grids.length) return;
  var cards = [].slice.call(document.querySelectorAll('.mk-blog-card'));
  if (cards.length < 6) return;
  var isBlog = !!document.querySelector('.mk-blog-card .mk-blog-body h2');
  var first = grids[0], bar = document.createElement('div');
  bar.className = 'px-search'; bar.setAttribute('role', 'search');
  var input = document.createElement('input');
  input.type = 'search'; input.placeholder = isBlog ? 'Search the articles' : 'Search the calculators';
  input.setAttribute('aria-label', input.placeholder);
  bar.appendChild(input);
  var cats = {};
  cards.forEach(function (c) {
    var m = c.querySelector('.mk-blog-meta'), k = m ? m.textContent.split('·')[0].trim() : '';
    c.setAttribute('data-px-cat', k); if (isBlog && k) cats[k] = 1;
  });
  var active = '', chips = [];
  if (isBlog) {
    ['All'].concat(Object.keys(cats).sort()).forEach(function (name) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'px-chip'; b.textContent = name;
      b.setAttribute('aria-pressed', name === 'All'); chips.push(b);
      b.addEventListener('click', function () { active = name === 'All' ? '' : name; chips.forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); run(); });
      bar.appendChild(b);
    });
  }
  var count = document.createElement('span'); count.className = 'px-count'; count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite'); bar.appendChild(count);
  var empty = document.createElement('p'); empty.className = 'px-empty'; empty.hidden = true; empty.textContent = 'Nothing matches that search. Try a shorter word.';
  first.parentNode.insertBefore(bar, first);
  first.parentNode.insertBefore(empty, first);
  function run() {
    var q = input.value.trim().toLowerCase(), shown = 0;
    cards.forEach(function (c) {
      var ok = (!q || c.textContent.toLowerCase().indexOf(q) > -1) && (!active || c.getAttribute('data-px-cat') === active);
      c.hidden = !ok; if (ok) shown++;
    });
    grids.forEach(function (g) {
      var sec = g.closest('section'); if (!sec) return;
      sec.hidden = !g.querySelector('.mk-blog-card:not([hidden])');
    });
    count.textContent = shown + ' of ' + cards.length;
    empty.hidden = shown > 0;
  }
  input.addEventListener('input', run); run();
})();