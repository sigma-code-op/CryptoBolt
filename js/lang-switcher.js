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
    if (parts.length > 1) document.cookie = base + '; domain=.' + parts.slice(-2).join('.');
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
      new google.translate.TranslateElement({
        pageLanguage: 'en',
        autoDisplay: false,
        includedLanguages: LANGS.map(function (l) { return l[0]; }).join(',')
      }, 'google_translate_element');
    };
    var s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=cbTranslateInit';
    s.async = true;
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