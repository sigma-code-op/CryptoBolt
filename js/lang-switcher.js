/* CryptoBolt language switcher.
 * Translates the page you are on, in place, with Google's website translator (no redirect, no proxy).
 * Nothing from Google is loaded until a visitor picks a language; the choice is remembered in the
 * "googtrans" cookie, so the next page opens already translated. English clears it.
 * The trading terminal pages are never translated (live numbers, buttons and the AI must stay exact). */
(function () {
  'use strict';
  // [code, label] - the 10 languages most likely to be used by CryptoBolt visitors
  var LANGS = [
    ['en', 'English'], ['es', 'Español'], ['hi', 'हिन्दी'], ['ur', 'اردو'], ['ar', 'العربية'],
    ['fr', 'Français'], ['pt', 'Português'], ['ru', 'Русский'], ['zh-CN', '简体中文'], ['tr', 'Türkçe']
  ];
  var TERMINAL = /^\/(app|trade|ai|account|invest)(\.html)?\/?$/;

  function readLang() {
    var m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]*\/([^;]+)/);
    var c = m ? decodeURIComponent(m[1]) : 'en';
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === c) return c;
    return 'en';
  }
  function expire(domain) {
    document.cookie = 'googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/' + (domain ? ';domain=' + domain : '');
  }
  function writeLang(code) {
    var host = location.hostname, parts = host.split('.');
    var root = parts.length > 1 ? '.' + parts.slice(-2).join('.') : '';
    expire(); expire(host); if (root) expire(root);
    if (code === 'en') return;
    var v = 'googtrans=/en/' + code + ';path=/';
    document.cookie = v;
    if (root) document.cookie = v + ';domain=' + root;
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
      /* hide Google's own banner/tooltips; keep our button as the only control */
      'body{top:0!important}.goog-te-banner-frame,iframe.skiptranslate,#goog-gt-tt,.goog-tooltip,.goog-te-balloon-frame{display:none!important}' +
      '.goog-text-highlight{background:none!important;box-shadow:none!important}' +
      '#cb-gt{position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden}' +
      '@media (max-width:880px){.mk-lang-btn{height:34px;padding:0 9px}.mk-lang-menu{position:fixed;top:64px;inset-inline-end:12px;inset-inline-start:auto}}' +
      '@media (max-width:420px){.mk-lang-code{display:none}.mk-lang-btn{padding:0 8px}}';
    document.head.appendChild(s);
  }

  function loadTranslator(onFail) {
    var holder = document.createElement('div');
    holder.id = 'cb-gt';
    holder.className = 'notranslate';
    document.body.appendChild(holder);
    window.googleTranslateElementInit = function () {
      new window.google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: LANGS.slice(1).map(function (l) { return l[0]; }).join(','),
        autoDisplay: false
      }, 'cb-gt');
    };
    var s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    s.onerror = onFail;
    document.head.appendChild(s);
  }

  function init() {
    var box = document.querySelector('.mk-lang');
    if (!box) return;
    if (TERMINAL.test(location.pathname)) { writeLangKeep(); return; } // terminal stays untranslated, button hidden
    injectCss();
    var code = readLang(), current = LANGS[0];
    var btn = box.querySelector('.mk-lang-btn'), menu = box.querySelector('.mk-lang-menu');
    menu.innerHTML = '';
    LANGS.forEach(function (l) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '-1');
      li.setAttribute('data-lang', l[0]);
      li.setAttribute('lang', l[0]);
      li.setAttribute('translate', 'no');
      li.className = 'notranslate';
      li.setAttribute('aria-selected', l[0] === code ? 'true' : 'false');
      li.textContent = l[1];
      if (l[0] === code) current = l;
      menu.appendChild(li);
    });
    box.querySelector('.mk-lang-code').textContent = current[0].split('-')[0].toUpperCase();
    box.className += ' notranslate';
    box.setAttribute('translate', 'no');
    box.hidden = false;

    if (code !== 'en') {
      loadTranslator(function () { writeLang('en'); }); // translator blocked/offline: fall back to English
    }

    function open(v) {
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      menu.hidden = !v;
      if (v) (menu.querySelector('[aria-selected="true"]') || menu.firstChild).focus();
    }
    btn.addEventListener('click', function () { open(menu.hidden); });
    menu.addEventListener('click', function (e) {
      var li = e.target.closest('[data-lang]');
      if (!li) return;
      var next = li.getAttribute('data-lang');
      if (next === code) { open(false); return; }
      writeLang(next);
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
  function writeLangKeep() { /* terminal pages: never load the translator, leave the button hidden */ }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();