import test from 'node:test';
import assert from 'node:assert/strict';
import { extractWebResearch, buildProvenance } from '../src/routes/ai.js';

test('extractWebResearch reads queries and https pages from executed_tools', () => {
  const r = extractWebResearch({
    executed_tools: [
      {
        type: 'search',
        arguments: JSON.stringify({ query: 'Solana SOL news' }),
        search_results: {
          results: [
            { title: 'Solana update', url: 'https://example.com/a' },
            { title: 'Bad scheme', url: 'javascript:alert(1)' },
            { title: 'Plain http', url: 'http://example.com/b' },
            { title: 'Dup', url: 'https://example.com/a' },
          ],
        },
      },
    ],
  });
  assert.equal(r.used, true);
  assert.deepEqual(r.queries, ['Solana SOL news']);
  assert.deepEqual(r.pages, [{ title: 'Solana update', url: 'https://example.com/a' }]);
});

test('extractWebResearch is safe on missing or malformed data', () => {
  assert.deepEqual(extractWebResearch(undefined), { used: false, queries: [], pages: [] });
  assert.deepEqual(extractWebResearch({ executed_tools: 'nope' }), { used: false, queries: [], pages: [] });
  const r = extractWebResearch({ executed_tools: [{ arguments: '{not json' }, null] });
  assert.equal(r.used, true);
  assert.deepEqual(r.queries, []);
});

test('buildProvenance reports web research only when requested', () => {
  const none = buildProvenance({ kind: 'chat', inputs: {}, newsItems: [], fearGreed: null });
  assert.equal('webResearch' in none, false);
  const on = buildProvenance({
    kind: 'chat', inputs: {}, newsItems: [], fearGreed: null,
    webResearch: { used: true, queries: ['a'], pages: [{}, {}] },
  });
  assert.deepEqual(on.webResearch, { requested: true, used: true, queries: 1, pages: 2 });
});