-- ============================================================================
-- Migration 007: GGR foundation
-- ============================================================================
-- The PIGO operator pitch needs a GGR (Gross Gaming Revenue) view: how much
-- margin Hula's mechanic generates per match. GGR = total wagered − total
-- paid out = SUM(hold_amount) across settled cards.
--
-- Per-card hold = price_php − payout. On a win the payout exceeds the wager,
-- so hold goes NEGATIVE (₱20 card, 5× = ₱100 payout → −₱80 hold); on a loss
-- the house keeps the wager, so hold = +price_php. Summed across all settled
-- cards, that's GGR.
--
-- We do NOT add a payout_php column — cards.score already stores the payout.
-- Storing it twice would drift. hold_amount IS stored (not just derived) so
-- the GGR aggregation can run off a covering index without recomputing
-- price − score per row.
--
-- operator_id is added now (default 'hula') to forward-provision the B2B
-- multi-operator partition the eng review wanted "from day 1," even though
-- multi-operator routing is out of scope for this migration.
-- ============================================================================

alter table public.cards add column if not exists hold_amount int;
alter table public.cards add column if not exists settled_at timestamptz;
alter table public.cards add column if not exists operator_id text not null default 'hula';

-- Covering index for the GGR aggregation query (operator + time window).
create index if not exists cards_ggr_idx
  on public.cards(operator_id, settled_at)
  where settled_at is not null;

-- Backfill already-won cards: payout is in `score`, hold = price − score,
-- settled at the existing claimed_at timestamp. Unwon cards stay null until
-- their match ends and the inline settle (in /api/ops/fixture-status) runs.
update public.cards
set hold_amount = price_php - score,
    settled_at  = claimed_at
where won = true
  and settled_at is null
  and claimed_at is not null;
