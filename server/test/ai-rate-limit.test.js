import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBearerToken, houseKeyRateLimitKey } from '../src/routes/ai.js';

// ---------------------------------------------------------------------------
// extractBearerToken — pure header parsing
// ---------------------------------------------------------------------------

test('extractBearerToken pulls the token out of a well-formed header', () => {
  assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
});

test('extractBearerToken trims incidental whitespace after the token', () => {
  assert.equal(extractBearerToken('Bearer abc.def.ghi   '), 'abc.def.ghi');
});

test('extractBearerToken returns empty string for a missing header', () => {
  assert.equal(extractBearerToken(undefined), '');
  assert.equal(extractBearerToken(null), '');
});

test('extractBearerToken returns empty string for a non-Bearer scheme', () => {
  assert.equal(extractBearerToken('Basic dXNlcjpwYXNz'), '');
});

test('extractBearerToken returns empty string for a bare "Bearer" with no token', () => {
  assert.equal(extractBearerToken('Bearer '), '');
  assert.equal(extractBearerToken('Bearer'), '');
});

// ---------------------------------------------------------------------------
// houseKeyRateLimitKey — falls back to IP when there's no way to verify an account.
// SUPABASE_ADMIN_CONFIGURED is false in the test environment (no SUPABASE_URL/
// SUPABASE_API_KEY set), which is itself the most common real deployment case for
// anonymous visitors — this exercises exactly that fallback path without needing to
// mock a live Supabase call.
// ---------------------------------------------------------------------------

function fakeReq({ authorization, ip } = {}) {
  return {
    ip: ip || '203.0.113.5',
    get: (name) => (name.toLowerCase() === 'authorization' ? authorization : undefined),
  };
}

test('houseKeyRateLimitKey falls back to an IP-based key with no Authorization header', async () => {
  const key = await houseKeyRateLimitKey(fakeReq({ ip: '203.0.113.5' }));
  assert.equal(key, 'ip:203.0.113.5');
});

test('houseKeyRateLimitKey falls back to an IP-based key when Supabase admin is not configured, even with a bearer token', async () => {
  const key = await houseKeyRateLimitKey(fakeReq({ authorization: 'Bearer some.jwt.token', ip: '198.51.100.9' }));
  assert.equal(key, 'ip:198.51.100.9');
});

test('houseKeyRateLimitKey two different IPs never collide', async () => {
  const keyA = await houseKeyRateLimitKey(fakeReq({ ip: '203.0.113.5' }));
  const keyB = await houseKeyRateLimitKey(fakeReq({ ip: '203.0.113.6' }));
  assert.notEqual(keyA, keyB);
});