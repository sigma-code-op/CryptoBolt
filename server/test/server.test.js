import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { app } from '../src/server.js';

// Boots the real app on a random free port (0) for the duration of these tests, and closes
// it afterwards — importing server.js does NOT auto-start a listener (see the isMainModule
// guard in server.js), so this is the only thing binding a port during the test run.
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

test('GET /api/health returns ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, 'cryptobolt-server');
  assert.equal(typeof body.mailerConfigured, 'boolean');
});

test('GET /api/health reports a currently-supported Groq model, not a retired one', async () => {
  // Regression guard: server.js's GROQ_MODEL default previously pointed at
  // llama-3.3-70b-versatile, which Groq retires 2026-08-16. This fails loudly if that default
  // ever regresses, instead of the AI Insight panel just silently breaking in production.
  const res = await fetch(`${baseUrl}/api/health`);
  const body = await res.json();
  assert.ok(body.model, 'health response should include the active model name');
  assert.notEqual(body.model, 'llama-3.3-70b-versatile');
  assert.notEqual(body.model, 'llama-3.1-8b-instant');
});

test('responses include helmet security headers', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  // A couple of representative helmet defaults — not exhaustive, just confirms helmet() is
  // actually wired up ahead of the route handlers.
  assert.ok(res.headers.get('x-content-type-options'));
  assert.ok(res.headers.get('x-dns-prefetch-control') !== null || res.headers.get('x-frame-options') !== null);
});

test('POST /api/ai-insight without a Groq key is rejected', async () => {
  const res = await fetch(`${baseUrl}/api/ai-insight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: {} }),
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error, /Groq API key/);
});

test('POST /api/ai-insight with a key but an invalid context is rejected before calling Groq', async () => {
  const res = await fetch(`${baseUrl}/api/ai-insight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-groq-key': 'gsk_test_placeholder' },
    body: JSON.stringify({ context: { asset: 'BTCUSDT' } }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /Invalid field/);
});

test('POST /api/contact rejects an incomplete submission with 400', async () => {
  const res = await fetch(`${baseUrl}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', email: '', topic: '', message: '' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test('POST /api/contact rejects a honeypot-filled submission with 400', async () => {
  const res = await fetch(`${baseUrl}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bot',
      email: 'bot@example.com',
      topic: 'Bug report',
      message: 'Hello world, this is a spam message.',
      company: 'Definitely not a bot LLC',
    }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/contact with a valid submission returns 503 when SMTP is not configured in this test env', async () => {
  // In CI/test environments SMTP_* env vars are intentionally unset, so this exercises the
  // "not configured yet" path rather than actually sending an email over the network.
  const res = await fetch(`${baseUrl}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Jane Trader',
      email: 'jane@example.com',
      topic: 'Bug report',
      message: 'The order book stopped updating on BTCUSDT futures.',
      company: '',
    }),
  });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.match(body.error, /isn't set up/i);
});

test('unknown routes return 404', async () => {
  const res = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(res.status, 404);
});

test('server refuses to start in production with ALLOWED_ORIGINS unset (fails closed, not open)', () => {
  // Regression guard for the CORS fail-open bug: NODE_ENV=production with no ALLOWED_ORIGINS
  // used to silently allow every origin. It must now refuse to boot instead. Run as a child
  // process — config.js calls process.exit(1) at import time in this case, which would
  // otherwise kill the whole test runner rather than just this one test.
  const result = spawnSync(
    process.execPath,
    ['src/server.js'],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...process.env, NODE_ENV: 'production', ALLOWED_ORIGINS: '', PORT: '0' },
      encoding: 'utf8',
      timeout: 5000,
    }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ALLOWED_ORIGINS is empty in production/);
});

test('server starts fine in production once ALLOWED_ORIGINS is set', () => {
  const result = spawnSync(
    process.execPath,
    ['-e', "import('./src/server.js').then(() => process.exit(0))"],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://cryptobolt.io',
        PORT: '0',
      },
      encoding: 'utf8',
      timeout: 5000,
    }
  );
  assert.equal(result.status, 0, result.stderr);
});