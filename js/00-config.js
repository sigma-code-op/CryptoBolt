// ---------- CryptoBolt: runtime configuration ----------
// Set apiBaseUrl to your deployed backend (see /server). Leave it '' to call a same-origin
// path like /api/ai-insight (e.g. if you deploy the backend behind the same domain/reverse proxy
// as this frontend). If aiInsightUrl is falsy, the AI panel silently uses the local, rule-based
// fallback instead of calling any backend.
const CW_CONFIG = {
    apiBaseUrl: 'https://api.cryptobolt.io',            // e.g. 'https://cryptobolt-api.yourhost.com'
    aiInsightUrl: '/api/ai-insight',

    // ---------- Transak (Buy/Sell Crypto widget) ----------
    // Transak now requires the widget URL to be minted server-side per request (their old
    // client-side "params in the URL" method is deprecated and gets a hard 403). So there's
    // nothing to configure here anymore — the Buy/Sell modal calls this app's own backend
    // (apiBaseUrl + POST /api/transak-widget-url), and the real Transak API key + secret live
    // ONLY in server/.env (TRANSAK_API_KEY, TRANSAK_API_SECRET, TRANSAK_ENVIRONMENT,
    // TRANSAK_REFERRER_DOMAIN). See server/.env.example for setup.

    // ---------- Supabase (accounts + real purchase history) ----------
    // Create a free project at https://supabase.com, then Project Settings -> API to get these.
    // supabaseAnonKey is the PUBLIC "anon" key — it's meant to be exposed in frontend code and is
    // safe to commit; it only works within the Row Level Security policies defined in the database
    // (see /supabase/schema.sql). NEVER put the "service_role" key here or anywhere in frontend code.
    supabaseUrl: 'https://xdfkumkkfskdmlemelso.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZmt1bWtrZnNrZG1sZW1lbHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTkxODMsImV4cCI6MjEwMjA5NTE4M30.Lv0pj2Xb3b0aCtg6ByvURuBblWpxSWgUm9tWA6HGLUA'
};