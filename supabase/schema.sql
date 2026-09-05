-- ============================================================================
-- CryptoBolt — Supabase schema for real account purchase history
-- ============================================================================
-- Run this once in your Supabase project's SQL Editor (Project -> SQL Editor -> New query).
-- SAFE TO RE-RUN: every CREATE TABLE uses IF NOT EXISTS and every CREATE POLICY is preceded by
-- a DROP POLICY IF EXISTS, so pasting this whole file again later (e.g. after pulling an update
-- that adds new tables further down) will not error on objects that already exist.
-- It creates one table, "purchases", that can record every real Buy/Sell a signed-in visitor
-- completes (currently: redirected to Binance in a new tab — see js/14-buy-sell-redirect.js),
-- and locks it down with Row Level Security so a person can only ever read or write their own
-- rows — nobody else's.
--
-- IMPORTANT — what this table is and isn't:
--   - CryptoBolt never holds anyone's money or crypto. The Buy/Sell buttons just open Binance
--     in a new tab; the trade itself happens entirely on Binance's side. This table is a
--     personal receipt log so a signed-in visitor can see their own purchase history and P&L
--     on the site afterward — but nothing in this codebase currently writes to it, since a
--     plain new-tab redirect has no way to report back whether/how the trade actually went.
--     It's here for anyone who wants to log purchases manually, or wire up their own
--     provider-specific integration later (an exchange webhook, a manual entry form, etc.).
--   - If you do wire something up: have it insert rows using the signed-in visitor's own
--     Supabase session (RLS below only allows a person to insert their own rows), or, for a
--     tamper-resistant log, verify server-side and insert using the service_role key instead —
--     see the note at the bottom of this file.
--
-- MIGRATING FROM AN EARLIER VERSION OF THIS SCHEMA?
-- Older copies of this file named the dedupe column `alchemypay_order_no` and defaulted
-- `provider` to 'alchemypay', back when Buy/Sell opened an in-page AlchemyPay widget instead of
-- redirecting to Binance. If "purchases" already exists with those names, run this once (safe
-- to skip on a brand-new project — the CREATE TABLE below already reflects the new names):
--   alter table public.purchases rename column alchemypay_order_no to order_reference;
--   alter table public.purchases alter column provider set default 'manual';
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
    provider          text not null default 'manual', -- e.g. 'binance', 'manual' — whatever wrote the row
    order_reference   text unique,                     -- the provider's own order/reference id, if any — dedupes retried inserts
    wallet_address    text,
    status            text not null default 'completed',

    created_at        timestamptz not null default now()
);

comment on table public.purchases is 'Personal record of real Buy/Sell orders a signed-in visitor completed. CryptoBolt never custodies funds; this is a receipt log only. Currently unpopulated by default — see the comment above.';

create index if not exists purchases_user_id_idx on public.purchases (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: a person can only see and insert their OWN rows.
-- ---------------------------------------------------------------------------
alter table public.purchases enable row level security;

drop policy if exists "Users can view their own purchases" on public.purchases;
create policy "Users can view their own purchases"
    on public.purchases
    for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own purchases" on public.purchases;
create policy "Users can insert their own purchases"
    on public.purchases
    for insert
    with check (auth.uid() = user_id);

-- Deliberately no UPDATE or DELETE policy for regular users: once a purchase is recorded it's
-- an append-only receipt, the same way a real brokerage doesn't let you edit past fills.

-- ============================================================================
-- OPTIONAL HARDENING — server-verified purchases (do this later if you need it)
-- ============================================================================
-- As shipped, nothing writes to "purchases" automatically (see the note at the top of this
-- file) — Buy/Sell is a plain redirect to Binance with no callback. If you build your own
-- provider integration and want it tamper-resistant rather than self-reported by the browser:
--   1. Verify whatever signal your provider gives you server-side (a webhook signature, a
--      signed redirect, a status API you poll) — never trust an unverified client report.
--   2. Once verified, have your backend insert the row itself using Supabase's service_role
--      key (Project Settings -> API -> service_role — keep this ONLY in server-side env vars,
--      never in frontend code) via supabase-js, or a direct REST call with that key.
--   3. At that point you can DROP the "Users can insert their own purchases" policy below so
--      only your server (using service_role, which bypasses RLS entirely) can write rows —
--      the browser becomes read-only for this table.
-- This is genuinely optional — most solo/indie dashboards are fine leaving "purchases" as a
-- manual or browser-inserted log, or not using it at all.
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

drop policy if exists "Users can view their own app state" on public.app_state;
create policy "Users can view their own app state"
    on public.app_state
    for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own app state" on public.app_state;
create policy "Users can insert their own app state"
    on public.app_state
    for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own app state" on public.app_state;
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

-- ============================================================================
-- Usernames + Paper Trading Leaderboard — a weekly/monthly "who made the most
-- (virtual) money" competition between signed-in visitors. Written by
-- js/17-auth.js (username at signup), js/18-account.js (rename later), and
-- js/22-leaderboard.js (submitting equity + reading the board) on trade.html.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per user, holding the public display name (username)
-- shown on the leaderboard instead of their email. Username is collected at
-- signup (see the "Username" field in the auth modal) and stored in
-- auth.users' raw_user_meta_data by supabase-js's signUp({ options: { data }})
-- call — the handle_new_user() trigger below copies it in here the moment the
-- account row is created, so it works the same for email/password signups and
-- "Continue with Google" (which never runs the app's own signup form).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    username    text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
    created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Public display name (username) per user, shown on the paper trading leaderboard instead of email.';

-- MIGRATING AN EXISTING DEPLOYMENT (users created before this feature existed)?
-- The trigger below only fires for NEW signups. Existing users won't have a profiles row until
-- you backfill one — run this once, after the CREATE TABLE/TRIGGER statements below, to give
-- everyone a fallback username (they can rename themselves later from the Account page):
--   insert into public.profiles (id, username)
--   select id, 'user' || substr(replace(id::text, '-', ''), 1, 8) from auth.users
--   on conflict (id) do nothing;

alter table public.profiles enable row level security;

-- Usernames are meant to be seen by other visitors (that's the whole point of a
-- leaderboard), and a visitor needs to be able to check "is this username already
-- taken?" before they've even signed up — so SELECT is public, unauthenticated included.
drop policy if exists "Anyone can view usernames" on public.profiles;
create policy "Anyone can view usernames"
    on public.profiles
    for select
    using (true);

drop policy if exists "Users can update their own username" on public.profiles;
create policy "Users can update their own username"
    on public.profiles
    for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- No public INSERT policy — rows are only ever created by handle_new_user() below, which
-- runs as security definer and bypasses RLS. That keeps `id` always in lockstep with a real
-- auth.users row instead of trusting the browser to supply it.

-- Auto-generates a safe fallback username (userXXXXXXXX) when raw_user_meta_data has none
-- (Google sign-in) or when the chosen one is already taken by someone else — a user can
-- always rename themselves afterward from the Account page.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    desired text;
begin
    desired := trim(new.raw_user_meta_data->>'username');
    if desired is null or desired !~ '^[A-Za-z0-9_]{3,20}$' then
        desired := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;

    begin
        insert into public.profiles (id, username) values (new.id, desired);
    exception when unique_violation then
        -- Desired name taken — fall back to a name that can't collide, rather than
        -- blocking account creation entirely. The user can pick something nicer later.
        insert into public.profiles (id, username)
        values (new.id, 'user' || substr(replace(new.id::text, '-', ''), 1, 8))
        on conflict (id) do nothing;
    end;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- leaderboard_stats: one row per user, tracking paper trading equity ($10,000
-- starting virtual balance, same as trade.html's STARTING_BALANCE) against a
-- snapshot taken at the start of the current calendar week and month. The
-- "gain" columns are what the leaderboard actually ranks by.
-- ---------------------------------------------------------------------------
create table if not exists public.leaderboard_stats (
    user_id             uuid primary key references auth.users(id) on delete cascade,
    username            text not null,
    equity              numeric not null,
    week_start_at       timestamptz not null,
    week_start_equity   numeric not null,
    month_start_at      timestamptz not null,
    month_start_equity  numeric not null,
    weekly_gain         numeric generated always as (equity - week_start_equity) stored,
    monthly_gain        numeric generated always as (equity - month_start_equity) stored,
    updated_at          timestamptz not null default now()
);

comment on table public.leaderboard_stats is 'Paper trading leaderboard: current equity vs. equity at the start of the current week/month, per user. Written via public.submit_paper_equity(), read directly by js/22-leaderboard.js.';

create index if not exists leaderboard_stats_weekly_idx on public.leaderboard_stats (weekly_gain desc);
create index if not exists leaderboard_stats_monthly_idx on public.leaderboard_stats (monthly_gain desc);

alter table public.leaderboard_stats enable row level security;

-- Public leaderboard — anyone can see the standings, signed in or not.
drop policy if exists "Anyone can view the leaderboard" on public.leaderboard_stats;
create policy "Anyone can view the leaderboard"
    on public.leaderboard_stats
    for select
    using (true);

-- No direct INSERT/UPDATE policy for regular users: all writes go through
-- submit_paper_equity() below (security definer), which is the only thing allowed to
-- decide when a week/month "rolls over" and resets the baseline. This stops a visitor
-- from just UPDATE-ing their own row to fabricate a huge starting-equity swing.

-- NOTE ON TRUST: like the "purchases" table above, this is a personal/casual leaderboard,
-- not a tamper-proof one — a technically savvy visitor could still call
-- submit_paper_equity() with a fabricated (but plausible-range) equity number since paper
-- trading itself runs client-side with no server-verified order book. That's an acceptable
-- trade-off for a virtual-money competition; don't reuse this pattern for anything real.

create or replace function public.submit_paper_equity(p_equity numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_username text;
    v_now timestamptz := now();
    v_week_start timestamptz := date_trunc('week', v_now);
    v_month_start timestamptz := date_trunc('month', v_now);
begin
    if v_uid is null then
        raise exception 'Must be signed in to submit paper trading equity';
    end if;
    -- Sanity bound only — see NOTE ON TRUST above. STARTING_BALANCE is $10,000; this just
    -- rejects obviously-broken values (NaN slipped through as null, negative, or absurd),
    -- not a real anti-cheat measure.
    if p_equity is null or p_equity < 0 or p_equity > 1000000000 then
        return;
    end if;

    select username into v_username from public.profiles where id = v_uid;

    insert into public.leaderboard_stats (
        user_id, username, equity,
        week_start_at, week_start_equity,
        month_start_at, month_start_equity,
        updated_at
    ) values (
        v_uid, coalesce(v_username, 'trader'), p_equity,
        v_week_start, p_equity,
        v_month_start, p_equity,
        v_now
    )
    on conflict (user_id) do update set
        username = coalesce(v_username, leaderboard_stats.username),
        equity = p_equity,
        week_start_at = case when leaderboard_stats.week_start_at < v_week_start then v_week_start else leaderboard_stats.week_start_at end,
        week_start_equity = case when leaderboard_stats.week_start_at < v_week_start then p_equity else leaderboard_stats.week_start_equity end,
        month_start_at = case when leaderboard_stats.month_start_at < v_month_start then v_month_start else leaderboard_stats.month_start_at end,
        month_start_equity = case when leaderboard_stats.month_start_at < v_month_start then p_equity else leaderboard_stats.month_start_equity end,
        updated_at = v_now;
end;
$$;

grant execute on function public.submit_paper_equity(numeric) to authenticated;

-- ============================================================================
-- Push subscriptions — lets price alerts (js/07-alerts.js) fire even when the
-- browser tab that set them is closed. A signed-in visitor's Web Push
-- subscription (endpoint + keys, from the browser's PushManager) is stored
-- here; the server's alert-checker cron (server/src/lib/alert-checker.js)
-- reads every row with the service-role key (RLS below only opens rows to
-- their own owner, so the cron necessarily uses the privileged key — same
-- pattern as db.js), compares each user's cw_alerts (already synced into
-- app_state by js/19-cloud-sync.js) against live prices, and pushes a
-- notification through web-push when one trips. Written/deleted by
-- js/23-push-alerts.js via POST /api/push/subscribe and /api/push/unsubscribe
-- (both go through the server, not directly from the browser, since deciding
-- "is this the current user" needs the visitor's auth token verified
-- server-side before touching another user's row).
-- ============================================================================

create table if not exists public.push_subscriptions (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    endpoint    text not null unique,
    p256dh      text not null,
    auth        text not null,
    created_at  timestamptz not null default now()
);

comment on table public.push_subscriptions is 'Web Push subscriptions for cross-device/closed-tab price alerts. Written by js/23-push-alerts.js via the server (not directly), read by server/src/lib/alert-checker.js with the service-role key.';

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Regular visitors never talk to this table directly (see comment above) — these policies
-- exist so RLS is deny-by-default and correct if that ever changes, not because the frontend
-- currently uses them. All actual reads/writes go through the server with the service-role
-- key, which bypasses RLS entirely.
drop policy if exists "Users can view their own push subscriptions" on public.push_subscriptions;
create policy "Users can view their own push subscriptions"
    on public.push_subscriptions
    for select
    using (auth.uid() = user_id);

drop policy if exists "Users can delete their own push subscriptions" on public.push_subscriptions;
create policy "Users can delete their own push subscriptions"
    on public.push_subscriptions
    for delete
    using (auth.uid() = user_id);

-- ============================================================================
-- AI call track record — every structured trade setup the AI Market Insight
-- panel produces (js/10-ai-insight.js's computeTradePlan()) gets logged here
-- the moment it's shown, and server/src/lib/ai-call-tracker.js resolves it
-- automatically against live Binance prices (same fetchAllBinancePrices()
-- helper the push-alert checker above uses) until it hits a target, hits its
-- stop, or expires unresolved. GET /api/ai-calls/track-record aggregates
-- these into a public win-rate/R-multiple readout, bucketed by setup type
-- so a range-fade's naturally higher hit rate can't silently inflate a
-- breakout call's real track record.
--
-- Nobody's personal data lives here — this isn't tied to a user_id at all.
-- It's a record of what the MODEL said, not what any visitor did with it.
-- ============================================================================

create table if not exists public.ai_calls (
    id              uuid primary key default gen_random_uuid(),
    created_at      timestamptz not null default now(),

    -- What was analyzed
    asset           text not null,                 -- e.g. 'BTC'
    market          text not null check (market in ('spot', 'perpetual futures')),
    interval        text not null,                 -- chart interval at the time, e.g. '1h'

    -- The AI-chosen setup shape + the deterministic price plan built from it
    -- (see js/10-ai-insight.js's computeTradePlan() — same math, logged verbatim)
    bias            text not null check (bias in ('long-leaning', 'short-leaning')),
    setup_type      text not null check (setup_type in ('breakout-continuation', 'pullback-entry', 'range-fade')),
    entry_low       numeric not null,
    entry_high      numeric not null,
    stop_price      numeric not null,
    target1         numeric not null,
    target2         numeric not null,
    price_at_call   numeric not null,               -- live price when the call was logged
    atr14           numeric,
    stop_mult       numeric,

    -- Resolution, filled in later by ai-call-tracker.js's resolve cycle
    status          text not null default 'open' check (status in ('open', 'hit_target1', 'hit_target2', 'hit_stop', 'expired')),
    resolved_at     timestamptz,
    resolved_price  numeric
);

comment on table public.ai_calls is 'Every AI-generated trade setup shown in the AI Market Insight panel, auto-resolved against live prices for a public win-rate track record. Not tied to any user.';

create index if not exists ai_calls_status_idx on public.ai_calls (status, created_at);
create index if not exists ai_calls_asset_idx on public.ai_calls (asset, created_at desc);

alter table public.ai_calls enable row level security;

-- Public, read-only — the whole point is a track record anyone can check, signed in or not.
drop policy if exists "Anyone can view AI call history" on public.ai_calls;
create policy "Anyone can view AI call history"
    on public.ai_calls
    for select
    using (true);

-- No INSERT/UPDATE/DELETE policy for regular visitors: every write (logging a new call,
-- resolving an open one) goes through the server using the service-role key
-- (server/src/lib/ai-call-tracker.js), which bypasses RLS entirely. That keeps the track
-- record honest — a visitor's browser can request that a call be logged, but only the
-- server decides how it gets resolved, from real Binance prices it fetched itself.