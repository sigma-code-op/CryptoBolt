// ---------------------------------------------------------------------------
// Shared Supabase admin (service-role) client for the server.
//
// This is the same SUPABASE_URL/SUPABASE_API_KEY pair db.js smoke-tests —
// pulled into its own module so routes/push.js and lib/alert-checker.js
// don't each open their own connection. The service-role key bypasses Row
// Level Security entirely, which is *required* here: alert-checker.js has
// to read every signed-in visitor's push_subscriptions and app_state rows
// to know who to notify, not just "whoever is currently logged in" (there
// is no logged-in visitor — this runs on a timer, server-side, with nobody's
// browser open). Never import this file, or SUPABASE_API_KEY, into
// anything that ships to the browser.
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_API_KEY || '';

export const SUPABASE_ADMIN_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// Created lazily (not at import time) so a deployment that hasn't set these env vars yet
// doesn't crash on startup just from importing this module — callers check
// SUPABASE_ADMIN_CONFIGURED first, same pattern as isMailerConfigured() in mailer.js.
let cachedClient = null;

export function getSupabaseAdmin() {
  if (!SUPABASE_ADMIN_CONFIGURED) return null;
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}