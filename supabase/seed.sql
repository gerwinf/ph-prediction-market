-- Phase 0 seed. Two starter fixtures so cards can be issued before
-- the full WC fixture data lands (Day 3 task: lib/wc/fixtures.ts).
-- Safe to re-run; uses on conflict do nothing.

insert into public.match_fixtures (id, card_type, match_label, starts_at, status)
values
  -- WC kickoff match. Final teams set on draw day.
  ('wc-opening-2026', 'sports', 'WC 2026 Opening Match', '2026-06-11 19:00:00+00', 'scheduled'),
  -- First daily card, post-WC window.
  ('daily-2026-07-20', 'daily', 'Daily — 2026-07-20', '2026-07-20 00:00:00+00', 'scheduled')
on conflict (id) do nothing;
