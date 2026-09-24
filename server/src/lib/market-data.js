// ---------------------------------------------------------------------------
// Live internet research: crypto news + Fear & Greed Index. Extracted
// verbatim from server.js.
//
// PERF: both of these are called on every single /api/ai-chat, /api/ai-insight, and
// /api/alert-explain request (see routes/ai.js), and both sources are slow-moving —
// the Fear & Greed Index only updates once a day, and a given asset's news list barely
// changes minute to minute. Without a cache, every request pays the full network
// round-trip (up to 4.5s/3.5s of timeout budget) to a third party for data that's
// almost always identical to what the previous request already fetched, which also
// means every extra concurrent user adds load to cryptocompare/alternative.me in
// lockstep rather than sharing one fetch. A tiny in-memory TTL cache fixes both: cache
// hits return instantly, and only one request per TTL window per key ever reaches the
// upstream API. Fine to keep in-process (not Redis/etc.) since a cold cache after a
// deploy just costs one extra fetch, not incorrect data.
// ---------------------------------------------------------------------------

const FEAR_GREED_TTL_MS = 10 * 60 * 1000; // index is published once/day — 10 min is generous
const NEWS_TTL_MS = 3 * 60 * 1000; // short enough that breaking news still shows up quickly

function makeTtlCache(ttlMs) {
  const store = new Map(); // key -> { value, expiresAt, inflight }

  return {
    async get(key, fetcher) {
      const now = Date.now();
      const entry = store.get(key);

      if (entry && entry.expiresAt > now) {
        return entry.value;
      }

      // Coalesce concurrent misses for the same key (e.g. a burst of chat messages
      // for the same asset) into a single upstream request instead of one each.
      if (entry && entry.inflight) {
        return entry.inflight;
      }

      const inflight = fetcher()
        .then((value) => {
          store.set(key, { value, expiresAt: Date.now() + ttlMs, inflight: null });
          return value;
        })
        .catch((err) => {
          store.delete(key);
          throw err;
        });

      store.set(key, { value: entry?.value, expiresAt: entry?.expiresAt || 0, inflight });
      return inflight;
    },
  };
}

const fearGreedCache = makeTtlCache(FEAR_GREED_TTL_MS);
const newsCache = makeTtlCache(NEWS_TTL_MS);

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

  return newsCache.get(symbol, () => fetchCryptoNewsUncached(symbol));
}

async function fetchCryptoNewsUncached(symbol) {
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
// Used by lib/alert-checker.js (price alerts), which needs "every symbol's
// current price" on a timer.

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
  return fearGreedCache.get('fng', fetchFearGreedIndexUncached);
}

async function fetchFearGreedIndexUncached() {
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