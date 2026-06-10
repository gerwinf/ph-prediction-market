-- ============================================================================
-- Migration 011: match_fixtures provenance + venue
-- ============================================================================
-- Two nullable columns on match_fixtures so the PBA schedule feed (and any
-- future fixture source) can record where a game came from and where it's
-- played:
--
--   source  — provenance tag, e.g. 'feed:pba'. Lets the ingest job scope its
--             updates to feed-owned rows and never touch hand-seeded fixtures.
--   venue   — arena name shown on the /hits upcoming-games list.
--
-- Both nullable → fully non-breaking. Existing fixtures keep source = NULL.
-- ============================================================================

alter table public.match_fixtures
  add column if not exists source text,
  add column if not exists venue  text;

-- Ingest reads "feed:pba scheduled rows" to decide what to refresh vs. leave
-- alone; index the provenance for that scan.
create index if not exists match_fixtures_source_idx
  on public.match_fixtures(source)
  where source is not null;
