-- ============================================================================
-- Migration 010: markets.closes_at — market lifecycle / auto-retire
-- ============================================================================
-- The catalog had no notion of when a market ends, so approved markets sat on
-- the grid forever (a June price market stayed live in July). `closes_at` stores
-- the resolution deadline — from the Polymarket event endDate for signal markets,
-- or the fixture ends_at for event-cells. The daily catalog-maintenance cron
-- (/api/cron/maintain-catalog) retires approved/live markets once closes_at has
-- passed. Nullable: human/seed markets without a known deadline never auto-retire.
-- ============================================================================

alter table public.markets add column if not exists closes_at timestamptz;

-- Sweep index: find approved/live markets whose deadline has passed.
create index if not exists markets_closes_at_idx
  on public.markets(closes_at)
  where status in ('approved', 'live') and closes_at is not null;
