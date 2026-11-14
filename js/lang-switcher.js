/* CryptoBolt language switcher - self-contained, no third-party translator.
 * Swaps known English phrases for translations stored in this file, instantly, with no reload.
 * Text that has no translation here stays in English. The choice is kept in localStorage.
 * Terminal pages are never translated (live numbers, buttons and the AI must stay exact).
 * To add a phrase: append a row below, in the order of LANGS: [English, es, hi, ur, ar, fr]. */
(function () {
  'use strict';
  var LANGS = [['en', 'English'], ['es', 'Español'], ['hi', 'हिन्दी'], ['ur', 'اردو'], ['ar', 'العربية'], ['fr', 'Français']];
  var RTL = { ur: 1, ar: 1 };
  var TERMINAL = /^\/(app|trade|ai|account|invest)(\.html)?\/?$/;
  var ROWS = [
    ['Features', 'Funciones', 'सुविधाएँ', 'خصوصیات', 'الميزات', 'Fonctionnalités'],
    ['AI Research', 'Investigación con IA', 'AI रिसर्च', 'AI ریسرچ', 'أبحاث الذكاء الاصطناعي', 'Recherche IA'],
    ['Blog', 'Blog', 'ब्लॉग', 'بلاگ', 'المدونة', 'Blog'],
    ['Ebook', 'Ebook', 'ई-बुक', 'ای بک', 'الكتاب الإلكتروني', 'Ebook'],
    ['Editorial policy', 'Política editorial', 'संपादकीय नीति', 'ادارتی پالیسی', 'السياسة التحريرية', 'Politique éditoriale'],
    ['About', 'Acerca de', 'हमारे बारे में', 'ہمارے بارے میں', 'حول', 'À propos'],
    ['Sign in', 'Iniciar sesión', 'साइन इन', 'سائن ان', 'تسجيل الدخول', 'Connexion'],
    ['Launch Terminal', 'Abrir terminal', 'टर्मिनल खोलें', 'ٹرمینل کھولیں', 'افتح المنصة', 'Ouvrir le terminal'],
    ['Explore features', 'Ver funciones', 'सुविधाएँ देखें', 'خصوصیات دیکھیں', 'استكشف الميزات', 'Voir les fonctionnalités'],
    ['Live · Spot & Futures · No signup to browse', 'En vivo · Spot y Futuros · Sin registro para explorar', 'लाइव · स्पॉट और फ्यूचर्स · देखने के लिए साइनअप नहीं', 'لائیو · اسپاٹ اور فیوچرز · دیکھنے کے لیے سائن اپ نہیں', 'مباشر · فوري وعقود آجلة · دون تسجيل للتصفح', 'En direct · Spot et Futures · Sans inscription pour explorer'],
    ['Live Bitcoin, Ethereum & altcoin prices', 'Precios en vivo de Bitcoin, Ethereum y altcoins', 'बिटकॉइन, एथेरियम और altcoin की लाइव कीमतें', 'بٹ کوائن، ایتھریم اور آلٹ کوائنز کی لائیو قیمتیں', 'أسعار بيتكوين وإيثريوم والعملات البديلة مباشرة', 'Prix en direct du Bitcoin, de l’Ethereum et des altcoins'],
    ['with a free crypto trading terminal', 'con un terminal de trading cripto gratis', 'एक मुफ़्त क्रिप्टो ट्रेडिंग टर्मिनल के साथ', 'مفت کرپٹو ٹریڈنگ ٹرمینل کے ساتھ', 'مع منصة تداول عملات رقمية مجانية', 'avec un terminal de trading crypto gratuit'],
    ['and AI market research.', 'e investigación de mercado con IA.', 'और AI मार्केट रिसर्च।', 'اور AI مارکیٹ ریسرچ۔', 'وأبحاث سوق بالذكاء الاصطناعي.', 'et une recherche de marché par IA.'],
    ['Free to use · No account required to browse live data', 'Gratis · No necesitas cuenta para ver datos en vivo', 'मुफ़्त · लाइव डेटा देखने के लिए अकाउंट की ज़रूरत नहीं', 'مفت · لائیو ڈیٹا دیکھنے کے لیے اکاؤنٹ کی ضرورت نہیں', 'مجاني · لا حاجة لحساب لعرض البيانات المباشرة', 'Gratuit · Aucun compte requis pour voir les données en direct'],
    ['Getting started', 'Primeros pasos', 'शुरू करें', 'شروع کریں', 'البدء', 'Pour commencer'],
    ['See every feature', 'Ver todas las funciones', 'सभी सुविधाएँ देखें', 'تمام خصوصیات دیکھیں', 'شاهد كل الميزات', 'Voir toutes les fonctionnalités'],
    ['Open AI Research', 'Abrir investigación IA', 'AI रिसर्च खोलें', 'AI ریسرچ کھولیں', 'افتح أبحاث الذكاء الاصطناعي', 'Ouvrir la recherche IA'],
    ['Why CryptoBolt', 'Por qué CryptoBolt', 'CryptoBolt क्यों', 'CryptoBolt کیوں', 'لماذا CryptoBolt', 'Pourquoi CryptoBolt'],
    ['FAQ', 'Preguntas frecuentes', 'अक्सर पूछे जाने वाले प्रश्न', 'اکثر پوچھے گئے سوالات', 'الأسئلة الشائعة', 'FAQ'],
    ['Common questions about CryptoBolt', 'Preguntas comunes sobre CryptoBolt', 'CryptoBolt के बारे में आम सवाल', 'CryptoBolt کے بارے میں عام سوالات', 'أسئلة شائعة حول CryptoBolt', 'Questions fréquentes sur CryptoBolt'],
    ['Pull up the terminal. Watch the market live.', 'Abre el terminal. Mira el mercado en vivo.', 'टर्मिनल खोलें। बाज़ार को लाइव देखें।', 'ٹرمینل کھولیں۔ مارکیٹ کو لائیو دیکھیں۔', 'افتح المنصة وشاهد السوق مباشرة.', 'Ouvrez le terminal. Suivez le marché en direct.'],
    ['Free to use, nothing to install, no signup required to browse.', 'Gratis, sin instalar nada y sin registro para explorar.', 'मुफ़्त, कुछ इंस्टॉल नहीं करना, देखने के लिए साइनअप नहीं।', 'مفت، کچھ انسٹال نہیں کرنا، دیکھنے کے لیے سائن اپ نہیں۔', 'مجاني، دون تثبيت، ودون تسجيل للتصفح.', 'Gratuit, rien à installer, sans inscription pour explorer.'],
    ['Product', 'Producto', 'उत्पाद', 'پروڈکٹ', 'المنتج', 'Produit'],
    ['Terminal', 'Terminal', 'टर्मिनल', 'ٹرمینل', 'المنصة', 'Terminal'],
    ['Releases', 'Versiones', 'रिलीज़', 'ریلیزز', 'الإصدارات', 'Versions'],
    ['Paper trading', 'Trading simulado', 'पेपर ट्रेडिंग', 'پیپر ٹریڈنگ', 'التداول التجريبي', 'Paper trading'],
    ['Markets & tools', 'Mercados y herramientas', 'बाज़ार और टूल', 'مارکیٹس اور ٹولز', 'الأسواق والأدوات', 'Marchés et outils'],
    ['Bitcoin price', 'Precio de Bitcoin', 'बिटकॉइन की कीमत', 'بٹ کوائن کی قیمت', 'سعر بيتكوين', 'Prix du Bitcoin'],
    ['Ethereum price', 'Precio de Ethereum', 'एथेरियम की कीमत', 'ایتھریم کی قیمت', 'سعر إيثريوم', 'Prix de l’Ethereum'],
    ['Solana price', 'Precio de Solana', 'सोलाना की कीमत', 'سولانا کی قیمت', 'سعر سولانا', 'Prix du Solana'],
    ['Company', 'Empresa', 'कंपनी', 'کمپنی', 'الشركة', 'Entreprise'],
    ['Glossary', 'Glosario', 'शब्दावली', 'لغت', 'المسرد', 'Glossaire'],
    ['Contact', 'Contacto', 'संपर्क', 'رابطہ', 'اتصل بنا', 'Contact'],
    ['Legal', 'Legal', 'कानूनी', 'قانونی', 'قانوني', 'Mentions légales'],
    ['Privacy policy', 'Política de privacidad', 'गोपनीयता नीति', 'پرائیویسی پالیسی', 'سياسة الخصوصية', 'Politique de confidentialité'],
    ['Terms of service', 'Términos del servicio', 'सेवा की शर्तें', 'سروس کی شرائط', 'شروط الخدمة', 'Conditions d’utilisation'],
    ['Educational content only, not financial advice.', 'Solo contenido educativo, no es asesoramiento financiero.', 'केवल शैक्षिक सामग्री, वित्तीय सलाह नहीं।', 'صرف تعلیمی مواد، مالی مشورہ نہیں۔', 'محتوى تعليمي فقط وليس نصيحة مالية.', 'Contenu éducatif uniquement, pas un conseil financier.']
  ];
  var DICT = {};
  ROWS.forEach(function (r) { DICT[r[0].toLowerCase()] = r; });

  var originals = new WeakMap();
  function store(get) { try { return get(); } catch (e) { return null; } }
  function saved() { var c = store(function () { return localStorage.getItem('cb-lang'); }); return LANGS.some(function (l) { return l[0] === c; }) ? c : 'en'; }

  function apply(code) {
    var idx = LANGS.map(function (l) { return l[0]; }).indexOf(code);
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(p.nodeName) || p.closest('.mk-lang,[translate="no"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) {
      var orig = originals.has(n) ? originals.get(n) : n.nodeValue;
      var core = orig.trim();
      if (!core) continue;
      var row = DICT[core.replace(/\s+/g, ' ').toLowerCase()];
      if (!row) continue;
      if (!originals.has(n)) originals.set(n, orig);
      var lead = orig.match(/^\s*/)[0], tail = orig.match(/\s*$/)[0];
      n.nodeValue = idx > 0 ? lead + row[idx] + tail : orig;
    }
    var h = document.documentElement;
    h.setAttribute('lang', code);
    if (RTL[code]) h.setAttribute('dir', 'rtl'); else h.removeAttribute('dir');
  }

  function css() {
    var s = document.createElement('style');
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
    var box = document.querySelector('.mk-lang');
    if (!box || TERMINAL.test(location.pathname)) return;
    css();
    var code = saved();
    var btn = box.querySelector('.mk-lang-btn'), menu = box.querySelector('.mk-lang-menu');
    box.setAttribute('translate', 'no');
    box.hidden = false;
    menu.innerHTML = '';
    LANGS.forEach(function (l) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '-1');
      li.setAttribute('data-lang', l[0]);
      li.setAttribute('lang', l[0]);
      li.textContent = l[1];
      menu.appendChild(li);
    });
    function mark() {
      Array.prototype.forEach.call(menu.children, function (li) { li.setAttribute('aria-selected', li.getAttribute('data-lang') === code ? 'true' : 'false'); });
      box.querySelector('.mk-lang-code').textContent = code.toUpperCase();
    }
    function open(v) {
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      menu.hidden = !v;
      if (v) (menu.querySelector('[aria-selected="true"]') || menu.firstChild).focus();
    }
    mark();
    if (code !== 'en') {
      apply(code);
      var t, mo = new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { if (code !== 'en') apply(code); }, 200); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    btn.addEventListener('click', function () { open(menu.hidden); });
    menu.addEventListener('click', function (e) {
      var li = e.target.closest('[data-lang]');
      if (!li) return;
      code = li.getAttribute('data-lang');
      store(function () { localStorage.setItem('cb-lang', code); });
      apply(code); mark(); open(false);
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