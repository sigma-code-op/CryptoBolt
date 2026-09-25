import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// These three functions all go through global fetch(), so each test swaps in its own
// fake fetch, runs the call, and restores the original — no real network traffic, and no
// dependency on the third-party APIs actually being up.
//
// fetchFearGreedIndex/fetchCryptoNews are also backed by the module-level TTL cache added
// in market-data.js. That cache is a singleton for the life of the module, so a test file
// that just did `import { fetchFearGreedIndex } from '../src/lib/market-data.js'` once would
// have every test after the first one silently hit the cache instead of the fake fetch below.
// Each test instead imports a fresh module instance (a unique `?case=` query string gives it
// its own entry in Node's ESM module cache) so every test starts with an empty cache.
let caseCounter = 0;
async function freshModule() {
  caseCounter += 1;
  return import(`../src/lib/market-data.js?case=${caseCounter}`);
}

function withFetch(impl, run) {
  const original = global.fetch;
  global.fetch = impl;
  return run().finally(() => {
    global.fetch = original;
  });
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

// ---------- fetchAllBinancePrices ----------

test('fetchAllBinancePrices maps symbol -> numeric price', async () => {
  await withFetch(
    async () =>
      jsonResponse([
        { symbol: 'BTCUSDT', price: '65000.50' },
        { symbol: 'ETHUSDT', price: '3200.10' },
      ]),
    async () => {
      const { fetchAllBinancePrices } = await freshModule();
      const prices = await fetchAllBinancePrices();
      assert.equal(prices.get('BTCUSDT'), 65000.5);
      assert.equal(prices.get('ETHUSDT'), 3200.1);
    }
  );
});

test('fetchAllBinancePrices skips malformed rows instead of throwing', async () => {
  await withFetch(
    async () =>
      jsonResponse([
        { symbol: 'BTCUSDT', price: '65000' },
        { symbol: null, price: '1' },
        { symbol: 'NOPRICE' },
        {},
      ]),
    async () => {
      const { fetchAllBinancePrices } = await freshModule();
      const prices = await fetchAllBinancePrices();
      assert.equal(prices.size, 1);
      assert.equal(prices.get('BTCUSDT'), 65000);
    }
  );
});

test('fetchAllBinancePrices returns null on a non-ok HTTP response', async () => {
  await withFetch(
    async () => jsonResponse({ msg: 'rate limited' }, { ok: false, status: 429 }),
    async () => {
      const { fetchAllBinancePrices } = await freshModule();
      assert.equal(await fetchAllBinancePrices(), null);
    }
  );
});

test('fetchAllBinancePrices returns null when the body is not an array', async () => {
  await withFetch(
    async () => jsonResponse({ code: -1121, msg: 'Invalid symbol.' }),
    async () => {
      const { fetchAllBinancePrices } = await freshModule();
      assert.equal(await fetchAllBinancePrices(), null);
    }
  );
});

test('fetchAllBinancePrices returns null instead of throwing when fetch itself rejects', async () => {
  await withFetch(
    async () => {
      throw new Error('network down');
    },
    async () => {
      const { fetchAllBinancePrices } = await freshModule();
      assert.equal(await fetchAllBinancePrices(), null);
    }
  );
});

// ---------- fetchFearGreedIndex (also exercises the TTL cache) ----------

test('fetchFearGreedIndex maps the API shape and caches the result', async () => {
  let calls = 0;
  await withFetch(
    async () => {
      calls += 1;
      return jsonResponse({ data: [{ value: '72', value_classification: 'Greed' }] });
    },
    async () => {
      const { fetchFearGreedIndex } = await freshModule();
      const first = await fetchFearGreedIndex();
      assert.deepEqual(first, { value: 72, classification: 'Greed' });

      // Second call within the TTL window must be served from cache, not hit fetch again.
      const second = await fetchFearGreedIndex();
      assert.deepEqual(second, { value: 72, classification: 'Greed' });
      assert.equal(calls, 1, 'expected the second call to be served from cache');
    }
  );
});

test('fetchFearGreedIndex returns null when the API has no data entry', async () => {
  await withFetch(
    async () => jsonResponse({ data: [] }),
    async () => {
      const { fetchFearGreedIndex } = await freshModule();
      assert.equal(await fetchFearGreedIndex(), null);
    }
  );
});

// ---------- fetchCryptoNews ----------

test('fetchCryptoNews returns [] for a blank/unusable asset without calling fetch', async () => {
  let called = false;
  await withFetch(
    async () => {
      called = true;
      return jsonResponse({ Data: [] });
    },
    async () => {
      const { fetchCryptoNews } = await freshModule();
      assert.deepEqual(await fetchCryptoNews(''), []);
      assert.deepEqual(await fetchCryptoNews(undefined), []);
      assert.equal(called, false);
    }
  );
});

test('fetchCryptoNews filters to recent items, shapes fields, and caps at 6', async () => {
  const nowSec = Date.now() / 1000;
  const items = Array.from({ length: 10 }, (_, i) => ({
    title: `Headline ${i}`,
    source_info: { name: `Source ${i}` },
    published_on: nowSec - i * 3600, // 0h, 1h, 2h, ... ago — all within 72h
  }));
  // One item that's too old (>72h) to survive the filter.
  items.push({ title: 'Ancient news', source_info: { name: 'Old' }, published_on: nowSec - 73 * 3600 });

  await withFetch(
    async () => jsonResponse({ Data: items }),
    async () => {
      const { fetchCryptoNews } = await freshModule();
      const news = await fetchCryptoNews('sol'); // lower-case in, upper-case symbol used internally
      assert.equal(news.length, 6, 'should cap at 6 items');
      assert.ok(news.every((n) => n.title !== 'Ancient news'));
      assert.equal(news[0].title, 'Headline 0');
      assert.equal(news[0].source, 'Source 0');
      assert.equal(news[0].hoursAgo, 0);
      assert.equal(news[1].hoursAgo, 1);
    }
  );
});

test('fetchCryptoNews falls back to the general Trading category when the asset has none', async () => {
  const calledUrls = [];
  await withFetch(
    async (url) => {
      calledUrls.push(url);
      if (url.includes('categories=Trading')) {
        return jsonResponse({
          Data: [{ title: 'General market update', source: 'Wire', published_on: Date.now() / 1000 }],
        });
      }
      return jsonResponse({ Data: [] });
    },
    async () => {
      const { fetchCryptoNews } = await freshModule();
      const news = await fetchCryptoNews('SHIBUSDT');
      assert.equal(news.length, 1);
      assert.equal(news[0].title, 'General market update');
      assert.equal(calledUrls.length, 2, 'expected a primary call and a Trading fallback call');
    }
  );
});

test('fetchCryptoNews caches per symbol independently within the TTL window', async () => {
  const callsPerSymbol = { BTC: 0, ETH: 0 };
  await withFetch(
    async (url) => {
      const symbol = /categories=([A-Z0-9]+)&/.exec(url)?.[1];
      if (symbol in callsPerSymbol) callsPerSymbol[symbol] += 1;
      return jsonResponse({
        Data: [{ title: `${symbol} news`, source: 'Wire', published_on: Date.now() / 1000 }],
      });
    },
    async () => {
      const { fetchCryptoNews } = await freshModule();
      await fetchCryptoNews('BTC');
      await fetchCryptoNews('ETH');
      await fetchCryptoNews('BTC'); // should be a cache hit, not a third distinct fetch
      assert.equal(callsPerSymbol.BTC, 1);
      assert.equal(callsPerSymbol.ETH, 1);
    }
  );
});