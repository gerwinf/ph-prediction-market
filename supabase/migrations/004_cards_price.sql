-- ============================================================================
-- Migration 004: cards.price_php column
-- ============================================================================
-- Reason: server-side payout computation (Day 6 eng review). The leaderboard
-- ranks by cards.score, which was previously written from a browser-supplied
-- payoutPhp value. Anyone with curl could dominate the leaderboard. Server
-- needs to recompute payout from cells + events using the card's actual
-- purchase price — which lives client-side today.
--
-- Solution: store price_php on the card row at purchase time. /api/cards POST
-- already receives pricePhp in the body (validated to {20, 50} by client) —
-- we just persist it.
--
-- Backfill: existing Phase 0 cards default to ₱20 (the picker's primary
-- option and the value used by sample-match.ts). Phase 0 has minimal data
-- so the backfill is safe.
--
-- Constraint: enforce {20, 50} server-side. Catches future bad inserts and
-- any drift if the picker copy changes without API validation.
-- ============================================================================

alter table public.cards add column if not exists price_php int;

update public.cards set price_php = 20 where price_php is null;

alter table public.cards alter column price_php set not null;

alter table public.cards
  add constraint cards_price_php_valid check (price_php in (20, 50));
