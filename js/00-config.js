// ---------- CryptoBolt: runtime configuration ----------
// Set apiBaseUrl to your deployed backend (see /server). Leave it '' to call a same-origin
// path like /api/ai-insight (e.g. if you deploy the backend behind the same domain/reverse proxy
// as this frontend). If aiInsightUrl is falsy, the AI panel silently uses the local, rule-based
// fallback instead of calling any backend.
const CW_CONFIG = {
    apiBaseUrl: 'https://api.cryptobolt.io',            // e.g. 'https://cryptobolt-api.yourhost.com'
    aiInsightUrl: '/api/ai-insight',

    // ---------- Buy/Sell Crypto ----------
    // Nothing to configure here — the Buy/Sell buttons (js/14-buy-sell-redirect.js) just open Binance
    // in a new tab with the selected asset. No backend call, no API keys.

    // ---------- Supabase (accounts + real purchase history) ----------
    // Create a free project at https://supabase.com, then Project Settings -> API to get these.
    // supabaseAnonKey is the PUBLIC "anon" key — it's meant to be exposed in frontend code and is
    // safe to commit; it only works within the Row Level Security policies defined in the database
    // (see /supabase/schema.sql). NEVER put the "service_role" key here or anywhere in frontend code.
    supabaseUrl: 'https://xdfkumkkfskdmlemelso.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZmt1bWtrZnNrZG1sZW1lbHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTkxODMsImV4cCI6MjEwMjA5NTE4M30.Lv0pj2Xb3b0aCtg6ByvURuBblWpxSWgUm9tWA6HGLUA'
};