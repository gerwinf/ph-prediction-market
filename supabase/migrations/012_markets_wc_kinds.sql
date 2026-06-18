-- ============================================================================
-- Migration 012: World Cup catalog kinds
-- ============================================================================
-- The /worldcup hub becomes editable from /ops/markets by reusing the markets
-- catalog (migration 009). Two new kinds back the section:
--
--   wc_fixture   — a single match card (teams, group, kickoff, venue, fallback
--                  odds, optional Polymarket slug). payload shape:
--                  { home:{name,iso}, away:{name,iso}, group, kickoff_iso,
--                    venue?, slug?, fallback:{home,draw,away} }
--   wc_contender — a "who wins the Cup" leaderboard row. payload shape:
--                  { name, iso, slug?, fallback_pct, vol, delta }
--
-- Additive only: existing 'binary' / 'event_cell' rows are untouched. We drop
-- and re-add the check constraint because Postgres has no "add value" for a
-- CHECK-IN list the way it does for enums.
-- ============================================================================

alter table public.markets drop constraint if exists markets_kind_check;

alter table public.markets add constraint markets_kind_check
  check (kind in ('binary', 'event_cell', 'wc_fixture', 'wc_contender'));
