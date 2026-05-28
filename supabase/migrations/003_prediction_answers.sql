-- Day 3E: add per-card prediction answers for the private dry-run game.
-- For private games (Sake Okada and future founding-team runs), each
-- card's predictive squares need a YES/NO answer that ops sets ahead
-- of time. End-of-night resolution events compare the player's answer
-- against the truth carried in event payload.
--
-- jsonb shape: { [squareId: string]: 'yes' | 'no' }
-- Defaults to empty object so existing /hits cards aren't affected.

alter table public.cards
  add column if not exists prediction_answers jsonb not null default '{}'::jsonb;
