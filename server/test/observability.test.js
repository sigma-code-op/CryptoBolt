import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/server.js';

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('every response carries an X-Request-Id header', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  const requestId = res.headers.get('x-request-id');
  assert.ok(requestId, 'expected an X-Request-Id response header');
  // crypto.randomUUID() shape — loose check, just confirms it's not an empty/placeholder value.
  assert.match(requestId, /^[0-9a-f-]{36}$/i);
});

test('two different requests get two different request ids', async () => {
  const [a, b] = await Promise.all([
    fetch(`${baseUrl}/api/health`),
    fetch(`${baseUrl}/api/health`),
  ]);
  assert.notEqual(a.headers.get('x-request-id'), b.headers.get('x-request-id'));
});

test('POST /api/client-error accepts a well-formed report and returns 204', async () => {
  const res = await fetch(`${baseUrl}/api/client-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'TypeError: cannot read property of undefined',
      stack: 'TypeError: ...\n  at foo (app.js:1:1)',
      url: 'https://example.com/app.html',
    }),
  });
  assert.equal(res.status, 204);
});

test('POST /api/client-error tolerates a missing/empty body without crashing', async () => {
  const res = await fetch(`${baseUrl}/api/client-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 204);
});

test('POST /api/client-error is rate-limited per IP', async () => {
  const requests = Array.from({ length: 35 }, () =>
    fetch(`${baseUrl}/api/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'spam test' }),
    })
  );
  const results = await Promise.all(requests);
  const tooManyCount = results.filter((r) => r.status === 429).length;
  assert.ok(tooManyCount > 0, 'expected at least one 429 after exceeding the per-minute cap');
});

test('GET /api/telegram/configured reports false when TELEGRAM_BOT_TOKEN is unset', async () => {
  // This test suite never sets TELEGRAM_BOT_TOKEN, so the route should reflect that honestly
  // rather than defaulting to true (which would make account.html show a feature that can't
  // actually deliver anything).
  const res = await fetch(`${baseUrl}/api/telegram/configured`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.configured, false);
});