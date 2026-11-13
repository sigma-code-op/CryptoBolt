/* CryptoBolt language switcher (landing page).
 * Pure client-side: the HTML stays English (good for SEO and crawlers); a chosen language
 * is applied by swapping exact-match text nodes and is remembered in localStorage.
 * To add a string, add an English key to T and one value per language in LANGS order.
 * To add a language, add it to LANGS and append a value to every T entry. */
(function () {
  'use strict';
  var LANGS = [
    { code: 'en', label: 'English', short: 'EN', dir: 'ltr' },
    { code: 'ur', label: 'اردو', short: 'UR', dir: 'rtl' },
    { code: 'ar', label: 'العربية', short: 'AR', dir: 'rtl' },
    { code: 'hi', label: 'हिन्दी', short: 'HI', dir: 'ltr' },
    { code: 'es', label: 'Español', short: 'ES', dir: 'ltr' },
    { code: 'fr', label: 'Français', short: 'FR', dir: 'ltr' }
  ];
  // [ur, ar, hi, es, fr]
  var T = {
    'Features': ['خصوصیات', 'المزايا', 'सुविधाएँ', 'Funciones', 'Fonctionnalités'],
    'AI Research': ['اے آئی ریسرچ', 'أبحاث الذكاء الاصطناعي', 'AI रिसर्च', 'Investigación IA', 'Recherche IA'],
    'Blog': ['بلاگ', 'المدونة', 'ब्लॉग', 'Blog', 'Blog'],
    'Ebook': ['ای بک', 'الكتاب الإلكتروني', 'ई-बुक', 'Ebook', 'Ebook'],
    'Editorial policy': ['ادارتی پالیسی', 'السياسة التحريرية', 'संपादकीय नीति', 'Política editorial', 'Politique éditoriale'],
    'About': ['ہمارے بارے میں', 'من نحن', 'हमारे बारे में', 'Acerca de', 'À propos'],
    'Sign in': ['سائن اِن', 'تسجيل الدخول', 'साइन इन', 'Iniciar sesión', 'Connexion'],
    'Launch Terminal': ['ٹرمینل کھولیں', 'شغّل المنصة', 'टर्मिनल खोलें', 'Abrir terminal', 'Lancer le terminal'],
    'Live · Spot & Futures · No signup to browse': ['لائیو · اسپاٹ اور فیوچرز · براؤز کرنے کے لیے سائن اپ نہیں', 'مباشر · فوري وعقود آجلة · بلا تسجيل للتصفح', 'लाइव · स्पॉट और फ्यूचर्स · ब्राउज़ करने के लिए साइनअप नहीं', 'En vivo · Spot y Futuros · Sin registro para navegar', 'En direct · Spot et Futures · Sans inscription pour naviguer'],
    'Live Bitcoin, Ethereum & altcoin prices': ['لائیو بٹ کوائن، ایتھیریم اور آلٹ کوائن قیمتیں', 'أسعار مباشرة للبيتكوين والإيثيريوم والعملات البديلة', 'लाइव बिटकॉइन, एथेरियम और altcoin की कीमतें', 'Precios en vivo de Bitcoin, Ethereum y altcoins', 'Prix en direct du Bitcoin, de l’Ethereum et des altcoins'],
    'with a free crypto trading terminal': ['مفت کرپٹو ٹریڈنگ ٹرمینل کے ساتھ', 'مع منصة تداول كريبتو مجانية', 'मुफ़्त क्रिप्टो ट्रेडिंग टर्मिनल के साथ', 'con un terminal de trading cripto gratis', 'avec un terminal de trading crypto gratuit'],
    'and AI market research.': ['اور اے آئی مارکیٹ ریسرچ۔', 'وأبحاث سوق بالذكاء الاصطناعي.', 'और AI मार्केट रिसर्च।', 'e investigación de mercado con IA.', 'et une recherche de marché par IA.'],
    'Explore features': ['خصوصیات دیکھیں', 'استكشف المزايا', 'सुविधाएँ देखें', 'Explorar funciones', 'Découvrir les fonctionnalités'],
    'Free to use · No account required to browse live data': ['مفت استعمال · لائیو ڈیٹا دیکھنے کے لیے اکاؤنٹ ضروری نہیں', 'مجاني · لا حاجة لحساب لتصفح البيانات المباشرة', 'मुफ़्त · लाइव डेटा देखने के लिए अकाउंट ज़रूरी नहीं', 'Gratis · Sin cuenta para ver datos en vivo', 'Gratuit · Aucun compte requis pour voir les données en direct'],
    'Live from Binance': ['بائنانس سے لائیو', 'مباشر من باينانس', 'Binance से लाइव', 'En vivo desde Binance', 'En direct de Binance'],
    'Connecting…': ['منسلک ہو رہا ہے…', 'جارٍ الاتصال…', 'कनेक्ट हो रहा है…', 'Conectando…', 'Connexion…'],
    'Virtual paper trading balance': ['ورچوئل پیپر ٹریڈنگ بیلنس', 'رصيد تداول تجريبي افتراضي', 'वर्चुअल पेपर ट्रेडिंग बैलेंस', 'Saldo virtual de paper trading', 'Solde virtuel de paper trading'],
    'Live Binance spot & futures data': ['لائیو بائنانس اسپاٹ اور فیوچرز ڈیٹا', 'بيانات باينانس الفورية والآجلة المباشرة', 'लाइव Binance स्पॉट और फ्यूचर्स डेटा', 'Datos spot y futuros de Binance en vivo', 'Données spot et futures Binance en direct'],
    'Free forever, no signup to browse': ['ہمیشہ مفت، براؤز کرنے کے لیے سائن اپ نہیں', 'مجاني دائمًا، بلا تسجيل للتصفح', 'हमेशा मुफ़्त, ब्राउज़ करने के लिए साइनअप नहीं', 'Gratis siempre, sin registro para navegar', 'Gratuit pour toujours, sans inscription'],
    'Bonus cash — invite a friend to trade': ['بونس کیش — دوست کو ٹریڈنگ کی دعوت دیں', 'مكافأة نقدية — ادعُ صديقًا للتداول', 'बोनस कैश — दोस्त को ट्रेड के लिए आमंत्रित करें', 'Bono en efectivo: invita a un amigo a operar', 'Bonus en cash : invitez un ami à trader'],
    'Getting started': ['شروعات کریں', 'البدء', 'शुरुआत करें', 'Primeros pasos', 'Pour commencer'],
    'From open tab to live chart in under a minute.': ['ٹیب کھولنے سے لائیو چارٹ تک ایک منٹ سے بھی کم میں۔', 'من فتح التبويب إلى الرسم البياني المباشر في أقل من دقيقة.', 'टैब खोलने से लाइव चार्ट तक एक मिनट से भी कम में।', 'De abrir la pestaña al gráfico en vivo en menos de un minuto.', 'De l’onglet ouvert au graphique en direct en moins d’une minute.'],
    'No account, no download, no credit card. The terminal loads with live data the moment you land on it.': ['نہ اکاؤنٹ، نہ ڈاؤن لوڈ، نہ کریڈٹ کارڈ۔ ٹرمینل کھلتے ہی لائیو ڈیٹا کے ساتھ لوڈ ہو جاتا ہے۔', 'بلا حساب ولا تنزيل ولا بطاقة ائتمان. تُحمَّل المنصة بالبيانات المباشرة فور دخولك.', 'न अकाउंट, न डाउनलोड, न क्रेडिट कार्ड। टर्मिनल खुलते ही लाइव डेटा के साथ लोड हो जाता है।', 'Sin cuenta, sin descargas, sin tarjeta. El terminal carga con datos en vivo al instante.', 'Pas de compte, pas de téléchargement, pas de carte. Le terminal se charge avec les données en direct dès votre arrivée.'],
    'Open the terminal': ['ٹرمینل کھولیں', 'افتح المنصة', 'टर्मिनल खोलें', 'Abre el terminal', 'Ouvrez le terminal'],
    'Pick your pair and set alerts': ['اپنا جوڑا چنیں اور الرٹ لگائیں', 'اختر زوجك وضع التنبيهات', 'अपना पेयर चुनें और अलर्ट लगाएँ', 'Elige tu par y crea alertas', 'Choisissez votre paire et définissez des alertes'],
    'Add AI research when you\'re ready': ['تیار ہوں تو اے آئی ریسرچ شامل کریں', 'أضف أبحاث الذكاء الاصطناعي عندما تكون جاهزًا', 'तैयार हों तो AI रिसर्च जोड़ें', 'Añade investigación con IA cuando quieras', 'Ajoutez la recherche IA quand vous êtes prêt'],
    'What\'s inside': ['اندر کیا ہے', 'ماذا بالداخل', 'अंदर क्या है', 'Qué incluye', 'Ce qu’il y a dedans'],
    'One terminal, the whole desk.': ['ایک ٹرمینل، پوری ٹریڈنگ ڈیسک۔', 'منصة واحدة، مكتب تداول كامل.', 'एक टर्मिनल, पूरा ट्रेडिंग डेस्क।', 'Un terminal, toda la mesa de trading.', 'Un terminal, tout le bureau de trading.'],
    'See every feature': ['تمام خصوصیات دیکھیں', 'شاهد كل المزايا', 'सभी सुविधाएँ देखें', 'Ver todas las funciones', 'Voir toutes les fonctionnalités'],
    'AI Research desk': ['اے آئی ریسرچ ڈیسک', 'مكتب أبحاث الذكاء الاصطناعي', 'AI रिसर्च डेस्क', 'Mesa de investigación IA', 'Bureau de recherche IA'],
    'Price alerts': ['قیمت کے الرٹس', 'تنبيهات الأسعار', 'प्राइस अलर्ट', 'Alertas de precio', 'Alertes de prix'],
    'Paper trading account': ['پیپر ٹریڈنگ اکاؤنٹ', 'حساب تداول تجريبي', 'पेपर ट्रेडिंग अकाउंट', 'Cuenta de paper trading', 'Compte de paper trading'],
    'Why CryptoBolt': ['کرپٹو بولٹ ہی کیوں', 'لماذا CryptoBolt', 'CryptoBolt क्यों', 'Por qué CryptoBolt', 'Pourquoi CryptoBolt'],
    'FAQ': ['اکثر پوچھے گئے سوالات', 'الأسئلة الشائعة', 'अक्सर पूछे जाने वाले प्रश्न', 'Preguntas frecuentes', 'FAQ'],
    'Common questions about CryptoBolt': ['کرپٹو بولٹ کے بارے میں عام سوالات', 'أسئلة شائعة حول CryptoBolt', 'CryptoBolt के बारे में आम सवाल', 'Preguntas comunes sobre CryptoBolt', 'Questions fréquentes sur CryptoBolt'],
    'Is CryptoBolt free to use?': ['کیا کرپٹو بولٹ مفت ہے؟', 'هل CryptoBolt مجاني؟', 'क्या CryptoBolt मुफ़्त है?', '¿CryptoBolt es gratis?', 'CryptoBolt est-il gratuit ?'],
    'Pull up the terminal. Watch the market live.': ['ٹرمینل کھولیں۔ مارکیٹ لائیو دیکھیں۔', 'افتح المنصة وتابع السوق مباشرة.', 'टर्मिनल खोलें। मार्केट लाइव देखें।', 'Abre el terminal. Mira el mercado en vivo.', 'Ouvrez le terminal. Suivez le marché en direct.'],
    'Free to use, nothing to install, no signup required to browse.': ['مفت، انسٹال کچھ نہیں، براؤز کرنے کے لیے سائن اپ نہیں۔', 'مجاني، بلا تثبيت، ولا تسجيل للتصفح.', 'मुफ़्त, कुछ इंस्टॉल नहीं, ब्राउज़ करने के लिए साइनअप नहीं।', 'Gratis, sin instalar nada, sin registro para navegar.', 'Gratuit, rien à installer, sans inscription pour naviguer.'],
    'Product': ['پروڈکٹ', 'المنتج', 'प्रोडक्ट', 'Producto', 'Produit'],
    'Company': ['کمپنی', 'الشركة', 'कंपनी', 'Empresa', 'Entreprise'],
    'Legal': ['قانونی', 'قانوني', 'कानूनी', 'Legal', 'Mentions légales'],
    'Terminal': ['ٹرمینل', 'المنصة', 'टर्मिनल', 'Terminal', 'Terminal'],
    'Contact': ['رابطہ', 'اتصل بنا', 'संपर्क', 'Contacto', 'Contact'],
    'Privacy policy': ['پرائیویسی پالیسی', 'سياسة الخصوصية', 'गोपनीयता नीति', 'Política de privacidad', 'Politique de confidentialité'],
    'Terms of service': ['سروس کی شرائط', 'شروط الخدمة', 'सेवा की शर्तें', 'Términos del servicio', 'Conditions d’utilisation'],
    'Educational content only, not financial advice.': ['صرف تعلیمی مواد، مالی مشورہ نہیں۔', 'محتوى تعليمي فقط وليس نصيحة مالية.', 'केवल शैक्षिक सामग्री, वित्तीय सलाह नहीं।', 'Solo contenido educativo, no es asesoramiento financiero.', 'Contenu éducatif uniquement, pas un conseil financier.']
  };
  var KEY = 'cb_lang';
  var orig = new WeakMap(), nodes = [];
  var root = document.documentElement;

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  function collect() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        if (p === 'SCRIPT' || p === 'STYLE' || p === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        return T[norm(n.nodeValue)] ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var n;
    while ((n = w.nextNode())) { if (!orig.has(n)) { orig.set(n, n.nodeValue); nodes.push(n); } }
  }

  function apply(code) {
    var idx = -1, i;
    for (i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) idx = i;
    if (idx < 0) { idx = 0; code = 'en'; }
    collect();
    nodes.forEach(function (n) {
      var src = orig.get(n);
      if (idx === 0) { n.nodeValue = src; return; }
      var row = T[norm(src)];
      if (!row) return;
      var lead = (src.match(/^\s*/) || [''])[0], trail = (src.match(/\s*$/) || [''])[0];
      n.nodeValue = lead + row[idx - 1] + trail;
    });
    root.setAttribute('lang', code);
    root.setAttribute('dir', LANGS[idx].dir);
    var cur = document.querySelector('.mk-lang-code');
    if (cur) cur.textContent = LANGS[idx].short;
    var items = document.querySelectorAll('.mk-lang-menu [role="option"]');
    for (i = 0; i < items.length; i++) items[i].setAttribute('aria-selected', items[i].getAttribute('data-lang') === code ? 'true' : 'false');
    try { localStorage.setItem(KEY, code); } catch (e) {}
  }

  function init() {
    var box = document.querySelector('.mk-lang');
    if (!box) return;
    var btn = box.querySelector('.mk-lang-btn'), menu = box.querySelector('.mk-lang-menu');
    menu.innerHTML = '';
    LANGS.forEach(function (l) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '-1');
      li.setAttribute('data-lang', l.code);
      li.setAttribute('lang', l.code);
      li.textContent = l.label;
      menu.appendChild(li);
    });
    function open(v) {
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      menu.hidden = !v;
      if (v) { var s = menu.querySelector('[aria-selected="true"]') || menu.firstChild; s.focus(); }
    }
    btn.addEventListener('click', function () { open(menu.hidden); });
    menu.addEventListener('click', function (e) {
      var li = e.target.closest('[data-lang]');
      if (li) { apply(li.getAttribute('data-lang')); open(false); btn.focus(); }
    });
    menu.addEventListener('keydown', function (e) {
      var li = document.activeElement;
      if (e.key === 'ArrowDown' && li.nextElementSibling) { li.nextElementSibling.focus(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' && li.previousElementSibling) { li.previousElementSibling.focus(); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') { li.click(); e.preventDefault(); }
      else if (e.key === 'Escape') { open(false); btn.focus(); }
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) open(false); });
    var saved = 'en';
    try { saved = localStorage.getItem(KEY) || 'en'; } catch (e) {}
    apply(saved);
    // Ticker text ("Connecting…") is rewritten by other scripts; re-apply once they settle.
    if (saved !== 'en') setTimeout(function () { apply(saved); }, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();