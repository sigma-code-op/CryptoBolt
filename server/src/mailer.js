// ---------- Contact form mailer ----------
// Sends contact-form submissions over SMTP via nodemailer. Works with any SMTP provider,
// including the mailbox that comes with Hostinger's Business/Unlimited plans
// (smtp.hostinger.com, port 465, SSL) — see server/.env.example for the exact settings.

import nodemailer from 'nodemailer';

let cachedTransporter = null;

function isMailerConfigured() {
  // TEMP DEBUG — remove after diagnosing. Logs only true/false, never the actual secret values.
  console.log('[cryptobolt-server] SMTP env check:', {
    SMTP_HOST: Boolean(process.env.SMTP_HOST),
    SMTP_USER: Boolean(process.env.SMTP_USER),
    SMTP_PASS: Boolean(process.env.SMTP_PASS),
    CONTACT_TO_EMAIL: Boolean(process.env.CONTACT_TO_EMAIL),
  });
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.CONTACT_TO_EMAIL);
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cachedTransporter;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send a contact-form submission. Throws on failure — the caller is responsible for
 * catching and translating that into an HTTP response.
 */
async function sendContactEmail({ name, email, topic, message }) {
  if (!isMailerConfigured()) {
    const err = new Error('Mailer is not configured (missing SMTP_HOST/SMTP_USER/SMTP_PASS/CONTACT_TO_EMAIL env vars).');
    err.code = 'MAILER_NOT_CONFIGURED';
    throw err;
  }
  const transporter = getTransporter();
  const fromAddress = process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"CryptoBolt Contact Form" <${fromAddress}>`,
    to: process.env.CONTACT_TO_EMAIL,
    replyTo: `"${name}" <${email}>`,
    subject: `[CryptoBolt] ${topic} — from ${name}`,
    text: `${message}\n\n—\nFrom: ${name} (${email})\nTopic: ${topic}`,
    html: `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p><hr><p>From: ${escapeHtml(name)} (${escapeHtml(email)})<br>Topic: ${escapeHtml(topic)}</p>`,
  });
}

/**
 * Fallback delivery for a triggered price alert when Web Push couldn't reach the visitor's
 * device this cycle (see lib/alert-checker.js). Throws on failure, same contract as
 * sendContactEmail — the caller decides how to log/ignore it.
 */
async function sendAlertEmail({ to, messages }) {
  if (!isMailerConfigured()) {
    const err = new Error('Mailer is not configured (missing SMTP_HOST/SMTP_USER/SMTP_PASS/CONTACT_TO_EMAIL env vars).');
    err.code = 'MAILER_NOT_CONFIGURED';
    throw err;
  }
  const transporter = getTransporter();
  const fromAddress = process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER;
  const subject = messages.length === 1 ? `[CryptoBolt] Price alert: ${messages[0]}` : `[CryptoBolt] ${messages.length} price alerts triggered`;
  const listHtml = messages.map((m) => `<li>${escapeHtml(m)}</li>`).join('');

  await transporter.sendMail({
    from: `"CryptoBolt Alerts" <${fromAddress}>`,
    to,
    subject,
    text: messages.join('\n'),
    html: `<p>Your CryptoBolt price alert${messages.length > 1 ? 's' : ''} triggered:</p><ul>${listHtml}</ul><p style="color:#888;font-size:12px">You're getting this by email because push notifications couldn't reach a device right now. Manage alerts in the CryptoBolt app.</p>`,
  });
}

export { sendContactEmail, sendAlertEmail, isMailerConfigured };