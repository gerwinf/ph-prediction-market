# /hits parimutuel migration — engine + UI (one workstream)

Date: 2026-07-07
Source: Hula Spec Brief (July 2026), §3.1 Hits + review decisions (win-modal
Option B, consolation interpretation Y, pending-winnings state, rollover
moment, reserve-seeding mechanism, no shill cards, in-app disclosure,
server-issued card ids as P0).

Engine and UI are ONE workstream: the engine's allocation function is also the
UI's live estimator, so the data model and the display contract are designed
together and cannot drift.

## Problem

/hits today is a fixed-odds house book: multipliers (row/col 5×, diag 10×,
full 250×) are guaranteed payouts, credited instantly on pattern detection
(`/api/cards/[id]/won`), with `hold_amount = price − payout` as house P&L.
The spec brief defines Hits as **parimutuel**: winners split a pool of
`(1−h)·vT` (h = 6% takeout) plus rollover; published multipliers are **hard
caps**, surplus rolls to the next game, and the operator bears **zero payout
variance**. Migrating changes settlement timing (pattern-hit → fixture
retirement) and payout semantics (guarantee → capped pool share), both of
which leak into the UI.

## Scope split: live fixtures only

Parimutuel applies to cards bound to a real fixture (`?live=1`). The DEMO card
(client-local sim, free-play) keeps its current instant fixed-odds behavior —
it is a toy, has no treasury, and its instant gratification is the acquisition
hook. All pool/pending/rollover UX below is live-mode only.

## Engine

### Allocation (the core function — also the live estimator)

Because a winner's cap equals its claim weight (`cap_i = w_i = mult_i ×
stake_i`), capped proportional allocation collapses to a closed form — no
iterative water-filling:

```
P  = (1−h)·vT + R          // vT: game's card sales; R: rollover reserve balance
W  = Σ w_i                  // over all winning cards
u  = min(1, P / W)          // uniform payout fraction
pay_i = w_i · u             // every winner gets the same fraction of its cap
surplus = P − Σ pay_i  →  reserve (includes the no-winner case: W = 0 → all of P)
```

Claim weight per card = its single highest satisfied tier (non-additive):
full 250×, diag 10×, row/col 5×, **consolation (interpretation Y): w = (# lit
non-free cells) × stake × 1** for cards with ≥1 lit cell and no pattern.
Y over X (flat 1× for any lit cell) because it is the only reading consistent
with "multipliers define relative claim weights" and avoids the 1-cell ≡
23-cell cliff. When the reserve is healthy, `u = 1` and every winner receives
exactly its cap — the seeded launch period *feels* fixed-odds.

Cancelled/postponed fixture: full refund (`pay_i = stake_i`, no takeout, no
reserve draw) — matches spec §3.

`allocate(winners, vT, R)` is a pure function in `lib/hits/pool.ts`,
unit-tested (u=1, u<1, W=0 rollover-all, refund, consolation weights, fee
splits) and reused verbatim by the estimator.

### Rollover reserve (global, persistent)

New table `pool_reserve_ledger`: `(id, source ∈ {seed, rollover_in,
payout_draw, refund_back}, amount_php, match_id nullable, created_at)`.
Reserve balance = SUM(amount). Seeding (decisions as given):

- Seed **only** into the reserve — behaves exactly like rollover from phantom
  prior games; per-game mechanics never see an operator injection.
- Config (`lib/hits/pool-config.ts` or env): `ROLLOVER_SEED_LAUNCH = ₱500,000`,
  `ROLLOVER_SEED_MONTHLY = ₱200,000`, `ROLLOVER_SEED_SUNSET = <date, +3
  months>`. Automated top-up rides the existing `maintain-catalog` cron;
  ledger rows carry `source='seed'`. Post-sunset: purely organic.
- **No shill cards, ever** — operator never buys cards; that would recreate
  the payout variance parimutuel exists to eliminate.

### Settlement at retirement

Hooks the existing status flip (`fixtureStatusFromTimeline → 'final'`, or ops
via `/api/ops/fixture-status`): a settlement pass loads the fixture's cards,
recomputes hits server-side (stored `cells` ∩ fired `event_keys` — existing
logic), runs `allocate`, then atomically: writes `score`/`win_pattern`/
`settled_at` per card, credits authed balances, posts reserve ledger rows
(draw + surplus), and writes one `pool_settlements` summary row `(match_id,
pool_php, reserve_drawn, surplus_to_reserve, winners, settled_at)` — the UI's
rollover-moment data. Idempotent (settled fixtures skip). Fee split recorded
per spec §4: `φ0 = h·vT`, 15% PAGCOR share / 85% operator margin.

`/api/cards/[id]/won` stops crediting: it records the claim (analytics +
ticker) and returns `{ pending: true, estPhp }`. Anon localStorage credit
moves to settlement-poll time on the card page.

**Settlement triggers (CEO review 1A):** the lazy status flip alone is not a
reliable trigger — it only runs while a card page is polling. Settlement must
be inevitable: (1) **settle-on-read catch-up** — any `/api/events` or
`/api/fixtures/[id]` read that observes `final` + no `pool_settlements` row
triggers idempotent settlement (same table-is-the-cache pattern as prices and
the feed); (2) the `/api/ops/fixture-status` route settles when ops flips a
fixture final; (3) the daily `maintain-catalog` cron logs a `settlement_lag`
warning for any fixture final >1h without a settlement row. FIFA post-final
corrections (24h re-resolution window) re-enter through the ops route, which
may supersede a shadow settlement row (never a credited one without ops
confirmation).

**Settlement integrity (CEO review 2A):** `pool_settlements.match_id` carries
a UNIQUE constraint so concurrent triggers cannot double-settle (shadow output
is a single atomic insert). Phase-3 crediting (N balance updates + card rows +
ledger rows) MUST run as a single Postgres function (RPC) so the whole pass is
one transaction — Supabase's REST client cannot compose multi-statement
transactions, and a mid-pass crash would otherwise strand half-credited
players.

### Live estimate endpoint

`GET /api/hits/pool?match=<id>` → `{ poolPhp, reservePhp, jackpotPhp,
winners, settled, myCards: [{ id, tier, weight, estPhp }] }` (device/user
scoped), computed by running `allocate` over *current* winners. Card pages
poll it alongside `/api/events`; the binder uses it for pending chips.

### Server-issued card ids (P0 — ships first, independent of engine timing)

`POST /api/cards` ignores client-supplied ids for live fixtures and returns a
server-generated id; the client navigates to the returned id. Kills the
pick-your-board exploit (client generates ids locally until a dense board
appears). Demo cards may keep client ids (no economic surface). Share links
unaffected — the id remains the deterministic board seed.

Same commit (CEO review 3A): **server-side stake whitelist** — `pricePhp` must
be one of {20, 50}; anything else is 400. Stake is the claim weight under
parimutuel, so a client-claimed price is a pool-theft vector the moment money
is real. Both fixes are the same posture: the server stops trusting the client.

### Rollout

`match_fixtures.settlement_mode ∈ {'fixed','parimutuel'}` (default `'fixed'`).
Phase 1: engine + P0 ids behind the flag, settled in shadow (logged, not
credited) on one real fixture. Phase 2: UI below. Phase 3: default
`'parimutuel'` for new fixtures. Already-sold cards always settle under the
mode they were bought in (pool-freeze invariant extends to settlement mode).

## UI (all strings via the i18n dictionary, EN + TL)

1. **Payout tables** (landing + card page): amounts become "hanggang / up to
   ₱X"; add the consolation row; add a pool line — "Jackpot pool: ₱{jackpot}"
   (reserve + current game). Landing hero for a live/upcoming fixture shows
   the jackpot figure — the lotto hook.
2. **Win modal (Option B — live estimate)**: pattern celebration unchanged and
   instant; the amount reads "≈₱{est} *(est.)* · settles at final whistle" and
   updates from the pool endpoint while the game runs. Copy makes the cap a
   ceiling, never a promise. `card.payoutsNote` "credits instantly" → "pays at
   the final whistle" (live mode).
3. **Pending-winnings state**: balance and pending are visually separate —
   header: "₱2,340 · Pending: ≈₱140"; binder pockets on unsettled games show
   an amber "Pending ≈₱X" chip instead of the green ribbon (which becomes the
   settled state).
4. **Rollover moment**: when the settlement poll sees the fixture settle, the
   card page (and a binder banner) renders from `pool_settlements`: "Game
   over. ₱{surplus} rolled over → {next fixture} — jackpot now ₱{jackpot}."
   This is the retention beat that pays for the deferred-payout regression.
5. **About the pool** (linked from the jackpot display + FAQ): how the pool
   works (94% of card sales + rollover, caps, single highest tier), and the
   seed disclosure verbatim in spirit: "Hula seeds the pool with promotional
   funds during launch so payouts are meaningful. Seed contributions are
   non-refundable — they become winning payouts or roll to future games.
   Launch seed budget: ₱{budget} · ends {sunset}."

## Testing

- `lib/hits/pool.test.ts`: allocate() closed form (u=1, u<1, W=0, refunds,
  consolation-Y weights, fee split, surplus math — property: Σ payouts +
  surplus + φ0 == vT + R_drawn exactly, integer centavos).
- Settlement idempotency + shadow-mode parity test on the captured
  Mexico–England timeline (real winners distribution).
- Estimator ≡ allocator equivalence test (same function, same inputs).
- UI: estimate → settled transition, pending chip → ribbon, rollover banner
  (mocked pool endpoint).

## Out of scope

- Real-money deposits / PIGO gateway integration (platform launch concern).
- Order-book (§2) — separate product surface.
- Demo-card mechanics (explicitly unchanged).
- On-chain CTF settlement (spec footnote 2).

## Build order — reduced scope (CEO review, 2026-07-07)

Decided sequencing (leverage = expiry order: the WC settlement test bed dies
Jul 19, live content dies Jul 19, real-money UX has no date yet):

**BUILD NOW (the B slice):** server-issued ids + stake whitelist (P0, one
commit) · `allocate()` + tests · migrations (`pool_reserve_ledger`,
`pool_settlements` with UNIQUE(match_id), `settlement_mode` flag) · shadow
settlement with settle-on-read catch-up, ops trigger, and cron lag check —
shadow-run against the remaining WC knockout fixtures for real-data parity.

**DEFERRED (TODOS.md):** PBA live content pipeline (P1 — next workstream) ·
the five UI deltas + estimate endpoint + i18n (P2 — trigger: real-money date) ·
seeding automation + "About the pool" disclosure (P2 — bundled with UI phase).

## Parimutuel flip checklist (added 2026-07-07 post-shadow-launch)

### Phase A — pre-flip, running now (→ Jul 19)
- [x] Shadow settlement per finished fixture (automatic since #50; settle-on-read + ops + cron sweep)
- [x] Reserve seeded ₱500,000 (free-play simulation of the launch seed; double-seed guarded)
- [ ] Decide the consolation floor from accumulated shadow rows (spec-as-written 1×/lit-cell
      vs ≥3-cell floor) → `claimWeightCentavos` + spec amendment. Baseline: POR–ESP 39/39
      winners, u=0.179 unseeded.
- [ ] Validate seed burn rate: Σ `reserve_drawn` across shadow rows vs ₱500k + ₱200k/mo budget.
      (Shadow never depletes the ledger — burn is computed, not applied.)

### Trigger: operator deal sets a real-money date

### Phase B — engine (phase 3)
- [ ] `settle_parimutuel_credit` Postgres RPC — one transaction (contract in migration 013)
- [ ] `settle.ts` parimutuel path calls RPC + ledger write-back (payout_draw / rollover_in)
- [ ] `/api/cards/[id]/won` stops crediting → claim record + `{ pending, estPhp }`
- [ ] `GET /api/hits/pool?match=` estimate endpoint (allocate over current winners)
- [ ] Anon localStorage credit moves to settlement-poll time
- [ ] Seed top-up automation (config: monthly amount + sunset; rides maintain-catalog)
- [ ] `settlement_mode='parimutuel'` default for NEW fixtures only (purchase-time mode is frozen)

### Phase C — copy + UI (one PR; every string via the i18n dictionary, EN+TL)
- [ ] `card.payoutsNote`: "credit instantly" → "pays at the final whistle"
- [ ] Payout tables: "hanggang/up to ₱X" + consolation row + "Jackpot pool: ₱X" line
- [ ] Landing hero jackpot figure (reserve + current game pool)
- [ ] Win modal → live estimate ("≈₱X (est.) · settles at final whistle", polls pool endpoint)
- [ ] Pending-winnings state (header + amber binder chip → green ribbon at settlement)
- [ ] Rollover banner from `pool_settlements` ("₱X rolled over → next game — jackpot ₱Y")
- [ ] "About the pool" screen (mechanics, caps, seed budget + sunset, non-refundable)

### Phase D — verify before flipping the default
- [ ] Shadow-vs-credited parity on one staging fixture
- [ ] Conservation property on real data (centavo-exact)
- [ ] Rollback drill: new fixtures back to 'fixed'; in-flight parimutuel fixtures unaffected

Consciously NOT in the flip: real deposits (PIGO gateway surface), order book, on-chain.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_resolved | mode: SCOPE REDUCTION; 3 findings (2 critical gaps) — all accepted as recommended; 3 TODOs deferred |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | not run |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | n/a — UI deferred out of this slice |

- **UNRESOLVED:** 0
- **VERDICT:** CEO CLEARED (reduced scope locked: shadow engine + P0 now, PBA next, UI on real-money date) — eng review recommended before implementation.
