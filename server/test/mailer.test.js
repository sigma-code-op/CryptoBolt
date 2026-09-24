import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeHeaderValue,
  escapeHtml,
  isMailerConfigured,
  sendContactEmail,
  sendAlertEmail,
} from '../src/mailer.js';

// ---------------------------------------------------------------------------
// sanitizeHeaderValue — the CRLF-header-injection defense described in mailer.js's own
// comment. If a visitor's contact-form name/topic/email ever reaches sendMail() with a
// literal \r\n still in it, they could inject extra email headers (e.g. an extra Bcc). This
// is the single most security-relevant function in this file, and previously had no test.
// ---------------------------------------------------------------------------

test('sanitizeHeaderValue strips CRLF sequences', () => {
  assert.equal(sanitizeHeaderValue('Jane\r\nBcc: attacker@evil.com'), 'JaneBcc: attacker@evil.com');
  assert.equal(sanitizeHeaderValue('line1\nline2'), 'line1line2');
  assert.equal(sanitizeHeaderValue('line1\rline2'), 'line1line2');
});

test('sanitizeHeaderValue strips other control characters (e.g. NUL)', () => {
  assert.equal(sanitizeHeaderValue('Jane\x00Doe'), 'JaneDoe');
});

test('sanitizeHeaderValue trims surrounding whitespace and leaves normal text untouched', () => {
  assert.equal(sanitizeHeaderValue('  Jane Doe  '), 'Jane Doe');
  assert.equal(sanitizeHeaderValue('Question about pricing'), 'Question about pricing');
});

test('sanitizeHeaderValue coerces non-string input instead of throwing', () => {
  assert.equal(sanitizeHeaderValue(12345), '12345');
});

// ---------- escapeHtml ----------

test('escapeHtml escapes all five HTML-significant characters', () => {
  assert.equal(escapeHtml(`<script>alert("hi") & 'bye'</script>`), '&lt;script&gt;alert(&quot;hi&quot;) &amp; &#39;bye&#39;&lt;/script&gt;');
});

test('escapeHtml leaves plain text unchanged', () => {
  assert.equal(escapeHtml('just a normal message'), 'just a normal message');
});

// ---------- isMailerConfigured ----------
// No SMTP_HOST/SMTP_USER/SMTP_PASS/CONTACT_TO_EMAIL are set in the test environment.

test('isMailerConfigured is false when SMTP env vars are unset', () => {
  assert.equal(isMailerConfigured(), false);
});

// ---------- sendContactEmail / sendAlertEmail when unconfigured ----------
// Both bail out before touching nodemailer/the network when unconfigured, so these are
// deterministic and don't need a real (or mocked) SMTP server.

test('sendContactEmail throws a MAILER_NOT_CONFIGURED error when SMTP is not set up', async () => {
  await assert.rejects(
    () => sendContactEmail({ name: 'Jane', email: 'jane@example.com', topic: 'General', message: 'Hi' }),
    (err) => err.code === 'MAILER_NOT_CONFIGURED'
  );
});

test('sendAlertEmail throws a MAILER_NOT_CONFIGURED error when SMTP is not set up', async () => {
  await assert.rejects(
    () => sendAlertEmail({ to: 'jane@example.com', messages: ['BTC rose above $65000'] }),
    (err) => err.code === 'MAILER_NOT_CONFIGURED'
  );
});