import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPABASE_ADMIN_CONFIGURED, getSupabaseAdmin } from '../src/lib/supabase-admin.js';

// No SUPABASE_URL/SUPABASE_API_KEY are set in the test environment. Actually creating a
// configured client would mean either real credentials or mocking @supabase/supabase-js
// itself, neither of which is worth it here — the "safe to import with nothing configured,
// doesn't crash" contract is the part of this module worth pinning down (same pattern as
// isMailerConfigured() and PUSH_CONFIGURED elsewhere in this project).

test('SUPABASE_ADMIN_CONFIGURED is false with no Supabase env vars set', () => {
  assert.equal(SUPABASE_ADMIN_CONFIGURED, false);
});

test('getSupabaseAdmin returns null instead of throwing when unconfigured', () => {
  assert.equal(getSupabaseAdmin(), null);
});