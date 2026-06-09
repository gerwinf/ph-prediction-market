-- ============================================================================
-- Migration 009: markets — unified market catalog
-- ============================================================================
-- One DB-backed catalog powering BOTH surfaces:
--   - landing grid binary markets (app/page.tsx)  → kind='binary'
--   - /hits event-cell pools (lib/hits)            → kind='event_cell'
--
-- Markets enter as 'candidate' (human suggestion or signal feed), get curated
-- in /ops/markets to 'approved'/'live', and are 'retired' when stale. Only
-- approved/live rows are public-readable; the landing + /hits read paths fall
-- back to today's hardcoded data whenever the catalog is empty, so this
-- migration is fully non-breaking on its own.
--
-- payload (jsonb) shape by kind:
--   binary:     { categories: string[], cat?, polymarket_slug?,
--                 polymarket_market_id?, fallback_pct, vol_label, delta? }
--   event_cell: { event_key, label, category, rarity, team?, player? }
--
-- Writes happen only through the service-role admin client (which bypasses
-- RLS) — there is no anon INSERT/UPDATE policy, so direct anon writes are
-- denied by default (same posture as migration 008).
-- ============================================================================

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

-- Queue listing (status + kind) and the public live-read grouping.
create index if not exists markets_status_kind_idx
  on public.markets(status, kind);
create index if not exists markets_kind_category_live_idx
  on public.markets(kind, category)
  where status in ('approved', 'live');
create index if not exists markets_interest_score_idx
  on public.markets(interest_score desc);
create index if not exists markets_fixture_id_idx
  on public.markets(fixture_id);

-- Signal dedup: a feed re-running must not insert a second candidate for the
-- same (kind, title, source). Approved/live/retired rows are exempt so a human
-- can keep an approved copy while the feed keeps proposing the raw candidate.
create unique index if not exists markets_candidate_dedup_idx
  on public.markets(kind, lower(title), source)
  where status = 'candidate';

-- updated_at maintenance trigger.
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

-- RLS: public may read only approved/live markets; all writes go through the
-- service-role admin client (bypasses RLS). No anon write policy → denied.
alter table public.markets enable row level security;

drop policy if exists "markets public read" on public.markets;
create policy "markets public read"
  on public.markets
  for select
  using (status in ('approved', 'live'));
