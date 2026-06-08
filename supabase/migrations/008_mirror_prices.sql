-- ============================================================================
-- Migration 008: mirror_prices — imported reference prices
-- ============================================================================
-- First step of the mirror-pricing liquidity mechanism: globally-traded events
-- (World Cup, NBA) get an imported Polymarket win-probability shown as context
-- next to /picks player props, instead of needing cold-start local liquidity.
--
-- The table doubles as the cache. There is no Redis layer and no sub-daily
-- cron (Vercel Hobby caps cron at once-per-day — the same wall that pushed
-- demo events to seed-on-buy). /api/prices refreshes a slug lazily on read
-- when its row is older than the TTL, then upserts back here.
--
-- `outcomes` shape: [{ "name": "Argentina", "price": 0.78 }, ...]
-- `is_stale` is set true when a refresh fails; the last known outcomes are
-- preserved so the read path can choose to hide a stale strip without losing
-- the prior value.
-- ============================================================================

create table if not exists public.mirror_prices (
  id            bigserial primary key,
  event_slug    text not null,
  source        text not null default 'polymarket',
  market_id     text not null,
  question      text not null,
  outcomes      jsonb not null,
  volume_usd    numeric,
  fetched_at    timestamptz not null default now(),
  is_stale      boolean not null default false
);

create unique index if not exists mirror_prices_slug_source_idx
  on public.mirror_prices(event_slug, source);
create index if not exists mirror_prices_fetched_at_idx
  on public.mirror_prices(fetched_at desc);

-- RLS: prices are non-sensitive and public-read. Writes happen only through
-- the service-role admin client (which bypasses RLS), so there is no anon
-- INSERT/UPDATE policy — direct anon writes are denied by default.
alter table public.mirror_prices enable row level security;

drop policy if exists "mirror_prices public read" on public.mirror_prices;
create policy "mirror_prices public read"
  on public.mirror_prices
  for select
  using (true);
