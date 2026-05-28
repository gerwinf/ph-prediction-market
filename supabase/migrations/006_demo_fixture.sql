-- ============================================================================
-- Migration 006: demo-pba-perpetual fixture
-- ============================================================================
-- A permanent live fixture that anyone can play against — even when no real
-- PBA game is happening. Used to validate the full server-side flow
-- (purchase → events fire → payout computes → leaderboard credits) without
-- requiring /ops involvement, and to give casual visitors a real-feeling
-- demo at any time of day.
--
-- A Vercel cron (app/api/cron/demo-tick) fires one event into this match's
-- events table every 1-2 minutes. Players buying a card against this
-- fixture see cells light up naturally.
--
-- Excluded from leaderboard + admin funnel aggregations (filter
-- match_id = 'demo-pba-perpetual' where appropriate).
-- ============================================================================

insert into public.match_fixtures (id, card_type, match_label, starts_at, ends_at, status)
values (
  'demo-pba-perpetual',
  'sports',
  'Demo · Ginebra vs RoS · perpetual',
  '1970-01-01T00:00:00Z',
  null,
  'live'
)
on conflict (id) do update set
  status = 'live',
  match_label = excluded.match_label;
