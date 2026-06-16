# Hedge Engine + Polymarket Integration — Design (Sub-project #1)

Branch: `gerwinf/cold-start-market-maker`
Date: 2026-06-16
Status: ON HOLD / DEFERRED (2026-06-16) — eng-reviewed and ready, but blocked by PH regulatory
reality: real-money prediction markets are not licensable in the PH short-term, and PAGCOR has
ordered Polymarket blocked. Revive only for a different jurisdiction or a counsel-approved
offshore/treasury structure. The shippable PH path is the virtual-currency fixed-odds bot
(`2026-06-16-cold-start-market-maker-design.md`). Eng review (async hedge queue, F1/F2 fixes)
preserved below for when this is picked back up.
Parent: hedged-CLOB direction (supersedes `2026-06-16-cold-start-market-maker-design.md`)

## Context

We are building a peso-denominated prediction market whose cold-start liquidity comes from a
**bot that mirrors Polymarket and hedges every user fill** (riskless principal — Stefan/Gnosis
model). This spec covers **only sub-project #1: the hedge engine + Polymarket integration** —
the riskiest, most foundational piece. The CLOB matching engine (#2), custody/cash-in-out (#3),
and UX (#4) are separate specs that depend on this one.

The hedge engine's job: keep the house's directional risk ~zero by laying off each user fill on
Polymarket, and feed the CLOB the prices/sizes it is allowed to quote ("only quote what you can
hedge").

### Grounded Polymarket facts (verified 2026-06-16)

- **Geo:** Philippines is NOT blocked (official geoblock doc). Blocked: US, UK, FR, DE, IT, NL,
  AU; close-only: SG, TH, TW; JP UI-restricted. **Orders from blocked IPs are rejected** → the
  hedger must run from an allowed region (NOT US/EU data centers).
- **Client:** `@polymarket/clob-client` (TypeScript) — fits our stack, no Python service.
- **Auth/custody:** Polygon (chain 137) hot wallet private key holding **USDC**; EIP-712 L1 →
  derived L2 (HMAC apiKey/secret/passphrase); every order is EIP-712 signed.
- **Fees:** ~0 except 15-minute crypto markets (taker fee there only, rebated to makers). Orders
  are limit; cross the spread for immediate (taker) execution; Post-Only avoids taker fees.
- **Min size:** each market exposes `minimum_order_size` — small peso bets may be individually
  un-hedgeable.
- **Feed:** market-channel **websocket** for live book (best bid/ask + depth).
- **KYC:** tightening for high volume — a compliance task on the wallet, not code.

## Goals

1. For any market we make, know in real time whether a given user fill is **hedgeable** (depth ≥
   size at a price that preserves our spread, ≥ `minimum_order_size`).
2. On a user fill, **lay off the offsetting position on Polymarket** and record the hedge
   (price, size, fees, tx) linked 1:1 to the user position.
3. Keep the house's net directional exposure within a hard bound at all times; on any hedge
   failure/slippage past the buffer, **pull quotes and alert** (circuit breaker).
4. Expose a clean interface to the CLOB (#2): `quotableSize(market, side) → {price, maxSize}`
   and `hedge(fill) → HedgeResult`.
5. Never lose or expose the wallet private key.

## Non-Goals (separate sub-projects)

- The CLOB matching engine, user balances, order book (sub-project #2).
- Peso custody, GCash/Maya cash-in, peso↔USDC FX, AML/KYC of end users (#3).
- End-user UX (#4).
- On-chain USDC bridging / wallet funding / Polymarket KYC of the house wallet (operational,
  manual, owner-run).

## Milestone 1 — Feasibility spike (go/no-go gate, BEFORE the full engine)

A throwaway script run from an allowed-region host against a wallet funded with a small USDC
amount (owner-provided). It must:

1. Authenticate (`@polymarket/clob-client`: L1 → derive L2).
2. Read the live book for one curated market (e.g. `wc-argentina`'s YES `tokenId`).
3. Place one small **marketable** order, confirm the fill, read the resulting position + USDC
   delta.
4. Cancel/return; print: quote→fill **latency**, **actual fee**, **`minimum_order_size`**, and
   confirmation that execution from our host region is accepted.

**Output:** real numbers + a go/no-go. If latency or min-size make the hedge loop uneconomic,
the engine design changes before we build it. This is the one place we touch real money in this
sub-project.

## The riskless-principal loop (core invariant)

**Chosen (D-loop2 resolved): async hedge queue + reservation + buffered + circuit breaker.**
Perfect cross-system atomicity (our DB + Polymarket) is impossible, so we accept the fill
instantly and bound the risk:

- The engine continuously computes, per market+side, the **max size and price it can hedge right
  now** from the live Polymarket book, minus a **spread buffer** (formula in `book.ts`, seeded
  from spike-measured slippage), and minus the **`pendingHedgeSize` reservation** (in-flight
  hedges not yet confirmed — F1 fix). `quotableSize = bookDepth − pendingHedgeSize − bufferRoom`.
  The CLOB only posts maker quotes within that envelope.
- When a user takes our quote, the fill is **accepted instantly** (one-tap UX) and a hedge is
  **enqueued**; `pendingHedgeSize` is incremented immediately so concurrent fills can't double-
  spend the same depth.
- An async worker drains the queue at ≤ Polymarket's documented rate limit (F12), two-phase-
  writes each hedge (`placing` → `clientOrderId` → `filled`, F2), and decrements
  `pendingHedgeSize` on confirm.
- If a hedge **slips past the buffer, partials, or fails** → flag `hedge_breach`, **pull all
  quotes** (circuit breaker), alert an operator. Loss is bounded by buffer × outstanding +
  reservation slack.

Rejected: synchronous hedge-then-confirm (the bet waits on the Polymarket round-trip) — adds
200–800ms+ per bet and trips false-positive breakers under bursts. The async queue gives instant
UX with bounded, alerted risk and natural rate-limit backpressure.

## Architecture

```
   Polymarket CLOB ──ws book──▶ ┌──────────────────┐  quotableSize()  ┌──────────────┐
   (clob-client,    ──REST────▶ │  Hedge Engine    │─────────────────▶│  CLOB (#2)   │
    Polygon wallet)  orders     │  (allowed region)│◀──── hedge(fill) │              │
                                └────────┬─────────┘                  └──────────────┘
                                         │ writes
                          ┌──────────────┴───────────────┐
                          ▼              ▼                ▼
                   market_map      hedge_orders      wallet_state
                   (our mkt ↔      (1:1 to user      (USDC + open
                    tokenIds)       position)         positions)
```

### Components (each isolated, testable)

1. **`lib/hedge/polymarket-client.ts`** — thin wrapper over `@polymarket/clob-client`: auth,
   `getBook(tokenId)`, `placeOrder(tokenId, side, size, price)`, `getFills(orderId)`. All network
   IO isolated here so the rest is testable with a fake.
2. **`lib/hedge/book.ts`** — pure: maintain best-bid/ask + depth from ws deltas; `hedgeableSize
   (book, side, buffer, minSize) → {price, maxSize}`; `wouldPreserveSpread(ourPrice, hedgePrice,
   buffer)`. Zero IO — this is where correctness lives, fully unit-tested.
3. **`lib/hedge/engine.ts`** — orchestration: subscribe ws, keep per-market hedgeable envelope,
   `quotableSize()`, `hedge(fill)` (place + confirm + record or trip breaker), circuit-breaker
   state.
4. **`lib/hedge/wallet.ts`** — track USDC balance + open Polymarket positions + capital headroom;
   refuse to quote beyond headroom.
5. **Data model (Postgres, new migration):**
   - `market_map(our_market_id uuid, polymarket_token_yes text, polymarket_token_no text,
     min_order_size numeric, updated_at)`.
   - `hedge_orders(id, user_position_id, our_market_id, side, size, our_price, hedge_price,
     hedge_fee, polymarket_order_id, status('placed'|'filled'|'partial'|'failed'|'breach'),
     created_at, filled_at)`.
   - `hedge_engine_state(market_id, breaker_open boolean, reason text, updated_at)` and a
     `wallet_snapshots(ts, usdc_balance, open_exposure_usd)` audit trail.
6. **Service host:** a small always-on worker (NOT Vercel function) in an allowed region holding
   the Polygon key via a secrets manager; talks to Supabase over the service-role key.

## Interface to the CLOB (#2)

```typescript
// quotableSize: what the CLOB is allowed to post right now for a market+side.
quotableSize(marketId: string, side: 'yes' | 'no'): { price: number; maxSize: number }
// enqueueHedge: called when a user takes a CLOB quote. Reserves depth and returns immediately
//   (the user fill is already accepted). The async worker hedges in the background and updates
//   hedge_orders.status; on breach it trips the breaker + alerts (the position is flagged, not
//   silently dropped). The UI can subscribe to hedge_orders for a "hedge confirmed" signal.
enqueueHedge(fill: { marketId: string; side: 'yes' | 'no'; size: number; userPositionId: string })
  : { reserved: true } | { reserved: false; reason: 'min_size' | 'no_depth' | 'breaker_open' }
```

## Error handling

- **ws disconnect / stale book** → mark book stale, set `quotableSize` to 0 (don't quote on stale
  data), reconnect with backoff.
- **Hedge partial/slip/fail** → `hedge_breach`, trip the market's breaker, pull quotes, alert.
- **Wallet headroom exhausted** → `quotableSize` returns 0 until USDC frees up.
- **Geo rejection / auth failure** → engine refuses to start; loud startup error (we are in a
  blocked region or creds are wrong).
- **min_order_size** → fills below it are not hedgeable individually → `quotableSize` floors at
  it (CLOB enforces a min user bet) OR a later netting layer aggregates (out of scope here).
- **Polygon/USDC settlement lag** → the order-book fill is the hedge confirmation; on-chain
  settlement is tracked but does not block the user fill.

## Security

- The Polygon **private key never touches the Vercel app or the browser**. It lives only in the
  hedger's secrets manager. The CLOB (#2) calls the engine over an internal authenticated channel.
- L2 creds derived at runtime; rotate on compromise. Wallet holds only working capital, topped up
  as needed (limit blast radius).

## Testing

- `lib/hedge/book.test.ts` — pure: `hedgeableSize` respects depth, buffer, and min_order_size;
  `wouldPreserveSpread` boundary; stale book → 0; partial-depth → clamped size.
- `lib/hedge/engine.test.ts` — with a fake polymarket-client: happy hedge records 1:1; slip past
  buffer trips breaker + pulls quotes; ws disconnect zeroes quotableSize; headroom exhaustion.
- Spike script is manual (real money) — its output is recorded numbers, not an automated test.

## Open risks (for review)

- **R1:** Cross-system race in the buffered loop — is the buffer + breaker bound acceptable, or
  does a subset of markets need synchronous hedging?
- **R2:** Host region durability — if our allowed-region host's IP gets caught in a VPN/geo
  sweep, the engine dies. Need a fallback region + monitoring.
- **R3:** min_order_size vs masa bet sizes — if Polymarket mins exceed typical ₱20 bets, we need
  netting/aggregation (deferred) or a higher min user bet.
- **R4:** KYC escalation on volume could freeze the wallet mid-operation — needs an operational
  runbook + balance limits.
- **R5:** Key custody is the single largest blast radius — a leaked key drains working capital.

---
## Eng Review (autoplan, single-voice — Codex rate-limited) — 2026-06-16

Verdict: sound direction, but the cross-system seams were under-specified. **2 CRITICAL blockers,
6 HIGH, 4 MEDIUM.** One architecture decision (sync vs async hedge) reshapes the engine and is
surfaced below; the rest are folded in as fixes.

| Dimension | Finding | Consensus |
|---|---|---|
| Concurrency correct? | NO — F1 concurrent fills double-spend same depth (no reservation) | fix → reservation counter |
| Crash-safe? | NO — F2 orphaned hedges, no idempotency key | fix → two-phase write + clientOrderId |
| Loop model right? | DECISION — F4 sync hedge() blocks the bet, contradicts UX | → D-loop2 (async queue) |
| Risk bound real? | NO — F5 buffer asserted not derived | fix → buffer formula from spike |
| Custody safe? | AT RISK — F6 no cap, internal channel unauthenticated | fix → cap + mTLS/HMAC |
| Data model sound? | NO — F7 missing 'placing' state, FK, token liveness | fix → schema additions |

### Fixes folded into the design (mechanical, auto-decided)

- **F1 (CRITICAL) reservation:** engine keeps an in-memory `pendingHedgeSize` per market+side.
  `quotableSize = bookDepth − pendingHedgeSize`. `hedge()` increments before placing, decrements
  on confirm. Kills the TOCTOU double-spend of the same Polymarket depth.
- **F2 (CRITICAL) two-phase write + idempotency:** before the Polymarket call, INSERT
  `hedge_orders(status='placing')` → its id is the `clientOrderId` sent to Polymarket → on return
  UPDATE to `placed`/`filled`. On startup, reconcile every `placing` row by querying Polymarket by
  `clientOrderId` (found → fill; not found → cancel/fail). No orphaned real-USDC orders.
- **F3 breaker durability:** startup loads all `breaker_open=true` from `hedge_engine_state` BEFORE
  serving `quotableSize()`. Add a startup test.
- **F5 buffer formula:** `buffer = max(measured_slippage × safety, min_fee) + FX_spread`, a hard
  constant in `book.ts`, seeded from the spike's measured slippage. The claimed loss bound is only
  valid once measured.
- **F6 custody:** explicit per-hour hedge-volume cap in the engine (not just headroom); internal
  CLOB→engine channel uses mTLS or HMAC + timestamp/nonce (replay-proof); runbook separates L1
  (wallet drain — HSM/Safe with daily limit) from L2 (rotate HMAC) compromise.
- **F7 data model:** add `status='placing'`; `CHECK` on status; FK `user_position_id →
  positions.id`; `market_map.token_active` + `last_verified_at` (+ a verify cron); `UNIQUE(ts)` on
  wallet_snapshots; index + UNIQUE on `hedge_orders(user_position_id)`.
- **F8 stale book:** `STALE_BOOK_MS` heartbeat in `engine.ts` (interval checks
  `now − lastUpdateAt`); a live-but-frozen ws zeroes quotableSize. Fake-clock test.
- **F10 settlement reconciliation:** post-resolution job ties each market's `hedge_orders` to the
  Polymarket tokenId outcome → `settlement_reconciliation(expected_pnl, actual_pnl, discrepancy)`;
  alert on non-zero. Audit/regulatory requirement.
- **F11 min-size gate:** the spike measures real `minimum_order_size`; **go/no-go gate**: if
  `min_order_size × FX > ₱100`, netting/aggregation must be designed before the full build (not
  deferred indefinitely).
- **F12 rate limits:** the async hedge queue (D-loop2) drains at ≤ Polymarket's documented req/s,
  so a burst queues instead of tripping a false-positive breaker.
- **F9 spike scope:** extend Milestone 1 to also test — 2 simultaneous orders (rate-limit
  behavior), an oversized order (partial-fill response shape), `clientOrderId` round-trip, and a
  crash-after-place-then-reconcile. Only then is the go/no-go credible. (If `clientOrderId` is
  unsupported by the SDK, F2 has no fix without forking — this is a gating spike result.)

### D-loop2 — RESOLVED → async hedge queue (user decision, 2026-06-16)
Async hedge queue chosen over synchronous `hedge()`: accept the fill instantly, hedge in the
background with reservation + two-phase write + breaker. Resolves F1, F2, and F12 at once and
matches the "instant one-tap" UX. Accepted cost: a slightly larger unhedged window (bounded by
reservation + buffer + breaker) and a hedge-status the UI may surface. Folded into the loop +
interface sections above.

### Decision Audit Trail (eng)
| # | Decision | Class | Rationale |
|---|----------|-------|-----------|
| 1 | Reservation counter (pendingHedgeSize) | mechanical | Only way to stop concurrent depth double-spend (F1) |
| 2 | Two-phase write + clientOrderId idempotency | mechanical | Crash-safe; no orphaned real-USDC hedges (F2) |
| 3 | Buffer = formula seeded from spike slippage | mechanical | Makes the loss bound real, not asserted (F5) |
| 4 | Per-hour cap + authenticated internal channel | mechanical | Bounds custody blast radius (F6) |
| 5 | Async hedge queue vs sync hedge() | TASTE (→ user) | Reshapes engine + CLOB interface (F4/D-loop2) |

## GSTACK REVIEW REPORT
- **Mode:** autoplan eng review only, single-voice (Codex rate-limited until Jul 7).
- **Findings:** 2 CRITICAL, 6 HIGH, 4 MEDIUM — all folded except D-loop2 (user decision).
- **Status:** issues_open — blocked on D-loop2 + the extended feasibility spike (esp. clientOrderId support).
