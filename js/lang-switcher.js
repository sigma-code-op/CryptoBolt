/* CryptoBolt language switcher (every marketing, article and calculator page).
 * Uses Google Website Translator under a custom button, so the WHOLE site follows one choice:
 * the choice is a first-party "googtrans" cookie, and every page reads it on load.
 * The source HTML stays English (SEO unaffected); English visitors load no Google script at all.
 * Terminal screens (app, trade, ai, account, invest) are deliberately never translated because
 * their live-updating tables and order forms break when a translator rewrites the DOM. */
(function () {
  'use strict';
  var LANGS = [
    ['en', 'English'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['es', 'Español'], ['hi', 'हिन्दी'],
    ['ar', 'العربية'], ['pt', 'Português'], ['bn', 'বাংলা'], ['ru', 'Русский'], ['ja', '日本語'],
    ['de', 'Deutsch'], ['fr', 'Français'], ['ur', 'اردو'], ['id', 'Bahasa Indonesia'], ['tr', 'Türkçe'],
    ['ko', '한국어'], ['it', 'Italiano'], ['vi', 'Tiếng Việt'], ['pl', 'Polski'], ['nl', 'Nederlands'],
    ['fa', 'فارسی'], ['th', 'ไทย'], ['uk', 'Українська'], ['sv', 'Svenska'], ['el', 'Ελληνικά'],
    ['ro', 'Română'], ['cs', 'Čeština'], ['hu', 'Magyar'], ['da', 'Dansk'], ['fi', 'Suomi'],
    ['no', 'Norsk'], ['he', 'עברית'], ['ms', 'Bahasa Melayu'], ['ta', 'தமிழ்'], ['sw', 'Kiswahili'],
    ['tl', 'Filipino'], ['bg', 'Български'], ['sr', 'Српски'], ['hr', 'Hrvatski'], ['sk', 'Slovenčina']
  ];
  var RTL = { ar: 1, ur: 1, fa: 1, he: 1 };
  var SKIP = /^\/(app|trade|ai|account|invest)(\.html)?\/?$/;
  var root = document.documentElement;

  /* Diagnostics: open any page with ?cbdebug=1 to see what the translator is doing. */
  var DEBUG = /[?&]cbdebug=1/.test(location.search), dbgBox = null, dbgLines = [];
  function log(m) {
    if (!DEBUG) return;
    dbgLines.push(((performance.now() / 1000) | 0) + 's ' + m);
    if (!dbgBox) {
      dbgBox = document.createElement('pre');
      dbgBox.className = 'notranslate'; dbgBox.setAttribute('translate', 'no');
      dbgBox.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;max-width:min(560px,calc(100vw - 16px));max-height:45vh;overflow:auto;margin:0;padding:10px;background:#000;color:#7CFC9A;font:11px/1.4 monospace;white-space:pre-wrap;border:1px solid #7CFC9A;border-radius:8px';
      document.body.appendChild(dbgBox);
    }
    dbgBox.textContent = dbgLines.join('\n');
  }
  document.addEventListener('securitypolicyviolation', function (e) {
    log('CSP BLOCKED ' + e.violatedDirective + ' -> ' + (e.blockedURI || 'inline') + (e.sample ? ' [' + e.sample.slice(0, 60) + ']' : ''));
  });
  if (DEBUG) {
    try {
      var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, u) { this.__cb = String(u); return xo.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function () {
        var x = this, u = x.__cb || '';
        if (/translate/.test(u)) {
          x.addEventListener('loadend', function () { log('XHR ' + x.status + ' ' + u.replace(/\?.*/, '').slice(-45) + ' (' + (x.responseText || '').length + ' bytes)'); });
        }
        return xs.apply(this, arguments);
      };
      new PerformanceObserver(function (l) {
        l.getEntries().forEach(function (en) {
          if (/translate|gstatic/.test(en.name)) log('RES ' + (en.responseStatus || '?') + ' ' + en.initiatorType + ' ' + en.name.replace(/\?.*/, '').slice(-55));
        });
      }).observe({ type: 'resource', buffered: true });
    } catch (e) { log('debug hooks failed: ' + e.message); }
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.src || t.href)) log('LOAD FAILED <' + t.tagName.toLowerCase() + '> ' + (t.src || t.href).replace(/\?.*/, '').slice(-70));
  }, true);
  if (DEBUG && window.fetch) {
    var of = window.fetch;
    window.fetch = function (u) {
      var url = String((u && u.url) || u);
      var p = of.apply(this, arguments);
      if (/translate/.test(url)) p.then(function (r) { log('FETCH ' + r.status + ' ' + url.replace(/\?.*/, '').slice(-60)); }, function (err) { log('FETCH FAILED ' + url.replace(/\?.*/, '').slice(-60) + ' ' + err); });
      return p;
    };
  }
  window.addEventListener('error', function (e) { log('JS error: ' + e.message + ' @ ' + (e.filename || '').split('/').pop()); });

  function getCookie() {
    var m = document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
    if (!m) return 'en';
    var p = decodeURIComponent(m[1]).split('/');
    return p[2] || 'en';
  }
  function setCookie(code) {
    var host = location.hostname, parts = host.split('.'), val = code === 'en' ? '' : '/en/' + code;
    var exp = code === 'en' ? 'Thu, 01 Jan 1970 00:00:00 GMT' : new Date(Date.now() + 365 * 864e5).toUTCString();
    var base = 'googtrans=' + val + '; expires=' + exp + '; path=/; SameSite=Lax';
    document.cookie = base;
    if (parts.length > 1 && !/^\d+(\.\d+){3}$/.test(host) && host !== 'localhost') document.cookie = base + '; domain=.' + parts.slice(-2).join('.');
    try { localStorage.setItem('cb_lang', code); } catch (e) {}
  }

  function injectCss() {
    var s = document.createElement('style');
    s.id = 'cb-lang-css';
    s.textContent =
      '.mk-lang{position:relative;flex-shrink:0}' +
      '.mk-lang-btn{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:inherit;font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s}' +
      '.mk-lang-btn:hover,.mk-lang-btn[aria-expanded="true"]{background:rgba(79,216,232,.1);border-color:rgba(79,216,232,.4)}' +
      '.mk-lang-btn:focus-visible,.mk-lang-menu li:focus-visible{outline:2px solid #4fd8e8;outline-offset:2px}' +
      '.mk-lang-menu{position:absolute;top:calc(100% + 8px);inset-inline-end:0;z-index:1000;isolation:isolate;width:max-content;min-width:170px;max-width:calc(100vw - 24px);max-height:min(70vh,440px);overflow-y:auto;margin:0;padding:6px;list-style:none;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#0d1218;box-shadow:0 18px 40px -12px rgba(0,0,0,.7)}' +
      '.mk-lang-menu[hidden]{display:none}' +
      '.mk-lang-menu li{display:block;list-style:none;margin:0;padding:9px 12px;border-radius:8px;font-size:14px;line-height:1.3;white-space:nowrap;cursor:pointer;color:#cfd8e0;background:transparent}' +
      '.mk-lang-menu li:hover,.mk-lang-menu li:focus{background:rgba(79,216,232,.14);color:#fff}' +
      '.mk-lang-menu li[aria-selected="true"]{color:#4fd8e8;font-weight:700}' +
      '.mk-nav:has(.mk-lang-btn[aria-expanded="true"]){z-index:1000}' +
      '@media (max-width:880px){.mk-lang-btn{height:34px;padding:0 9px}.mk-lang-menu{position:fixed;top:64px;inset-inline-end:12px;inset-inline-start:auto}}' +
      '@media (max-width:420px){.mk-lang-code{display:none}.mk-lang-btn{padding:0 8px}}' +
      /* hide Google's own banner/tooltip so only our button is visible */
      '.goog-te-banner-frame,.goog-te-balloon-frame,#goog-gt-tt,.goog-tooltip,.VIpgJd-ZVi9od-aZ2wEe-wOHMyf,.VIpgJd-ZVi9od-ORHb-OEVmcd,.skiptranslate>iframe{display:none!important}' +
      'body{top:0!important;position:static!important}.goog-text-highlight{background:none!important;box-shadow:none!important}' +
      '#google_translate_element{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}';
    document.head.appendChild(s);
  }

  function loadTranslator(code) {
    if (SKIP.test(location.pathname)) return;
    var holder = document.createElement('div');
    holder.id = 'google_translate_element';
    holder.className = 'notranslate';
    holder.setAttribute('aria-hidden', 'true');
    document.body.appendChild(holder);
    window.cbTranslateInit = function () {
      log('widget init called');
      new google.translate.TranslateElement({
        pageLanguage: 'en',
        autoDisplay: false,
        includedLanguages: LANGS.map(function (l) { return l[0]; }).join(',')
      }, 'google_translate_element');
      // Fallback: if the cookie alone did not trigger a translation, drive the widget directly.
      setTimeout(function () { log('after 4s: html class="' + root.className + '" combo=' + !!document.querySelector('select.goog-te-combo') + ' translated=' + /translated-/.test(root.className)); }, 4000);
      setTimeout(function () { log('after 9s: html class="' + root.className + '" translated=' + /translated-/.test(root.className)); }, 9000);
      var tries = 0, t = setInterval(function () {
        var sel = document.querySelector('select.goog-te-combo');
        if (++tries > 60) { clearInterval(t); log('gave up: combo=' + !!sel + ' options=' + (sel ? sel.options.length : 0)); return; }
        if (!sel || sel.options.length < 2) return;
        clearInterval(t);
        log('combo ready, options=' + sel.options.length + ' -> setting ' + code);
        if (sel.value !== code) { sel.value = code; sel.dispatchEvent(new Event('change', { bubbles: true })); log('change dispatched, value now "' + sel.value + '"'); }
      }, 250);
      setTimeout(function () {
        if (!DEBUG) return;
        var names = performance.getEntriesByType('resource').filter(function (r) { return /translate/.test(r.name); }).map(function (r) { return r.name.replace(/^https:\/\//, '').replace(/\?.*/, '').slice(0, 60); });
        log('translate resources (' + names.length + '): ' + names.join(' | '));
      }, 10000);
    };
    log('cookie googtrans=' + code + ' host=' + location.hostname + ' cookiesEnabled=' + navigator.cookieEnabled);
    var s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=cbTranslateInit';
    s.async = true;
    s.onload = function () { log('element.js loaded'); };
    s.onerror = function () { if (window.console) console.warn('CryptoBolt: translator script blocked or offline'); };
    document.body.appendChild(s);
    root.setAttribute('dir', RTL[code] ? 'rtl' : 'ltr');
  }

  function init() {
    injectCss();
    var box = document.querySelector('.mk-lang');
    var code = getCookie();
    if (code !== 'en') loadTranslator(code);
    if (!box) return;
    var btn = box.querySelector('.mk-lang-btn'), menu = box.querySelector('.mk-lang-menu');
    var label = 'English';
    menu.innerHTML = '';
    LANGS.forEach(function (l) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '-1');
      li.setAttribute('data-lang', l[0]);
      li.setAttribute('lang', l[0]);
      li.className = 'notranslate';
      li.setAttribute('translate', 'no');
      li.setAttribute('aria-selected', l[0] === code ? 'true' : 'false');
      li.textContent = l[1];
      if (l[0] === code) label = l[0].split('-')[0].toUpperCase();
      menu.appendChild(li);
    });
    box.querySelector('.mk-lang-code').textContent = label;
    box.className += ' notranslate';
    box.setAttribute('translate', 'no');
    box.hidden = false;
    function open(v) {
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      menu.hidden = !v;
      if (v) { (menu.querySelector('[aria-selected="true"]') || menu.firstChild).focus(); }
    }
    btn.addEventListener('click', function () { open(menu.hidden); });
    menu.addEventListener('click', function (e) {
      var li = e.target.closest('[data-lang]');
      if (!li) return;
      var next = li.getAttribute('data-lang');
      if (next === code) { open(false); return; }
      setCookie(next);
      location.reload();
    });
    menu.addEventListener('keydown', function (e) {
      var li = document.activeElement;
      if (e.key === 'ArrowDown' && li.nextElementSibling) { li.nextElementSibling.focus(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' && li.previousElementSibling) { li.previousElementSibling.focus(); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') { li.click(); e.preventDefault(); }
      else if (e.key === 'Escape') { open(false); btn.focus(); }
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) open(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();