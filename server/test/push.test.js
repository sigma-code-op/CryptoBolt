import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';

// Same reasoning as telegram.test.js: PUSH_CONFIGURED is read into module-level constants at
// import time, and this file gets its own subprocess under `node --test`, so setting fake
// VAPID env vars here is safe and doesn't leak into other test files.
// Structurally-valid but throwaway keypair (web-push validates VAPID key format/length at
// import time via setVapidDetails, so a placeholder string like 'test-key' would make this
// whole file fail to even load) — generated once with webpush.generateVAPIDKeys(), not tied
// to any real deployment.
process.env.PUSH_VAPID_PUBLIC_KEY =
  'BLhrgog157WSHgYpKkdpAyFoKZBK2doUGM4pgUcsSHKBC_oWj3EmQmNx4we_8QJe48Ybgh6DRpKvALL45AKk2OA';
process.env.PUSH_VAPID_PRIVATE_KEY = 'xExwX2ojwAHuRqivaNzlle3kFVeUBPtIVAZ5caNO5AM';
process.env.PUSH_VAPID_SUBJECT = 'mailto:ops@example.com';
const { sendPush, getVapidPublicKey, PUSH_CONFIGURED } = await import('../src/lib/push.js');

const fakeSubscription = { endpoint: 'https://push.example.com/abc', p256dh: 'p256dh-key', auth: 'auth-key' };

function withSendNotification(impl, run) {
  const original = webpush.sendNotification;
  webpush.sendNotification = impl;
  return run().finally(() => {
    webpush.sendNotification = original;
  });
}

test('PUSH_CONFIGURED is true once all three VAPID env vars are set', () => {
  assert.equal(PUSH_CONFIGURED, true);
});

test('getVapidPublicKey returns the configured public key', () => {
  assert.equal(getVapidPublicKey(), process.env.PUSH_VAPID_PUBLIC_KEY);
});

test('sendPush returns ok:true on a successful send', async () => {
  await withSendNotification(
    async () => ({}),
    async () => {
      const result = await sendPush(fakeSubscription, { title: 'CryptoBolt Alert', body: 'BTC rose above $65000' });
      assert.deepEqual(result, { ok: true });
    }
  );
});

test('sendPush flags a 410 Gone as an expired subscription', async () => {
  await withSendNotification(
    async () => {
      const err = new Error('Gone');
      err.statusCode = 410;
      throw err;
    },
    async () => {
      const result = await sendPush(fakeSubscription, { title: 'x', body: 'y' });
      assert.deepEqual(result, { ok: false, expired: true });
    }
  );
});

test('sendPush flags a 404 Not Found as an expired subscription', async () => {
  await withSendNotification(
    async () => {
      const err = new Error('Not Found');
      err.statusCode = 404;
      throw err;
    },
    async () => {
      const result = await sendPush(fakeSubscription, { title: 'x', body: 'y' });
      assert.deepEqual(result, { ok: false, expired: true });
    }
  );
});

test('sendPush treats a 500 as transient, not an expired subscription', async () => {
  await withSendNotification(
    async () => {
      const err = new Error('Internal Server Error');
      err.statusCode = 500;
      throw err;
    },
    async () => {
      const result = await sendPush(fakeSubscription, { title: 'x', body: 'y' });
      assert.deepEqual(result, { ok: false, expired: false });
    }
  );
});