// ---------- CryptoBolt: runtime configuration ----------
// Set apiBaseUrl to your deployed backend (see /server). Leave it '' to call a same-origin
// path like /api/ai-insight (e.g. if you deploy the backend behind the same domain/reverse proxy
// as this frontend). If aiInsightUrl is falsy, the AI panel silently uses the local, rule-based
// fallback instead of calling any backend.
const CW_CONFIG = {
    apiBaseUrl: '',            // e.g. 'https://cryptobolt-api.yourhost.com'
    aiInsightUrl: '/api/ai-insight',

    // ---------- Transak (Buy/Sell Crypto widget) ----------
    // Get a free API key from your Transak dashboard: https://dashboard.transak.com/
    // (Sign up -> Developer -> API Keys). Leave blank and the Buy/Sell buttons will show
    // setup instructions instead of the widget.
    transakApiKey: '',
    // 'STAGING' = Transak's sandbox (no real money, test cards only) — good for development.
    // 'PRODUCTION' = live, real fiat/crypto transactions. Switch this once you're ready to go live.
    transakEnvironment: 'STAGING',

    // ---------- Supabase (accounts + real purchase history) ----------
    // Create a free project at https://supabase.com, then Project Settings -> API to get these.
    // supabaseAnonKey is the PUBLIC "anon" key — it's meant to be exposed in frontend code and is
    // safe to commit; it only works within the Row Level Security policies defined in the database
    // (see /supabase/schema.sql). NEVER put the "service_role" key here or anywhere in frontend code.
    supabaseUrl: '',
    supabaseAnonKey: ''
};
