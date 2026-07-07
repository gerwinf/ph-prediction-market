# TODOS

Deferred work register. Each item carries enough context to pick up cold.

## P1 — PBA live content pipeline
- **What:** API-Basketball feed adapter (same vendor/pattern as the API-Football
  supplementary feed, #46), PBA event pools for /hits, Gilas + Governors' Cup
  fixture ingest.
- **Why:** The FIFA feed and all live /hits content die with the WC final on
  Jul 19; PBA is the launch sport per the Hula spec brief. Without this the
  product goes dark and demos badly during operator conversations.
- **Pros:** Product continuity; launch-sport alignment; reuses the proven
  feed→event-key→cells pipeline. **Cons:** Second paid sports-API dependency.
- **Context:** Decided as the workstream immediately after the parimutuel B
  slice (CEO review 2026-07-07, D1 = option B→C sequencing). Basketball tiles
  from v1 exist in lib/hits/events.ts; wc- feed dispatch pattern in
  lib/hits/feed-fifa.ts is the template.
- **Effort:** M (human) → S (CC). **Depends on:** nothing.

## P2 — Parimutuel UI phase (trigger: real-money date)
- **What:** The five UX deltas from the parimutuel spec ("up to ₱X" copy,
  pool/jackpot display, live-estimate win modal, pending-winnings chips,
  rollover-moment banner) + `GET /api/hits/pool` estimate endpoint + i18n
  strings (EN+TL).
- **Why:** Deferred because the seeded rollover reserve makes launch UX
  identical to today's fixed-odds feel (u=1 while seeded) — the UI only earns
  its build cost once real money has a date.
- **Context:** Full design in docs/superpowers/specs/2026-07-07-hits-parimutuel-design.md
  (UI section). Engine ships first in shadow; estimator = allocator.
- **Effort:** M (human) → S (CC). **Depends on:** B slice shipped; operator
  deal sets a real-money timeline.

## P2 — Reserve seeding automation + "About the pool" disclosure
- **What:** Automated rollover-reserve top-ups against config
  (₱500K launch, ₱200K/month, 3-month sunset), ledger rows source='seed',
  plus the disclosure screen (budget + sunset + non-refundable, linked from
  the jackpot display and FAQ).
- **Why:** Decided mechanism (reserve-only, never shill cards); meaningless
  before real users. Preempts the operator-manipulation narrative.
- **Effort:** S. **Depends on:** Parimutuel UI phase (ships together).
