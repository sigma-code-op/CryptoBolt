import test from 'node:test';
import assert from 'node:assert/strict';

// telegram.js reads TELEGRAM_BOT_TOKEN into a module-level constant at import time, so it
// has to be set *before* the first import. This file gets its own subprocess under
// `node --test` (confirmed: each matched test file runs in an isolated process), so setting
// it here doesn't leak into any other test file's environment.
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
const { sendTelegramMessage, TELEGRAM_CONFIGURED } = await import('../src/lib/telegram.js');

function withFetch(impl, run) {
  const original = global.fetch;
  global.fetch = impl;
  return run().finally(() => {
    global.fetch = original;
  });
}

test('TELEGRAM_CONFIGURED is true once TELEGRAM_BOT_TOKEN is set', () => {
  assert.equal(TELEGRAM_CONFIGURED, true);
});

test('sendTelegramMessage returns ok:true on a successful send', async () => {
  await withFetch(
    async () => ({ ok: true, status: 200 }),
    async () => {
      const result = await sendTelegramMessage('12345', 'BTC rose above $65000');
      assert.deepEqual(result, { ok: true });
    }
  );
});

test('sendTelegramMessage flags a 403 (bot blocked) as invalid, not merely transient', async () => {
  await withFetch(
    async () => ({ ok: false, status: 403, text: async () => 'Forbidden: bot was blocked by the user' }),
    async () => {
      const result = await sendTelegramMessage('12345', 'hi');
      assert.deepEqual(result, { ok: false, invalid: true });
    }
  );
});

test('sendTelegramMessage flags a 400 (bad chat id) as invalid', async () => {
  await withFetch(
    async () => ({ ok: false, status: 400, text: async () => 'Bad Request: chat not found' }),
    async () => {
      const result = await sendTelegramMessage('not-a-real-chat-id', 'hi');
      assert.deepEqual(result, { ok: false, invalid: true });
    }
  );
});

test('sendTelegramMessage treats a 500 as transient (invalid: false), not a dead chat id', async () => {
  await withFetch(
    async () => ({ ok: false, status: 500, text: async () => 'Internal Server Error' }),
    async () => {
      const result = await sendTelegramMessage('12345', 'hi');
      assert.deepEqual(result, { ok: false, invalid: false });
    }
  );
});

test('sendTelegramMessage returns ok:false, invalid:false instead of throwing when fetch rejects', async () => {
  await withFetch(
    async () => {
      throw new Error('network down');
    },
    async () => {
      const result = await sendTelegramMessage('12345', 'hi');
      assert.deepEqual(result, { ok: false, invalid: false });
    }
  );
});

test('sendTelegramMessage no-ops without a chat id, even when configured', async () => {
  let called = false;
  await withFetch(
    async () => {
      called = true;
      return { ok: true, status: 200 };
    },
    async () => {
      const result = await sendTelegramMessage(null, 'hi');
      assert.deepEqual(result, { ok: false, invalid: false });
      assert.equal(called, false);
    }
  );
});