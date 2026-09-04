// ---------------------------------------------------------------------------
// CryptoBolt service worker — closed-tab price alerts only.
//
// This does NOT do offline caching / "add to home screen" style asset
// precaching on purpose: CryptoBolt is a live-data dashboard (prices,
// charts, AI insight), so serving a stale cached copy while offline would
// be actively misleading. Its only job is to receive a Web Push event from
// the server (server/src/lib/alert-checker.js, via server/src/lib/push.js)
// and show a system notification, which works even when every CryptoBolt
// tab is closed.
//
// Registered from js/23-push-alerts.js with `navigator.serviceWorker.register('/sw.js')`.
// Must live at the site root (not under /js/) so its default scope covers the whole origin.
// ---------------------------------------------------------------------------

self.addEventListener('install', () => {
  // Activate immediately rather than waiting for all existing tabs to close — there's no
  // cached-asset versioning here to worry about invalidating.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'CryptoBolt Alert', body: 'A price alert triggered.', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload (shouldn't happen — push.js always sends JSON) — fall back to defaults.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/apple-touch-icon.png',
      badge: '/assets/favicon-48.png',
      data: { url: data.url || '/' },
      tag: 'cryptobolt-price-alert',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = allClients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(targetUrl);
      } else {
        self.clients.openWindow(targetUrl);
      }
    })()
  );
});