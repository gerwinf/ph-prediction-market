<!-- /autoplan restore point: /Users/gerwf/.gstack/projects/gerwinf-ph-prediction-market/gerwinf-cold-start-market-maker-autoplan-restore-20260616-122539.md -->
# Cold-Start Market Maker — Design Plan

Branch: `gerwinf/cold-start-market-maker`
Date: 2026-06-16
Status: SUPERSEDED (2026-06-16) — replaced by the hedged-CLOB direction (Stefan/Gnosis):
own CLOB + bot that mirrors Polymarket and hedges every fill (riskless principal), real pesos
+ USDC hedge. This house-book/fixed-odds design assumed the house carries risk; the hedged model
does not. Pure odds math (`lib/mm/odds.ts`) and Polymarket anchoring may be reused; the house-book
`place_bet`/`settle_market` RPCs are not. New spec to follow.

## Problem

The landing-grid binary yes/no markets (`markets.kind='binary'`) are **display-only**
today — they mirror Polymarket odds (`payload.fallback_pct`, `payload.polymarket_market_id`,
cached in `mirror_prices`). There is no buy-YES / buy-NO flow, no positions table, no
settlement. We want to make them **tradeable**.

The moment we make a market tradeable, we hit the **cold-start problem**: a fresh market
has no other participants, so the first user has nobody to take the other side of their
bet. An empty market is unbettable and looks dead. We need an automated market maker that
is always willing to quote both sides so the very first user can always trade, with prices
anchored to the Polymarket reference feed we already ingest.

Scope decision from brainstorm: **A — peer-to-peer binary markets, bot quotes both sides,
anchored to Polymarket.** Virtual currency only (matches Phase 0 `virtual_balance`).

## Goals

1. Every approved/live binary market is **always tradeable** — a user can buy YES or NO at
   any time, even with zero other participants.
2. Quoted prices stay **anchored to the Polymarket reference** so the house never offers a
   confidently-wrong price (same discipline as `lib/oracle/slugs.ts`: no wrong price beats a
   wrong price).
3. The market **feels alive** — price moves as people trade, there's a visible last price /
   small chart, volume ticks up.
4. **Bounded house risk** — the maximum the house can lose subsidizing a single market is
   known and capped up front (virtual currency, so this is play-money risk, but we still
   bound it for GGR realism and the operator pitch).
5. Reuse the existing house-banked accounting paradigm (migration 007 `hold_amount` / GGR).

## Non-Goals (NOT in scope)

- Real-money trading or cashouts. Virtual currency only.
- A peer-to-peer **order book** with limit orders / matching engine. (Deferred — the AMM
  removes the need for it at this stage.)
- Multi-outcome (categorical) markets. Binary YES/NO only for v1.
- Automated resolution of arbitrary markets. v1 settles only markets whose Polymarket source
  resolves, or via the existing `/ops` manual resolve path.
- Cross-operator routing (operator_id stays `'hula'`).

## Recommended Approach — fixed-odds house book (the "bot" is the anchoring job)

*(Revised after CEO premise review — see Decision Audit Trail. LMSR is retained as the
rejected alternative below.)*

The house is always the counterparty. Each binary market carries a single house-quoted
probability `p` (YES), anchored to the Polymarket reference. A user bets a fixed virtual stake
on YES or NO and gets **locked-in decimal odds** shown in masa-legible language: "**YES pays
1.85×**". This solves cold start by construction — the house quotes both sides and fills any
bet from t=0, no other participants required — and reuses the exact house-banked, `hold_amount`
GGR accounting already shipped in migration 007 and `/hits`.

### Odds + margin

For a market with anchored YES probability `p` and house margin `m` (overround, e.g. 5%):

```
multiplier_yes = (1 / p)       · (1 − m)     // shown as "YES pays 1.85×"
multiplier_no  = (1 / (1 − p)) · (1 − m)
```

- Bet ₱S on YES → locked `potential_payout = round(S · multiplier_yes)`. The multiplier is
  **frozen at bet time** (the user's contract), so later anchor moves never change a placed bet.
- House edge = the margin `m`. On settlement, `hold = Σ stakes − Σ payouts` (migration 007
  paradigm, no new accounting concept).

### Seeding + anchoring to Polymarket (cold start + the "bot")

- On `approved`/`live`, set `p` from the Polymarket reference (`mirror_prices.outcomes[0]`, else
  `payload.fallback_pct`). Market opens fully bettable at honest odds before any user arrives.
- The anchoring job is the part that earns the name "bot": it keeps `p` tied to the live
  Polymarket reference. **Reuse the existing lazy-refresh-on-read pattern** (`/api/prices`,
  `lib/oracle/refresh.ts`, 10-min TTL) — re-anchor `p` when a quote is read and the anchor is
  older than the TTL. No new cron (Vercel Hobby caps cron at once-per-day). Re-anchoring only
  changes odds offered on *future* bets; locked bets are untouched, so this is pure quote
  maintenance with zero settlement coupling (fixes CEO Finding 6).

### Bounded house exposure

Per-market net exposure = `max(Σ YES payouts − Σ stakes, Σ NO payouts − Σ stakes)`. Enforce a
**per-market exposure cap** (virtual pesos): a bet that would push net exposure past the cap is
rejected (or, later, the odds widen as exposure grows). Plus a per-user per-market stake cap.
Caps are sized for UX first, not GGR realism (fixes CEO Finding 5). All virtual currency — no
real-money risk.

## Architecture

```
                         ┌────────────────────────────┐
   Polymarket feed ─────▶│ mirror_prices (existing)   │
   (lib/oracle/*)        │  lazy 10-min TTL refresh    │
                         └─────────────┬──────────────┘
                                       │ reference p
                                       ▼
  ┌─────────────┐   bet stake   ┌──────────────────┐   read/anchor    ┌──────────────────┐
  │ Landing UI  │──────────────▶│ POST /api/markets │─────────────────▶│ market_book      │
  │ (binary     │  YES/NO, ₱S   │  /[id]/bet        │  (p, margin,     │  (one row/market)│
  │  cards)     │◀──────────────│                   │◀──── exposure)   │                  │
  └─────────────┘  payout odds  └────────┬──────────┘                  └──────────────────┘
                                         │ debit virtual_balance,
                                         │ insert position (locked odds)
                                         ▼
                                ┌──────────────────┐         ┌──────────────────┐
                                │ positions        │         │ profiles         │
                                │ (stake,mult,side)│         │ (virtual_balance)│
                                └──────────────────┘         └──────────────────┘

  Settlement: /api/ops/resolve (existing) or Polymarket-resolved →
              pay stake·multiplier to winning side, book house hold via GGR (migration 007).
```

### Components (each isolated, independently testable)

1. **`lib/mm/odds.ts`** — pure math, zero IO. `multipliers(p, margin)`, `payout(stake, mult)`,
   `anchorPrice(reference, prior)`, `wouldBreachCap(book, side, stake, mult, cap)`. This is
   where correctness lives; fully unit-tested.
2. **Migration 012 — `market_book`** — one row per binary market: `market_id` (FK markets),
   `p numeric`, `margin numeric`, `anchored_at timestamptz`, `exposure_yes int`,
   `exposure_no int`, `cap int`. Plus **`positions`** — `id`, `user_id`, `device_id`,
   `market_id`, `side ('yes'|'no')`, `stake int`, `multiplier numeric`, `potential_payout int`,
   `status ('open'|'settled'|'void')`, `payout int`, `created_at`, `settled_at`.
3. **`lib/mm/engine.ts`** — server-only: load `market_book` (row-locked), lazy-anchor `p` if
   stale, compute locked multiplier via `odds.ts`, check exposure cap, debit balance, insert
   position, bump exposure — **atomically** in one Postgres transaction/RPC. Never the
   best-effort debit-then-insert the `/api/cards` comment warns about.
4. **`POST /api/markets/[id]/bet`** — Auth: Supabase session (authed users debit real
   `virtual_balance`; mirror `/api/cards` posture; anon = client free-play). Body
   `{ side, stakePhp }`. Returns locked multiplier, potential payout, new balance.
5. **`GET /api/markets/[id]/quote`** — current `p`, both multipliers, remaining exposure
   headroom. Lazy-anchored on read (reuses `selectSlugsToRefresh` TTL idea).
6. **Settlement** — extend `/api/ops/resolve`: pay `potential_payout` to winning side, mark
   positions `settled`, write GGR `hold`. Idempotent (double-resolve is a no-op). Market `void`
   path (Polymarket cancels / no resolution) refunds stakes — reuse existing cancel-refund.
7. **UI** — binary card gains YES/NO bet control showing the live multiplier + a "My bets" list.
   (Detail flagged for design review.)

## Data flow (a single bet)

1. User taps "YES — pays 1.85× — bet ₱20" → `POST /api/markets/<id>/bet {side:'yes', stakePhp:20}`.
2. Engine row-locks `market_book`; if `anchored_at` older than TTL, re-anchor `p` from
   `mirror_prices` first (changes only future odds).
3. `odds.multipliers(p, margin)` → lock `multiplier_yes`; `potential_payout = 20 · mult`.
4. `wouldBreachCap` check → reject 409 if this bet exceeds the market's exposure cap.
5. Transaction: debit `virtual_balance` by 20 (402 if insufficient), insert `positions` row with
   the locked multiplier, increment `exposure_yes`. All-or-nothing.
6. Response: locked multiplier, potential payout, new balance. UI confirms the bet.

## Error handling

- Insufficient balance → 402 (same shape as `/api/cards`).
- Exposure cap breached → 409 with current headroom (so UI can offer a smaller stake).
- Polymarket reference unavailable → keep last anchored `p`, mark quote `is_stale` like
  `mirror_prices`. Betting still works at last-known odds.
- Concurrent bets on one market → `SELECT market_book ... FOR UPDATE` serializes exposure
  updates. No oversell past the cap.
- Market closed (`markets.closes_at` passed) → reject new bets, allow settlement.
- Anchor guard `p ∈ [ε, 1−ε]` so multipliers never blow up / divide by zero.

## Testing

- `lib/mm/odds.test.ts` — `multiplier_yes` and `multiplier_no` reflect margin (overround sums
  to >1 by exactly `m`); payout rounding; `anchorPrice` clamps to `[ε,1−ε]`; `wouldBreachCap`
  boundary (exact-cap allowed, cap+1 rejected); locked multiplier independent of later `p`.
- `lib/mm/engine.test.ts` — atomicity (balance + position + exposure move together or not at
  all), 402 insufficient-balance, 409 cap breach, stale-anchor lazy refresh, `FOR UPDATE`
  serialization prevents oversell under concurrency.
- Settlement test — winning side paid `stake·multiplier`, GGR `hold = Σstake − Σpayout` correct,
  idempotent double-resolve, `void` refunds stakes.

## Rejected alternative — LMSR

A Logarithmic Market Scoring Rule AMM (moving share price, `cost = b·ln(Σe^(q/b))`, max loss
`b·ln(2)`) was the first draft. Rejected at the CEO premise gate: a moving probability price is
illegible to the validated masa audience (instant-gratification, fixed-odds mental model from
local betting), it adds a share-quantity model and curve math the house-banked GGR accounting
doesn't need (violates DRY/explicit-over-clever), and it buys only "the price moves" — which the
review judged a non-benefit for this audience. Fixed-odds solves cold start identically.

## Open decisions (for /autoplan to surface)

- **D-mech: fixed-odds house book vs LMSR.** AUTO-DECIDED → fixed-odds (P3/P4/P5 + CEO review).
  Surfaced at final gate because the original draft specified LMSR-flavored. Reversible: the
  `odds.ts`/`engine.ts` split keeps the pricing function swappable if a moving market is later
  validated.
- **D-money: virtual vs real.** Recommend virtual (matches Phase 0). NB CEO Finding 7 — confirm
  with counsel that a fixed-odds prediction interface is covered by the existing PAGCOR clearance
  before any real-money move.
- **D-margin: house overround.** Recommend `m = 5%` to start; tune with volume.
- **D-cap: per-market exposure + per-user stake caps.** Recommend sizing for UX (cap large enough
  that realistic bets fill); virtual currency means the cap is a UX dial, not a risk limit.
- **D-demand (CEO Finding 1, deferred not dismissed):** instrument bet-button tap-rate vs `/hits`
  from day one so we learn whether demand or liquidity was the real constraint.

---
<!-- AUTONOMOUS DECISION LOG -->
## CEO Review (Phase 1) — [subagent-only], Codex unavailable (usage limit)

**Consensus table (single voice):**

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Premises valid? | NO (demand vs liquidity) | n/a | user-confirmed: liquidity IS the constraint |
| Right problem? | Challenged | n/a | user override: yes |
| Scope calibrated? | Over-built (LMSR) | n/a | reduced → fixed-odds |
| Alternatives explored? | NO (fixed-odds/synthetic dismissed) | n/a | added to plan |
| Competitive/regulatory risk covered? | NO | n/a | flagged (PAGCOR, Polymarket) |
| 6-month trajectory sound? | At risk | n/a | gated on demand instrumentation |

**NOT in scope:** real money, order book, multi-outcome markets, auto-resolution of
arbitrary markets, cross-operator routing.

**What already exists (leverage map):** Polymarket reference + lazy-refresh (`lib/oracle/*`,
`mirror_prices`, `/api/prices`); house-banked GGR accounting (`hold_amount`, migration 007);
binary market catalog (`markets`, migration 009); cancel-refund + ops resolve (`/api/ops/resolve`);
balance debit posture (`/api/cards`).

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Premise: liquidity (cold start) is the binding constraint | PREMISE GATE | user override | Founder confirms no liquidity yet; MM is the solution | "demand is the constraint" (model) |
| 2 | CEO | Mechanism = fixed-odds house book | TASTE (→ final gate) | P3,P4,P5 + CEO | Masa-legible "pays 1.85×"; reuses GGR; no curve math | LMSR moving-price AMM |
| 3 | CEO | Virtual currency only | mechanical | P6 | Matches Phase 0; defer real-money to counsel | real money |
| 4 | CEO | Book anchor moves as future-odds only, not in trade txn | mechanical | P5 | Removes settlement-integrity coupling (Finding 6) | anchor delta inside trade txn |
| 5 | CEO | Add demand instrumentation (tap-rate vs /hits) | mechanical | P1 | Learn if demand was real constraint without blocking | drop the concern |

---
## Design Review (Phase 2) — [subagent-only]

Litmus scorecard (single voice): 2 CRITICAL, 5 HIGH, 4 MEDIUM — all UI-layer. Backend judged
sound and reuse-correct. Verdict: do not build the frontend against "flagged for design
review"; the UI spec below resolves it.

| Dimension | Claude | Consensus |
|---|---|---|
| Information hierarchy right for masa? | NO (odds-first) | fix → prize-first |
| Interaction states specified? | NO (4/7 errors, all card states missing) | fix → full state list |
| Emotional arc / horizon fit? | NO (delayed-resolution) | taste → D-horizon |
| Specificity (real UI vs hand-wave)? | NO (one sentence) | fix → UI spec written |

## UI Spec (resolves Design F1, F4–F11)

**Binary card — 3 states:** (1) *open, no user bet* → question + two side buttons, each showing
**prize-first** copy "Win ₱37" (default ₱20 stake) with "1.85×" as fine print; (2) *user has open
bet* → show their position (side, stake, potential payout, status) instead of a second input;
(3) *closed/settled* → grayed, shows outcome + the user's win/loss.

**Bet flow:** tap side → bottom-sheet confirm showing "Bet ₱20 on YES → Win ₱37". Stake input =
**quick-tap chips** ₱10/₱20/₱50/₱100 + custom fallback. Quote is fetched fresh on sheet open; if
odds changed since tap, show "odds updated — confirm again" banner. **Confirm** is the POST
trigger, never the first tap. Win → confetti + payout toast (next app open if resolved offline).

**Error UI:** 402 → "Not enough coins" + disabled confirm; 409 → "Only ₱{headroom} left on this
market — bet that?" one-shot (no auto-retry loop); closed → grayed buttons + "Betting closed";
stale → small "odds may be delayed" tag, betting still allowed.

**My bets:** dedicated list (route or sheet), all markets, sorted soonest-resolution; row =
market, side, stake, potential payout, status; empty state nudges first bet; settled rows show
payout + win/loss treatment; header running total (open stake / winnings).

**Anon:** bet control shows "Sign in to bet" CTA (ties to Eng F2 policy A) — no anon server bet.

## Eng Review (Phase 3) — [subagent-only]

| Dimension | Claude | Consensus |
|---|---|---|
| Architecture sound? | YES (odds/engine/schema split good) | confirmed |
| Atomicity achievable as written? | NO (Supabase JS = discrete REST, no txn/FOR UPDATE) | fix → Postgres RPC |
| Settlement venue correct? | NO (/api/ops/resolve is event-cell path) | fix → separate route |
| Migration safe? | NO (no backfill for existing markets) | fix → backfill + trigger |
| Concurrency/idempotency? | At risk | fix → RPC WHERE status='open' |
| Rounding/overflow? | At risk | fix → floor + min stake + guard |

### Eng fixes folded into the build (auto-decided, mechanical)

- **Atomicity (F1, CRITICAL):** `place_bet(p_market_id,p_user_id,p_side,p_stake)` `SECURITY
  DEFINER` plpgsql RPC in migration 012 — `SELECT … market_book FOR UPDATE`, check
  closes_at/status, compute multiplier, check cap + balance, debit, insert position, bump
  exposure, all in one txn. `engine.ts` is a thin `supabase.rpc()` wrapper. Same pattern
  `/api/cards:226-231` says Phase 1 needs.
- **Anon policy (F2, CRITICAL):** **Option A** — server bet endpoint requires a Supabase
  session (401 otherwise); anon UI shows "Sign in to bet". No anon writes to `market_book`, no
  third balance store. (Surfaced as taste D-anon.)
- **Anchor split (F3):** lazy-anchor only in `GET …/quote` (reuse `/api/prices`); `place_bet`
  reads already-anchored `p`, never fetches Polymarket under lock. Aligns data flow with audit
  decision 4.
- **Settlement (F4):** new `POST /api/ops/markets/[id]/resolve` `{outcome:'yes'|'no'|'void'}` →
  RPC settles positions, credits winners, books `positions.hold_amount`, closes book; void
  refunds. `positions` gets `hold_amount int` + `operator_id` + `positions_ggr_idx`.
- **Rounding (F5):** `Math.floor` payouts (bookmaker convention), min stake ₱10, payout overflow
  guard ≤ 10× cap.
- **Backfill (F6):** migration 012 seeds `market_book` for existing approved/live binary markets
  from `payload.fallback_pct`; `AFTER INSERT/UPDATE` trigger seeds future approvals.
- **Idempotency (F7):** settle RPC uses `UPDATE positions … WHERE status='open' RETURNING` as the
  guard. **Constraints (F8):** CHECK `p∈(0,1)`, `margin∈[0,1)`, exposure≥0, cap>0.
- **Slug join (F9):** denormalize `polymarket_slug` onto `market_book` at backfill; anchor calls
  existing `/api/prices?events=<slug>`. **(F10)** 409 headroom is one-shot, no retry loop.
- **GGR (F12):** `positions_ggr_idx(operator_id,settled_at)`; flag `/api/ops/ggr` to UNION cards
  + positions. **(F13)** `market_id uuid … ON DELETE RESTRICT`. **(F14)** closes_at checked
  inside the RPC.

### NOT in scope (confirmed): real money, order book, multi-outcome, device-balance anon
free-play, auto-resolution of non-Polymarket markets.

Test plan artifact: `~/.gstack/projects/gerwinf-ph-prediction-market/gerwinf-cold-start-market-maker-test-plan-20260616-123705.md`

## Decision Audit Trail (Phase 2–3)

| # | Phase | Decision | Classification | Principle | Rationale |
|---|-------|----------|----------------|-----------|-----------|
| 6 | Eng | Atomicity via `place_bet` SECURITY DEFINER RPC | mechanical | P5 | Only way to get FOR UPDATE + txn via Supabase JS |
| 7 | Eng | Anon = "sign in to bet" (no server bet) | TASTE (→ gate) | P4,P5 | Avoids 3rd balance store + shared-cap contamination |
| 8 | Eng | Separate `/api/ops/markets/[id]/resolve` + positions.hold_amount | mechanical | P5 | /api/ops/resolve is the event-cell path |
| 9 | Eng | floor payouts + min stake ₱10 + overflow guard | mechanical | P1 | Prevents negative hold / int overflow |
| 10 | Eng | migration backfill + trigger for market_book | mechanical | P2 | Existing approved markets would 404 otherwise |
| 11 | Design | Prize-first "Win ₱37" framing, odds as fine print | TASTE (→ gate) | P1,P5 | Masa reads pesos, not 1.85× (/picks was too highbrow) |
| 12 | Design | Confirm bottom-sheet + quick-tap chips + win confetti | mechanical | P1 | Standard masa/BingoPlus pattern; prevents fat-finger |
| 13 | Design | Full state list (3 card states, 7 error/result states, My bets) | mechanical | P1 | Removes 30 implementer micro-decisions |

## GSTACK REVIEW REPORT

- **Mode:** autoplan, SELECTIVE EXPANSION, single-voice (Codex unavailable — usage limit).
- **Phases run:** CEO ✓, Design ✓ (UI scope), Eng ✓. DX skipped (no developer-facing surface).
- **Premise gate:** PASSED — founder confirmed liquidity/cold-start is the binding constraint.
- **Findings:** CEO 9 · Design 11 · Eng 14. Mechanical fixes folded in; 4 taste decisions → final gate.
- **Status:** issues_open until the 4 taste decisions are resolved at the gate.
