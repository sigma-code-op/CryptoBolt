// ---------------------------------------------------------------------------
// One-off Supabase connection smoke test for the server side of CryptoBolt.
//
// server/package.json has "type": "module", so this uses import/export
// (ESM) instead of require()/module.exports — same style as the rest of
// server/src/. Run it with:
//   node db.js
// from inside server/, after `npm install` and after setting SUPABASE_URL
// and SUPABASE_API_KEY in server/.env (see server/.env.example).
//
// SUPABASE_API_KEY here should be the SERVICE ROLE key, not the public
// anon key already used client-side in js/00-config.js — this script only
// ever runs on the server, so it's safe to use the privileged key, and it
// must never be copied into any frontend file.
// ---------------------------------------------------------------------------

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

// Test the connection against leaderboard_stats — a real table from this
// project's schema (see supabase/schema.sql) with an open "anyone can
// select" policy, so this smoke test works regardless of which key you use.
supabase
  .from('leaderboard_stats')
  .select('*')
  .limit(1)
  .then(({ data, error }) => {
    if (error) console.error('Connection error:', error);
    else console.log('Connected:', data);
  });

export default supabase;