-- ============================================================================
-- Migration 009 — markets (unified market catalog).
-- Run in Supabase → SQL Editor. Idempotent — safe to run more than once.
-- ============================================================================

-- STEP 1 (required): table
create table if not exists public.markets (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('binary', 'event_cell')),
  category      text,
  title         text not null,
  fixture_id    text references public.match_fixtures(id) on delete set null,
  status        text not null default 'candidate'
                check (status in ('candidate', 'approved', 'live', 'retired')),
  interest_score int not null default 0,
  source        text,
  suggested_by  text,
  reviewed_by   text,
  suggested_at  timestamptz,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  payload       jsonb not null default '{}'::jsonb
);

-- STEP 2 (required): indexes
create index if not exists markets_status_kind_idx
  on public.markets(status, kind);
create index if not exists markets_kind_category_live_idx
  on public.markets(kind, category)
  where status in ('approved', 'live');
create index if not exists markets_interest_score_idx
  on public.markets(interest_score desc);
create index if not exists markets_fixture_id_idx
  on public.markets(fixture_id);
create unique index if not exists markets_candidate_dedup_idx
  on public.markets(kind, lower(title), source)
  where status = 'candidate';

-- STEP 3 (required): updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists markets_set_updated_at on public.markets;
create trigger markets_set_updated_at
  before update on public.markets
  for each row execute function public.set_updated_at();

-- STEP 4 (required): RLS — public reads approved/live, writes via service role
alter table public.markets enable row level security;
drop policy if exists "markets public read" on public.markets;
create policy "markets public read"
  on public.markets for select
  using (status in ('approved', 'live'));

-- STEP 5 (verify): should return empty until the seed script runs
select status, kind, count(*) from public.markets group by status, kind;
