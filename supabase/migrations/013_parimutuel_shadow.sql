-- Parimutuel shadow engine (spec: docs/superpowers/specs/2026-07-07-hits-parimutuel-design.md)
-- Additive + zero-downtime. Shadow phase writes settlement summaries only;
-- nothing here changes how live cards are credited yet.

-- Global rollover reserve, as a ledger (balance = SUM(amount_centavos)).
-- Seeding (source='seed') and per-game flows (rollover_in / payout_draw /
-- refund_back) all append here; the reserve is never mutated in place.
create table if not exists public.pool_reserve_ledger (
  id              bigserial primary key,
  source          text not null check (source in ('seed', 'rollover_in', 'payout_draw', 'refund_back')),
  amount_centavos bigint not null,
  match_id        text references public.match_fixtures(id),
  created_at      timestamptz not null default now()
);
create index if not exists pool_reserve_ledger_created_idx on public.pool_reserve_ledger(created_at);

-- One settlement summary per fixture. UNIQUE(match_id) is the double-settle
-- guard (CEO review 2A): concurrent settle-on-read triggers race harmlessly —
-- the second insert fails 23505 and is swallowed. `mode` records whether the
-- pass credited balances ('credited') or only logged ('shadow').
create table if not exists public.pool_settlements (
  id                  bigserial primary key,
  match_id            text not null unique references public.match_fixtures(id),
  mode                text not null default 'shadow' check (mode in ('shadow', 'credited', 'refund')),
  vt_centavos         bigint not null,
  fee_centavos        bigint not null,
  reserve_drawn_centavos bigint not null default 0,
  surplus_centavos    bigint not null default 0,
  weight_centavos     bigint not null default 0,
  u                   double precision not null default 1,
  winners             int not null default 0,
  cards               int not null default 0,
  payouts             jsonb not null default '{}'::jsonb, -- card_id → centavos
  settled_at          timestamptz not null default now()
);

-- Per-fixture settlement mode. Cards always settle under the mode of the
-- fixture they were bought on (pool-freeze invariant extends to settlement).
alter table public.match_fixtures
  add column if not exists settlement_mode text not null default 'fixed'
  check (settlement_mode in ('fixed', 'parimutuel'));

-- ─────────────────────────────────────────────────────────────────────────
-- PHASE 3 CONTRACT (CEO review 2A — not created yet, documented here):
-- crediting MUST be one transaction. Supabase's REST client cannot compose
-- multi-statement transactions, so the credited pass ships as a Postgres
-- function, roughly:
--
--   create function public.settle_parimutuel_credit(
--     p_match_id text, p_payouts jsonb, p_summary jsonb
--   ) returns void language plpgsql security definer as $$
--   begin
--     -- 1. insert pool_settlements (mode='credited')  ← unique(match_id) aborts double-credit
--     -- 2. update cards set score/won/win_pattern/settled_at from p_payouts
--     -- 3. update profiles.virtual_balance for authed winners
--     -- 4. insert pool_reserve_ledger rows (payout_draw + rollover_in)
--     -- any failure rolls the whole pass back; no half-credited players.
--   end $$;
-- ─────────────────────────────────────────────────────────────────────────

-- RLS: repo posture is RLS-on for every table (002_rls.sql). No policies —
-- settlement data is service-role-only; anon/authenticated keys get nothing.
alter table public.pool_reserve_ledger enable row level security;
alter table public.pool_settlements enable row level security;
