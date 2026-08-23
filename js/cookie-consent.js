// ---------------------------------------------------------------------------
// CryptoBolt: cookie consent banner + Google Consent Mode v2 wiring.
//
// GA4 (gtag.js) and AdSense both set cookies for analytics/ad personalization.
// Each HTML page that loads them sets Consent Mode's default to "denied"
// *before* those scripts run (see the inline snippet in <head>) — this file
// is what turns that into an actual accept/reject choice for the visitor,
// persists it, and re-applies it on every later page load via gtag('consent',
// 'update', ...), which every Google tag on the page reads.
//
// No dependencies, no build step — include with a plain <script defer> tag.
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  var STORAGE_KEY = 'cw_cookie_consent'; // 'granted' | 'denied'

  function applyConsent(status) {
    if (typeof window.gtag !== 'function') return;
    var granted = status === 'granted';
    window.gtag('consent', 'update', {
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
      analytics_storage: granted ? 'granted' : 'denied',
    });
  }

  function getStoredConsent() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === 'granted' || v === 'denied' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function storeConsent(status) {
    try {
      localStorage.setItem(STORAGE_KEY, status);
    } catch (e) {
      /* localStorage unavailable — consent still applies for this page load */
    }
  }

  function injectStyles() {
    if (document.getElementById('cw-cookie-consent-styles')) return;
    var style = document.createElement('style');
    style.id = 'cw-cookie-consent-styles';
    style.textContent = [
      '.cw-cc-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;',
      'background:#11131a;border-top:1px solid #21242f;',
      'box-shadow:0 -8px 30px rgba(0,0,0,.45);',
      'padding:14px 16px;font-family:Inter,system-ui,sans-serif;',
      'transform:translateY(100%);transition:transform .35s cubic-bezier(0.16,1,0.3,1);}',
      '.cw-cc-banner.cw-cc-visible{transform:translateY(0);}',
      '.cw-cc-inner{max-width:1200px;margin:0 auto;display:flex;flex-wrap:wrap;',
      'align-items:center;gap:14px;justify-content:space-between;}',
      '.cw-cc-text{flex:1 1 320px;min-width:0;color:#c3c8d4;font-size:12.5px;line-height:1.5;}',
      '.cw-cc-text a{color:#4fd8e8;text-decoration:none;}',
      '.cw-cc-text a:hover{text-decoration:underline;}',
      '.cw-cc-actions{display:flex;gap:8px;flex-shrink:0;}',
      '.cw-cc-btn{font-size:12px;font-weight:600;padding:8px 16px;border-radius:8px;',
      'cursor:pointer;border:1px solid #21242f;background:#151822;color:#e9ebf1;',
      'transition:border-color .15s,background .15s;white-space:nowrap;}',
      '.cw-cc-btn:hover{border-color:#2d3140;background:#191c27;}',
      '.cw-cc-btn-accept{background:#14d38a;border-color:#14d38a;color:#04140d;}',
      '.cw-cc-btn-accept:hover{background:#0f9c67;border-color:#0f9c67;}',
      '@media (max-width:640px){.cw-cc-inner{flex-direction:column;align-items:stretch;}',
      '.cw-cc-actions{justify-content:stretch;}.cw-cc-btn{flex:1;text-align:center;}}',
    ].join('');
    document.head.appendChild(style);
  }

  function showBanner() {
    injectStyles();

    var banner = document.createElement('div');
    banner.className = 'cw-cc-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');

    banner.innerHTML =
      '<div class="cw-cc-inner">' +
        '<p class="cw-cc-text">' +
          'CryptoBolt uses Google Analytics and Google AdSense, which set cookies to measure ' +
          'traffic and show ads. You can accept or reject these — the site itself works the ' +
          'same either way. See the <a href="privacy.html">Privacy Policy</a> for details.' +
        '</p>' +
        '<div class="cw-cc-actions">' +
          '<button type="button" class="cw-cc-btn cw-cc-btn-reject">Reject</button>' +
          '<button type="button" class="cw-cc-btn cw-cc-btn-accept">Accept</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(banner);

    // Force a reflow before adding the visible class so the slide-up transition runs.
    void banner.offsetHeight;
    requestAnimationFrame(function () {
      banner.classList.add('cw-cc-visible');
    });

    function dismiss(status) {
      storeConsent(status);
      applyConsent(status);
      banner.classList.remove('cw-cc-visible');
      setTimeout(function () {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 400);
    }

    banner.querySelector('.cw-cc-btn-accept').addEventListener('click', function () {
      dismiss('granted');
    });
    banner.querySelector('.cw-cc-btn-reject').addEventListener('click', function () {
      dismiss('denied');
    });
  }

  function init() {
    var stored = getStoredConsent();

    if (stored) {
      // Returning visitor with a saved choice — re-apply it (Consent Mode's default is
      // "denied" fresh on every page load until this runs).
      applyConsent(stored);
      return;
    }

    showBanner();
  }

  // Exposed so a "Cookie preferences" link (e.g. in the footer) can let a visitor change
  // their mind later without clearing localStorage manually.
  window.cwOpenCookiePreferences = function () {
    var existing = document.querySelector('.cw-cc-banner');
    if (existing) return;
    showBanner();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();