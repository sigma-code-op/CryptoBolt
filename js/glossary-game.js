/* Glossary extras: a term of the day and a five-question "match the definition" round.
   Built from the terms already on the page; best score is kept in this browser only. */
(function () {
  'use strict';
  var items = Array.prototype.slice.call(document.querySelectorAll('.mk-gloss-item')), host = document.querySelector('.mk-gloss');
  if (!host || items.length < 8) return;
  var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/css/engage.css?v=20261128'; document.head.appendChild(link);
  var terms = items.map(function (el) {
    var dfn = el.querySelector('dfn'), p = el.querySelector('dd p'), cat = el.querySelector('.mk-gloss-cat');
    return dfn && p ? { id: el.id, term: dfn.textContent.trim(), def: p.textContent.trim(), cat: cat ? cat.textContent.trim() : '' } : null;
  }).filter(Boolean);
  var pool = terms.filter(function (t) { var w = t.term.toLowerCase(); return t.def.length > 30 && t.def.length < 260 && t.def.toLowerCase().indexOf(w) === -1; });
  if (pool.length < 8) return;
  var KEY = 'cb-gloss-best', best = 0; try { best = parseInt(localStorage.getItem(KEY), 10) || 0; } catch (e) {}
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var wrap = document.createElement('section'); wrap.className = 'gg'; wrap.setAttribute('aria-label', 'Glossary activities');
  var day = pool[Math.floor(Date.now() / 864e5) % pool.length];
  var card1 = document.createElement('div'); card1.className = 'gg-card';
  card1.innerHTML = '<span class="mk-eyebrow">Term of the day</span><p class="gg-term"></p><span class="gg-cat"></span><p style="margin-top:12px"></p><a href="">See it in the glossary</a>';
  card1.querySelector('.gg-term').textContent = day.term; card1.querySelector('.gg-cat').textContent = day.cat || 'Trading'; card1.querySelectorAll('p')[1].textContent = day.def; card1.querySelector('a').setAttribute('href', '#' + day.id);
  var card2 = document.createElement('div'); card2.className = 'gg-card'; wrap.appendChild(card1); wrap.appendChild(card2);
  host.parentNode.insertBefore(wrap, host);
  var round, idx, score;
  function start() { round = shuffle(pool).slice(0, 5); idx = 0; score = 0; ask(); }
  function ask() {
    var q = round[idx], same = shuffle(pool.filter(function (t) { return t !== q && t.cat === q.cat; })), other = shuffle(pool.filter(function (t) { return t !== q && t.cat !== q.cat; }));
    var opts = shuffle([q].concat(same.concat(other).slice(0, 3)));
    card2.innerHTML = '<span class="mk-eyebrow">Test yourself</span><h2>Which term matches?</h2><p class="gg-q"></p><ul class="gg-opts"></ul><div class="gg-bar"><span></span></div>';
    card2.querySelector('.gg-q').textContent = q.def; var ul = card2.querySelector('.gg-opts'), bar = card2.querySelector('.gg-bar');
    bar.firstChild.textContent = 'Question ' + (idx + 1) + ' of 5 \u00b7 Best: ' + best + '/5';
    opts.forEach(function (o) {
      var li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.textContent = o.term; li.appendChild(b); ul.appendChild(li);
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(ul.querySelectorAll('button'), function (x) { x.disabled = true; if (x.textContent === q.term) x.classList.add('is-right'); });
        if (o === q) score++; else b.classList.add('is-wrong');
        var nx = document.createElement('button'); nx.type = 'button'; nx.className = 'mk-btn mk-btn-primary'; nx.textContent = idx === 4 ? 'See my score' : 'Next question'; bar.appendChild(nx); nx.focus();
        nx.addEventListener('click', function () { idx++; if (idx < 5) ask(); else finish(); });
      });
    });
  }
  function finish() {
    var isBest = score > best; if (isBest) { best = score; try { localStorage.setItem(KEY, String(best)); } catch (e) {} }
    card2.innerHTML = '<span class="mk-eyebrow">Your result</span><h2></h2><p></p><div class="gg-bar"><button type="button" class="mk-btn mk-btn-primary">Play again</button><a href="trading-course">Learn the rest in the free course</a></div>';
    card2.querySelector('h2').textContent = score + ' of 5' + (score === 5 ? ' \u2013 flawless' : '');
    card2.querySelector('p').textContent = (isBest ? 'New personal best. ' : 'Personal best: ' + best + ' of 5. ') + (score < 5 ? 'The terms you missed are worth a second look in the list below.' : 'Every term right. Try the course quizzes next.');
    card2.querySelector('button').addEventListener('click', start); card2.querySelector('button').focus();
  }
  start();
})();