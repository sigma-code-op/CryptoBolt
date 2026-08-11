-- ============================================================================
-- CryptoBolt — Supabase schema for real account purchase history
-- ============================================================================
-- Run this once in your Supabase project's SQL Editor (Project -> SQL Editor -> New query).
-- It creates one table, "purchases", that records every real Buy/Sell a signed-in visitor
-- completes through the Transak widget, and locks it down with Row Level Security so a
-- person can only ever read or write their own rows — nobody else's.
--
-- IMPORTANT — what this table is and isn't:
--   - CryptoBolt never holds anyone's money or crypto. Transak moves the real fiat/crypto,
--     directly to the buyer's own wallet. This table is just a personal receipt log so a
--     signed-in visitor can see their own purchase history and P&L on the site afterward.
--   - Rows are inserted directly by the signed-in visitor's browser (using their own Supabase
--     session) the moment the Transak widget reports a successful order client-side. That
--     means this ledger is self-reported by the browser, not independently confirmed by
--     Transak's servers. For most personal-dashboard use this is fine. If you later want an
--     ironclad, tamper-proof ledger (e.g. because other people will rely on these numbers),
--     add a server-side Transak webhook that verifies the order with Transak's API and writes
--     the row itself using the service_role key — see the note at the bottom of this file.
-- ============================================================================

create table if not exists public.purchases (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,

    -- What happened
    side              text not null check (side in ('buy', 'sell')),
    symbol            text not null,                 -- e.g. 'BTC'
    crypto_amount     numeric not null check (crypto_amount > 0),
    fiat_amount       numeric not null check (fiat_amount > 0),
    fiat_currency     text not null default 'USD',
    price_usd         numeric,                        -- fiat_amount / crypto_amount at execution time, for convenience

    -- Where it came from
    provider          text not null default 'transak',
    transak_order_id  text unique,                    -- Transak's own order id, dedupes retried inserts
    wallet_address     text,
    status            text not null default 'completed',

    created_at        timestamptz not null default now()
);

comment on table public.purchases is 'Personal record of real Buy/Sell orders a signed-in visitor completed through Transak. CryptoBolt never custodies funds; this is a receipt log only.';

create index if not exists purchases_user_id_idx on public.purchases (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: a person can only see and insert their OWN rows.
-- ---------------------------------------------------------------------------
alter table public.purchases enable row level security;

create policy "Users can view their own purchases"
    on public.purchases
    for select
    using (auth.uid() = user_id);

create policy "Users can insert their own purchases"
    on public.purchases
    for insert
    with check (auth.uid() = user_id);

-- Deliberately no UPDATE or DELETE policy for regular users: once a purchase is recorded it's
-- an append-only receipt, the same way a real brokerage doesn't let you edit past fills.

-- ============================================================================
-- OPTIONAL HARDENING — server-verified purchases (do this later if you need it)
-- ============================================================================
-- The MVP above trusts the browser to report "this order actually completed." That's normal
-- for a personal dashboard, but it does mean a technically savvy person could theoretically
-- insert a fake row into their OWN history (RLS still stops them from touching anyone else's).
--
-- To close that gap:
--   1. Set up a Transak webhook (Transak dashboard -> Webhooks) pointed at a new endpoint on
--      your existing Express server, e.g. POST /api/transak-webhook.
--   2. That endpoint decrypts/verifies the payload using your Transak Partner Access Token
--      (see https://docs.transak.com/guides/how-to-decrypt-webhook-payload) — never trust an
--      unverified webhook body.
--   3. Once verified, the server inserts the row itself using Supabase's service_role key
--      (Project Settings -> API -> service_role — keep this ONLY in server-side env vars,
--      never in frontend code) via supabase-js, or a direct REST call with that key.
--   4. At that point you can DROP the "Users can insert their own purchases" policy above so
--      only your server (using service_role, which bypasses RLS entirely) can write rows —
--      the browser becomes read-only for this table.
-- This is genuinely optional — most solo/indie dashboards ship happily with the MVP version.
-- ============================================================================

-- ============================================================================
-- Cross-device cloud sync — one row per signed-in user, holding a JSON blob of their
-- watchlist, alerts, holdings, notes, and paper trading account. Read/written by
-- js/19-cloud-sync.js. Deliberately NOT synced: the visitor's personal Groq API key
-- (cw_groq_api_key never leaves their browser) and unbounded local scrollback like AI/alert
-- history — see the SYNCED_KEYS allowlist at the top of that file for the exact list.
-- ============================================================================

create table if not exists public.app_state (
    user_id     uuid primary key references auth.users(id) on delete cascade,
    state       jsonb not null default '{}'::jsonb,
    updated_at  timestamptz not null default now()
);

comment on table public.app_state is 'Cross-device sync: one JSON blob per user of their watchlist, alerts, holdings, notes, and paper trading account. Written by js/19-cloud-sync.js.';

alter table public.app_state enable row level security;

create policy "Users can view their own app state"
    on public.app_state
    for select
    using (auth.uid() = user_id);

create policy "Users can insert their own app state"
    on public.app_state
    for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own app state"
    on public.app_state
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- updated_at is always set server-side (never trusts the client's clock) so the sync module's
-- "is the remote copy newer than what I last pushed?" comparison is reliable even if a visitor's
-- system clock is wrong.
create or replace function public.set_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists app_state_set_updated_at on public.app_state;
create trigger app_state_set_updated_at
    before insert or update on public.app_state
    for each row
    execute function public.set_app_state_updated_at();
