import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  redactSecrets,
  redactMeta,
  classifyAiError,
  aiErrorBody,
  AI_ERROR_CODES,
} from '../src/lib/ai-errors.js';
import { buildProvenance, isUsableInsight } from '../src/routes/ai.js';

// ---------- redaction: API keys must never reach a log line ----------

test('redactSecrets strips Groq keys from free text', () => {
  const out = redactSecrets('Incorrect API key provided: gsk_AbCdEf1234567890XyZ. Check it.');
  assert.ok(!out.includes('gsk_AbCdEf'));
  assert.ok(out.includes('[redacted-key]'));
});

test('redactSecrets strips bearer tokens and x-groq-key header dumps', () => {
  assert.ok(!redactSecrets('Authorization: Bearer abc.def.ghi-12345678').includes('abc.def'));
  assert.ok(!redactSecrets('{"x-groq-key":"gsk_supersecretvalue1"}').includes('supersecret'));
});

test('redactSecrets leaves ordinary text and non-strings alone', () => {
  assert.equal(redactSecrets('Rate limited by Groq.'), 'Rate limited by Groq.');
  assert.equal(redactSecrets(null), null);
  assert.equal(redactSecrets(undefined), undefined);
});

test('redactMeta redacts nested string values but keeps numbers/booleans', () => {
  const out = redactMeta({
    status: 401,
    ok: false,
    stack: 'Error at gsk_SECRETSECRET123',
    nested: { header: 'Bearer tokentokentoken123' },
  });
  assert.equal(out.status, 401);
  assert.equal(out.ok, false);
  assert.ok(!out.stack.includes('SECRETSECRET'));
  assert.ok(!out.nested.header.includes('tokentoken'));
});

test('the structured logger never writes a key to stdout/stderr', async () => {
  const { logError, logInfo } = await import('../src/lib/logger.js');
  const lines = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (l) => lines.push(l);
  console.error = (l) => lines.push(l);
  try {
    logError('upstream failed', new Error('401 Invalid key gsk_LEAKYLEAKYLEAKY99'), {
      detail: 'x-groq-key: gsk_ANOTHERSECRET12345',
    });
    logInfo('note gsk_THIRDSECRETVALUE88');
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  const joined = lines.join('\n');
  assert.ok(!/gsk_[A-Za-z0-9]{6,}/.test(joined), joined);
  assert.ok(joined.includes('redacted'));
});

// ---------- classification ----------

test('classifyAiError: 401/403 -> invalid_key, not retryable', () => {
  for (const status of [401, 403]) {
    const c = classifyAiError({ status, message: 'bad key gsk_leakleakleak1' });
    assert.equal(c.status, 401);
    assert.equal(c.code, AI_ERROR_CODES.INVALID_KEY);
    assert.equal(c.retryable, false);
    assert.ok(!c.error.includes('gsk_'), 'upstream text must never be forwarded');
  }
});

test('classifyAiError: 429 -> rate_limited, retryable, honors Retry-After', () => {
  const c = classifyAiError({ status: 429, headers: { 'retry-after': '17' } });
  assert.equal(c.status, 429);
  assert.equal(c.code, AI_ERROR_CODES.RATE_LIMITED);
  assert.equal(c.retryable, true);
  assert.equal(c.retryAfterSeconds, 17);
});

test('classifyAiError: 429 reads Retry-After from a Headers-like object too', () => {
  const headers = new Headers({ 'retry-after': '5' });
  assert.equal(classifyAiError({ status: 429, headers }).retryAfterSeconds, 5);
});

test('classifyAiError: 429 without Retry-After omits retryAfterSeconds', () => {
  assert.ok(!('retryAfterSeconds' in classifyAiError({ status: 429 })));
});

test('classifyAiError: 404 -> model_unavailable and names the model', () => {
  const c = classifyAiError({ status: 404 }, { model: 'some/model' });
  assert.equal(c.code, AI_ERROR_CODES.MODEL_UNAVAILABLE);
  assert.equal(c.retryable, false);
  assert.ok(c.error.includes('some/model'));
});

test('classifyAiError: network errors and 5xx -> upstream_unavailable, retryable', () => {
  const cases = [
    { name: 'APIConnectionError', message: 'Connection error.' },
    { name: 'APIConnectionTimeoutError', message: 'Request timed out.' },
    { status: 503 },
    { status: 500 },
    { message: 'fetch failed' },
  ];
  for (const err of cases) {
    const c = classifyAiError(err);
    assert.equal(c.code, AI_ERROR_CODES.UPSTREAM_UNAVAILABLE, JSON.stringify(err));
    assert.equal(c.status, 503);
    assert.equal(c.retryable, true);
  }
});

test('classifyAiError: unknown errors fall back to a generic retryable failure', () => {
  const c = classifyAiError(new Error('something odd'));
  assert.equal(c.code, AI_ERROR_CODES.INTERNAL);
  assert.equal(c.retryable, true);
});

test('aiErrorBody drops the HTTP status but keeps code/retryable', () => {
  const body = aiErrorBody(classifyAiError({ status: 429 }));
  assert.ok(!('status' in body));
  assert.equal(body.code, 'rate_limited');
  assert.equal(body.retryable, true);
});

// ---------- malformed-response detection ----------

test('isUsableInsight accepts a minimal valid read', () => {
  assert.equal(isUsableInsight({ trend: 'bullish', summary: 'Price is above MA(25).' }), true);
});

test('isUsableInsight rejects arrays, scalars, and objects missing summary/trend', () => {
  assert.equal(isUsableInsight(null), false);
  assert.equal(isUsableInsight([]), false);
  assert.equal(isUsableInsight('text'), false);
  assert.equal(isUsableInsight({ trend: 'bullish' }), false);
  assert.equal(isUsableInsight({ summary: 'x' }), false);
  assert.equal(isUsableInsight({ trend: 'bullish', summary: '   ' }), false);
});

// ---------- provenance ----------

test('buildProvenance lists present input names (not values) and interpretation fields', () => {
  const p = buildProvenance({
    kind: 'insight',
    inputs: { price: 123, ma7: null, rsi14: 55, 'bad key!': 1, atr14: undefined },
    newsItems: [{}, {}],
    fearGreed: { value: 50 },
    passes: 2,
    researchNotes: 'notes',
    parsed: { trend: 'neutral', summary: 's', outlook: null },
  });
  assert.equal(p.kind, 'insight');
  assert.deepEqual(p.inputs, ['price', 'rsi14']);
  assert.equal(p.headlinesProvided, 2);
  assert.equal(p.fearGreedProvided, true);
  assert.equal(p.researchNotesProvided, true);
  assert.deepEqual(p.interpretationFields, ['trend', 'summary']);
  assert.ok(!Number.isNaN(Date.parse(p.generatedAt)));
  assert.ok(typeof p.model === 'string' && p.model.length > 0);
});

test('buildProvenance for chat flags paper-trade usage and omits insight-only fields', () => {
  const p = buildProvenance({ kind: 'chat', inputs: { asset: 'BTC' }, newsItems: [], fearGreed: null, usedPaperTrades: true });
  assert.equal(p.paperTradesProvided, true);
  assert.equal(p.fearGreedProvided, false);
  assert.ok(!('interpretationFields' in p));
  assert.ok(!('passes' in p));
});