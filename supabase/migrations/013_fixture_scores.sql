-- ============================================================================
-- Migration 013: match_fixtures live score
-- ============================================================================
-- Two nullable int columns so the FIFA timeline sync (lib/hits/feed-fifa.ts)
-- can persist the running score alongside the fixture status. The active card
-- page shows "POR 1 – 2 ESP" from these instead of inferring goals from fired
-- event keys (which is lossy: a goal that lights no new cell fires no event).
--
-- NULL = no score known yet (pre-game, or a source that doesn't report one).
-- Both nullable → fully non-breaking for existing rows and hand-seeded
-- fixtures.
-- ============================================================================

alter table public.match_fixtures
  add column if not exists home_score int,
  add column if not exists away_score int;
