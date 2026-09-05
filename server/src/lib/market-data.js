// ---------------------------------------------------------------------------
// Live internet research: crypto news + Fear & Greed Index. Extracted
// verbatim from server.js.
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    ms
  );

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();

  } catch {
    return null;

  } finally {
    clearTimeout(timer);
  }
}

// =========================================================
// CRYPTO NEWS
// =========================================================

export async function fetchCryptoNews(asset) {
  const symbol =
    (asset || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 15);

  if (!symbol) {
    return [];
  }

  const primary =
    await fetchWithTimeout(
      `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${encodeURIComponent(symbol)}&sortOrder=latest`,
      4500
    );

  let items =
    Array.isArray(primary?.Data)
      ? primary.Data
      : [];

  // Fallback to general trading news.
  if (items.length === 0) {

    const fallback =
      await fetchWithTimeout(
        'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=Trading&sortOrder=latest',
        4500
      );

    items =
      Array.isArray(fallback?.Data)
        ? fallback.Data
        : [];
  }

  const nowSec =
    Date.now() / 1000;

  return items
    .filter(
      (item) =>
        item?.title &&
        item?.published_on &&
        nowSec - item.published_on <
          60 * 60 * 72
    )
    .slice(0, 6)
    .map((item) => ({
      title: String(
        item.title
      ).slice(0, 180),

      source: String(
        item.source_info?.name ||
        item.source ||
        'Unknown'
      ).slice(0, 40),

      hoursAgo: Math.max(
        0,
        Math.round(
          (nowSec - item.published_on) /
            3600
        )
      ),
    }));
}

// =========================================================
// LIVE BINANCE PRICES (all symbols in one call)
// =========================================================
// Shared by lib/alert-checker.js (price alerts) and lib/ai-call-tracker.js
// (resolving logged AI trade setups) — both need "every symbol's current
// price" on a timer, so this lives here once instead of twice.

export async function fetchAllBinancePrices() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price', {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    const map = new Map();
    for (const row of rows) {
      if (row?.symbol && row?.price) map.set(row.symbol, Number(row.price));
    }
    return map;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// =========================================================
// FEAR & GREED
// =========================================================

export async function fetchFearGreedIndex() {
  const data =
    await fetchWithTimeout(
      'https://api.alternative.me/fng/?limit=1',
      3500
    );

  const entry =
    data?.data?.[0];

  if (!entry) {
    return null;
  }

  return {
    value: Number(entry.value),
    classification:
      String(
        entry.value_classification || ''
      ),
  };
}