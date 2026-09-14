// ---------------------------------------------------------------------------
// Telegram alert delivery — an additional, opt-in channel alongside Web Push.
//
// Unlike push (which needs a browser subscription tied to one device) or the email fallback
// (only sent when push failed), Telegram is something a visitor explicitly opts into by
// linking a chat id in their Account page, so lib/alert-checker.js sends it as its own
// parallel channel whenever a linked chat id exists — regardless of whether push also
// succeeded that cycle. See account.html / js/18-account.js for the linking UI, and
// supabase/schema.sql for the `profiles.telegram_chat_id` column it writes to.
//
// Setup for whoever runs a deployment:
//   1. Message @BotFather on Telegram, run /newbot, and put the token it gives you in
//      TELEGRAM_BOT_TOKEN below (server/.env.example).
//   2. Each visitor gets their own numeric chat id by messaging your bot once and visiting
//      https://api.telegram.org/bot<token>/getUpdates — or, in your bot's chat, sending
//      /start and reading the chat id back from that same endpoint. This project doesn't
//      automate that lookup (it would mean running a Telegram webhook endpoint, a bigger
//      addition than a practice-terminal's alert feature needs) — a visitor pastes the id
//      into their Account page once, same as many self-hosted apps that use Telegram.
// ---------------------------------------------------------------------------

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API_BASE = 'https://api.telegram.org';

export const TELEGRAM_CONFIGURED = Boolean(TELEGRAM_BOT_TOKEN);

/**
 * Sends one plain-text message to one Telegram chat id.
 * Returns { ok: true } on success. Returns { ok: false, invalid: true } when Telegram
 * confirms the chat id is gone/blocked the bot (400/403 — mirrors sendPush()'s `expired`
 * flag) so the caller can clear that visitor's stored chat id instead of retrying forever.
 * Any other failure is { ok: false, invalid: false } (transient — worth trying again).
 */
export async function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_CONFIGURED || !chatId) {
    return { ok: false, invalid: false };
  }
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 400 || res.status === 403) {
      return { ok: false, invalid: true };
    }
    console.error('[cryptobolt-server] telegram: send failed:', res.status, await res.text().catch(() => ''));
    return { ok: false, invalid: false };
  } catch (err) {
    console.error('[cryptobolt-server] telegram: send failed:', err?.message || err);
    return { ok: false, invalid: false };
  }
}