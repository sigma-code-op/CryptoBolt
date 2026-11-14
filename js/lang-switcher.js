/* CryptoBolt language switcher.
 * Picking a language opens the same page through Google Translate's website translation
 * (https://cryptobolt-io.translate.goog/...), exactly like Google Translate's own "translate this page":
 * every page, in any language Google supports, with no translator script embedded in our pages.
 * Links to the trading terminal always go back to the real site (it must not be translated).
 * "English" returns to cryptobolt.io. Our own pages never load or send anything to Google until a
 * visitor actually picks a language. */
(function () {
  'use strict';
  var CANON = 'https://cryptobolt.io';
  var SUFFIX = '.translate.goog';
  // [our code, label, Google code]
  var LANGS = [
    ['en', 'English', 'en'], ['zh-CN', '简体中文', 'zh-CN'], ['zh-TW', '繁體中文', 'zh-TW'], ['es', 'Español', 'es'],
    ['hi', 'हिन्दी', 'hi'], ['ar', 'العربية', 'ar'], ['pt', 'Português', 'pt'], ['bn', 'বাংলা', 'bn'],
    ['ru', 'Русский', 'ru'], ['ja', '日本語', 'ja'], ['de', 'Deutsch', 'de'], ['fr', 'Français', 'fr'],
    ['ur', 'اردو', 'ur'], ['id', 'Bahasa Indonesia', 'id'], ['tr', 'Türkçe', 'tr'], ['ko', '한국어', 'ko'],
    ['it', 'Italiano', 'it'], ['vi', 'Tiếng Việt', 'vi'], ['pl', 'Polski', 'pl'], ['nl', 'Nederlands', 'nl'],
    ['fa', 'فارسی', 'fa'], ['th', 'ไทย', 'th'], ['uk', 'Українська', 'uk'], ['sv', 'Svenska', 'sv'],
    ['el', 'Ελληνικά', 'el'], ['ro', 'Română', 'ro'], ['cs', 'Čeština', 'cs'], ['hu', 'Magyar', 'hu'],
    ['da', 'Dansk', 'da'], ['fi', 'Suomi', 'fi'], ['no', 'Norsk', 'no'], ['he', 'עברית', 'iw'],
    ['ms', 'Bahasa Melayu', 'ms'], ['ta', 'தமிழ்', 'ta'], ['sw', 'Kiswahili', 'sw'], ['tl', 'Filipino', 'tl'],
    ['bg', 'Български', 'bg'], ['sr', 'Српски', 'sr'], ['hr', 'Hrvatski', 'hr'], ['sk', 'Slovenčina', 'sk']
  ];
  var TERMINAL = /^\/(app|trade|ai|account|invest)(\.html)?\/?$/;
  var ON_PROXY = location.hostname.slice(-SUFFIX.length) === SUFFIX;

  function proxyHost() {
    return new URL(CANON).hostname.replace(/-/g, '--').replace(/\./g, '-') + SUFFIX;
  }
  function stripTr(search) {
    var kept = search.replace(/^\?/, '').split('&').filter(function (p) { return p && !/^_x_tr_/.test(p); });
    return kept.length ? '?' + kept.join('&') : '';
  }
  function currentLang() {
    if (!ON_PROXY) return 'en';
    var m = location.search.match(/[?&]_x_tr_tl=([^&]+)/);
    var g = m ? decodeURIComponent(m[1]) : 'en';
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i][2] === g || LANGS[i][0] === g) return LANGS[i][0];
    return 'en';
  }
  function urlFor(entry) {
    var rest = location.pathname + stripTr(location.search) + location.hash;
    if (entry[0] === 'en') return CANON + rest;
    var q = '_x_tr_sl=en&_x_tr_tl=' + encodeURIComponent(entry[2]) + '&_x_tr_hl=en&_x_tr_pto=wapp';
    var sep = stripTr(location.search) ? '&' : '?';
    var hashAt = rest.indexOf('#');
    var main = hashAt < 0 ? rest : rest.slice(0, hashAt), hash = hashAt < 0 ? '' : rest.slice(hashAt);
    return 'https://' + proxyHost() + main + sep + q + hash;
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
      '@media (max-width:420px){.mk-lang-code{display:none}.mk-lang-btn{padding:0 8px}}';
    document.head.appendChild(s);
  }

  function init() {
    injectCss();
    var code = currentLang();
    if (ON_PROXY) {
      // Inside Google's translated copy: the terminal must open on the real site, untranslated.
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a || e.defaultPrevented || e.button) return;
        if (TERMINAL.test(a.pathname)) {
          e.preventDefault();
          location.href = CANON + a.pathname + stripTr(a.search) + a.hash;
        }
      }, true);
    }
    var box = document.querySelector('.mk-lang');
    if (!box) return;
    var btn = box.querySelector('.mk-lang-btn'), menu = box.querySelector('.mk-lang-menu');
    var current = LANGS[0];
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
      for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === next) location.href = urlFor(LANGS[i]);
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