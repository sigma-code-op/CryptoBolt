/* CryptoBolt engagement layer for public pages: a small "your course" chip and a course + certificate band
   above the footer. Both adapt to the visitor's saved course progress (this browser only). */
(function () {
  'use strict';
  var COURSE_KEY = 'cb-course-v1', DISMISS_KEY = 'cb-eg-chip', DAY = 864e5;
  var SLUGS = ['course-what-is-trading', 'course-how-markets-work', 'course-how-to-read-candlestick-charts', 'course-order-types', 'course-trading-costs', 'course-leverage-for-beginners', 'course-position-sizing', 'course-stop-loss-and-risk-reward', 'course-trading-psychology', 'course-trend-support-resistance', 'course-trading-plan-and-journal', 'course-first-30-days'];
  var path = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
  if (/^(trading-course|course-|privacy$|terms$|editorial-policy$|contact$|404$)/.test(path)) return;

  function read(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
  var course = read(COURSE_KEY), doneMap = course.done || {}, n = 0, next = null;
  SLUGS.forEach(function (s) { if (doneMap[s]) n++; else if (!next) next = s; });
  var finished = n >= SLUGS.length;

  var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/css/engage.css?v=20261128'; document.head.appendChild(css);

  /* ---- band above the footer ---- */
  var footer = document.querySelector('footer.mk-footer, footer');
  if (footer && !document.querySelector('.eg-band')) {
    var sec = document.createElement('section'); sec.className = 'eg-band'; sec.setAttribute('aria-labelledby', 'eg-band-h');
    var eyebrow, head, text, cta, href, sub = '<a class="mk-btn mk-btn-ghost" href="trading-course">See the curriculum</a>';
    if (finished) { eyebrow = 'Course complete'; head = 'You finished all 12 lessons. Claim your certificate.'; text = 'Add your name and download your certificate of completion as an image or PDF. Then put what you learned to work in paper trading.'; cta = 'Get my certificate'; href = 'trading-course#certificate'; sub = '<a class="mk-btn mk-btn-ghost" href="trade">Practise in paper trading</a>'; }
    else if (n > 0) { eyebrow = 'Your free course'; head = 'You are ' + n + ' of 12 lessons in. Keep going.'; text = 'Every lesson ends with a short quiz and a small exercise. Finish all 12 and your personal certificate unlocks.'; cta = 'Continue with lesson ' + (SLUGS.indexOf(next) + 1); href = next; }
    else { eyebrow = 'Free course \u00b7 certificate included'; head = 'Go from \u201cwhat is a candle?\u201d to a written trading plan.'; text = 'Twelve short lessons, 48 quiz questions, hands-on tools and a 30-day paper trading routine. No sign-up, no money at risk. Finish all 12 and download your own certificate of completion.'; cta = 'Start lesson 1, free'; href = 'course-what-is-trading'; }
    sec.innerHTML = '<div class="eg-band-in"><div class="eg-band-copy"><span class="mk-eyebrow"></span><h2 id="eg-band-h"></h2><p></p><div class="eg-band-cta"><a class="mk-btn mk-btn-primary"></a>' + sub + '</div></div>' +
      '<dl class="eg-band-stats"><div><dt>Lessons</dt><dd>12</dd></div><div><dt>Quiz questions</dt><dd>48</dd></div><div><dt>Study time</dt><dd>\u2248 2.6 h</dd></div><div><dt>Certificate</dt><dd>PNG + PDF</dd></div></dl></div>';
    sec.querySelector('.mk-eyebrow').textContent = eyebrow; sec.querySelector('h2').textContent = head; sec.querySelector('p').textContent = text;
    var b = sec.querySelector('.mk-btn-primary'); b.textContent = cta; b.setAttribute('href', href);
    var anchor = document.querySelector('.mk-cta-band'); (anchor && anchor.parentNode ? anchor.parentNode : footer.parentNode).insertBefore(sec, anchor || footer);
  }

  /* ---- floating chip ---- */
  var dismissed = 0; try { dismissed = parseInt(localStorage.getItem(DISMISS_KEY), 10) || 0; } catch (e) {}
  if (Date.now() - dismissed < 3 * DAY) return;
  var chip = document.createElement('aside'); chip.className = 'eg-chip'; chip.setAttribute('aria-label', 'Free trading course');
  var pct = Math.round(n / SLUGS.length * 100), title, small, link;
  if (finished) { title = 'Course complete'; small = 'Your certificate is ready'; link = 'trading-course#certificate'; }
  else if (n > 0) { title = 'Continue your course'; small = 'Lesson ' + (SLUGS.indexOf(next) + 1) + ' next \u00b7 certificate at 12 of 12'; link = next; }
  else { title = 'Free trading course'; small = '12 lessons \u00b7 certificate when you finish'; link = 'trading-course'; }
  chip.innerHTML = '<a class="eg-chip-main" href=""><span class="eg-ring" aria-hidden="true"><b></b></span><span class="eg-chip-t"><strong></strong><small></small></span></a><button type="button" class="eg-x" aria-label="Dismiss course reminder">\u00d7</button>';
  var a = chip.querySelector('a'); a.setAttribute('href', link); chip.querySelector('strong').textContent = title; chip.querySelector('small').textContent = small;
  var ring = chip.querySelector('.eg-ring'); ring.style.setProperty('--p', pct); ring.querySelector('b').textContent = n + '/12';
  chip.querySelector('.eg-x').addEventListener('click', function () { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {} chip.classList.remove('is-in'); setTimeout(function () { if (chip.parentNode) chip.parentNode.removeChild(chip); }, 400); });
  document.body.appendChild(chip);

  var shown = false, tries = 0;
  function banner() { var b = document.querySelector('.cw-cc-banner'); return !!(b && b.classList.contains('cw-cc-visible')); }
  function show() { if (shown) return; if (banner() && tries++ < 60) { setTimeout(show, 1000); return; } shown = true; chip.classList.add('is-in'); }
  var timer = setTimeout(show, 9000);
  window.addEventListener('scroll', function onScroll() { var h = document.documentElement.scrollHeight - window.innerHeight; if (h > 0 && window.scrollY / h > 0.3) { window.removeEventListener('scroll', onScroll); clearTimeout(timer); show(); } }, { passive: true });
})();