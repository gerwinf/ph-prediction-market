# Hula — Pre-Hedge Engine (v0 Spec)

> Source: provided 2026-06-17 (Stefan / pre-seed artifact). This is Track 2 (raise) — an
> engine-proof demo, play-money/testnet user leg + tiny real hedge. NOT the PH consumer launch
> (that's the virtual-currency fixed-odds bot, `2026-06-16-cold-start-market-maker-design.md`).
> Implementation lives in `lib/hedge/*`. Reservation (F1) + idempotency (F2) fixes from the prior
> eng review are wired in from the start (see `2026-06-16-hedge-engine-design.md` review trail).

**What it proves:** Hula can offer deep, two-sided liquidity on a mirror market while carrying ~zero directional inventory and ~$0 price risk, using a small, recyclable pool of working capital. Every Hula fill is offset on Polymarket the instant it prints. Hula keeps the spread; Polymarket carries the risk.

**Primary audience for the artifact:** Stefan (technical advisor + angel) and the pre-seed round. Secondary: the foundation for the real engine.

---

## 1. Scope

**In (v0):**
- One binary mirror market that Polymarket lists (always-on crypto or a scheduled global event — *not* PBA; PBA has no hedge venue and is traditional MM, a separate artifact).
- A quoting service that derives Hula bid/ask from the live Polymarket mid.
- A hedge engine that offsets every Hula fill on Polymarket and pins net exposure to ~0.
- A risk/inventory ledger (single source of truth) with live exposure, capital deployed, and P&L.
- Operator controls (Telegram) + a live dashboard.
- The user-facing leg from the prior decisions: Privy embedded wallet + mock GCash cash-in + play-money/testnet balance.

**Out (v0):**
- On-chain CTF settlement, UMA, real KYC/AMLA (these are production, not the engine proof).
- Multiple markets, multi-outcome (negRisk) markets, parimutuel pools.
- Real peso rails (mocked per prior turns).
- PBA / locally market-made books.

---

## 2. The mechanic + economics

Notation: mirror market with YES token, Polymarket mid `m ∈ (0,1)`, tick `0.01`, Hula spread `s` (e.g. `0.02`), hedge slippage `σ`, trade size `N` contracts (each settles $1 / $0).

Hula quotes: `bid = m − s/2`, `ask = m + s/2`.

**User BUY YES, size N, at `a = m + s/2`:**
1. Hula receives `N·a`, is now **short N YES** to the user.
2. Hedge engine posts a marketable BUY (FOK/FAK) for N YES on Polymarket → fills at ≈ `m + σ`, cost `N·(m+σ)`.
3. Locked margin ≈ `N·(s/2 − σ)`. **Profitable iff markup `s/2` > hedge slippage `σ`.** This inequality is the entire business; it sets the minimum viable spread.
4. Working capital deployed on Polymarket = `N·(m+σ)` (YES held to cover the user payout), recovered at resolution.
5. Net price exposure ≈ 0 (short N to user, long N on Poly).

**User SELL YES, size N, at `b = m − s/2`:** symmetric — Hula buys from user (long N), hedges with a marketable SELL on Poly, locks `N·(s/2 − σ)`, and *frees* capital.

**Settlement:** at resolution the Poly position pays Hula exactly what Hula owes users → net 0 + accumulated spread. v0 resolves manually via the centralized resolver/operator.

**The contrast that sells it (build both modes):**
- Hedging ON → total P&L ≈ cumulative spread; smooth; exposure ≈ 0; capital bounded.
- Hedging OFF → P&L is a random walk on `m`; exposure accumulates. Toggling between the two on the dashboard *is* the pitch.

---

## 3. Architecture

```
                 ┌──────────────────────────────────────────┐
   user leg ───► │  Hula Order Intake / thin CLOB (off-chain) │
 (Privy + mock   └───────────────┬──────────────────────────┘
  GCash, play-$)                 │ fill events
                                 ▼
   Polymarket  ◄──── book ──► ┌────────────────┐   ┌──────────────────┐
   CLOB + WS  ◄─ hedge orders │ Quoting Service │   │  Hedge Engine    │
   (mainnet, 137)             │  bid/ask = m±s/2│──►│ offset every fill│
        ▲                     └────────┬───────┘   └────────┬─────────┘
        │ read (no auth)               │                    │
        │ trade (L2 + EIP-712)         ▼                    ▼
        └───────────────────► ┌───────────────────────────────────────┐
                              │  Risk / Inventory Ledger (source truth) │
                              │  exposure · capital · realized/unreal P&L│
                              └───────┬───────────────────────┬────────┘
                                      ▼                        ▼
                              ┌───────────────┐      ┌──────────────────┐
                              │ Telegram ops  │      │  Live dashboard   │
                              │ start/stop·kill│     │ exposure/capital  │
                              │ spread·flatten │     │ P&L·hedge fill/lat│
                              └───────────────┘      └──────────────────┘
```

Components:
- **Polymarket Connector** — `@polymarket/clob-client-v2` (or `py-clob-client`). Host `https://clob.polymarket.com`, chain `137`. L1 (signer) to derive API creds once; L2 creds for all trading; each order EIP-712 signed by the key. Market metadata via Gamma API; live book via websocket; `getTickSize()` / `getNegRisk()` per market.
- **Quoting Service** — subscribes to Poly book, computes `m`, publishes Hula `bid/ask = m ± s/2` with size and optional skew; pulls quotes when the venue is unhealthy.
- **Hedge Engine** — on each Hula fill: build offsetting marketable order (FOK/FAK) → sign → `createAndPostOrder` → confirm fill → write ledger → apply fail policy on miss.
- **Risk/Inventory Ledger** — `userBook`, `hedgeBook`, `netExposure = userNet − hedgeNet`, `capitalDeployed`, realized + unrealized P&L, spread captured. Everything reads from here.
- **Operator (Telegram)** — start/stop quoting, set `s`, set caps, flatten book, kill switch, balance/exposure queries, alerts.
- **Dashboard** — exposure, capital deployed, P&L vs locked-spread, hedge fill rate, hedge latency, tape.
- **Resolver (v0)** — centralized; operator resolves, reconciles vs Polymarket resolution.

---

## 4. Hedge execution (the part Stefan will probe)

Order placement (TS, current SDK shape):

```ts
import { ClobClient, Side, OrderType } from "@polymarket/clob-client-v2";

const resp = await client.createAndPostOrder(
  { tokenID, price: marketablePrice, size: N, side: Side.BUY },
  { tickSize, negRisk: false },
  OrderType.FAK,           // FAK/FOK = take liquidity now; GTC/GTD rest on the book
);
// resp.status ∈ { matched, live, delayed, ... }; resp.errorMsg on failure
```

- Use **FAK** (fill-and-kill) for hedges so partials fill and the remainder cancels rather than resting unexpectedly. Set `price` marketable (cross the book by up to `σ_max`).
- Latency SLO: hedge posted within `T_hedge` (target sub-second) of the Hula fill event. Measure and surface it; it's a credibility number.
- Confirm via order status / `getTrades`; reconcile against the ledger before marking the round-trip complete.
- Consider Polymarket **builder attribution** (builder API keys, HMAC headers) — Hula trades get credited to a builder account; check whether this carries rebate economics that improve the `s/2 > σ` math.

**Hedge-fail policy — the single most important safety logic:**
1. Retry with widened marketable price up to `σ_max`.
2. If still unfilled / partial beyond tolerance: (a) **halt Hula quoting** (stop taking new flow), (b) Telegram alert to operator, (c) hold residual exposure *within* `E_max`, (d) widen Hula spread or pull quotes.
3. **Hard invariant:** net exposure never exceeds `E_max`. If a fill would breach it, reject the Hula order rather than accept un-hedgeable flow.

---

## 5. Risk controls / params

| Param | Meaning | v0 default |
|---|---|---|
| `s` | Hula spread (round-trip) | 0.02 (2¢) |
| `σ_max` | max hedge slippage tolerated | 0.005 |
| `E_max` | max net directional exposure | small $ cap (e.g. $500) |
| `cap_market` | max gross position per market | demo-sized |
| `cap_capital` | max working capital deployed | demo wallet balance |
| `T_hedge` | hedge latency SLO | sub-second |
| kill switch | pull all quotes, stop engine | operator + auto on repeated fail |

---

## 6. Data model (ledger)

```
Fill        { id, side, size, hula_price, ts, user_id }
Hedge       { id, fill_id, side, size, poly_price, poly_order_id, status, slippage, latency_ms, ts }
Position    { user_net, hedge_net, net_exposure }        // net_exposure = user_net − hedge_net
PnL         { spread_captured, unrealized_directional, total }
Capital     { deployed_usdc, free_usdc }
```

P&L is computed cleanly as: `equity = cash + (hedge_net − user_net)·m`. Fully hedged → `hedge_net = user_net` → `equity = cash = Σ spread`. Unhedged → `equity` swings with `m`. Plot `equity` against `spread_captured`; the gap between them is the directional risk taken.

---

## 7. The key v0 decision: real hedge vs simulated venue

Polymarket is mainnet-only (no public CLOB testnet), so the hedge leg is one of:

- **Option A — real mainnet, tiny size (recommended).** User/Hula leg on testnet or play-money; hedge leg posts *real* FAK orders to mainnet Polymarket at small size (a few hundred $ float). Proves the engine against the real venue — real latency, slippage, fill behavior. Maximally credible to Stefan.
- **Option B — simulated venue.** Live read-only Poly price feed + simulated fills. Zero capital, fast, but it's a sim and he'll know.
- **Hybrid (do this):** build the connector against **real read-only market data from day one** (free, no auth), gate live order-posting behind a flag. Demo in sim, flip to real small-size when the wallet's funded. M2 below is the flip.

---

## 8. Capital plan

- **Demo:** a few hundred to ~$2K USDC on Polygon for live small-size hedging.
- **Pilot (one mirror market, real two-sided flow):** ~$30–50K working capital. Bounded because two-sided flow nets; one-sided flow temporarily deploys more but still carries **no price risk** — only capital usage. Builder attribution may offset cost. (Surface this distinction explicitly: pre-hedge kills *price* risk, not *capital* usage; two-sided flow is what makes it capital-light.)

---

## 9. Build milestones

- **M0 — Connector + read-only data.** Live Poly book/mid, computed Hula quotes on the dashboard. No orders.
- **M1 — Hedge engine, SIM mode.** Simulated Hula fills → simulated hedges; ledger, exposure, P&L, spread capture, hedging on/off contrast all live. *(the "engine works" proof.)*
- **M2 — Real hedge leg.** Flip the flag: post small real FAK orders to mainnet on each fill; measure real latency/slippage/fill rate. *(the Berlin/Stefan artifact.)*
- **M3 — Operator + safety.** Telegram controls, kill switch, hedge-fail policy hardened, `E_max` invariant enforced.
- **M4 — User leg.** Wire Privy + mock GCash + play-money for the end-to-end walkthrough.

---

## 10. Open questions to confirm with Stefan

- Which mirror market for v0 (always-on crypto vs scheduled global event) — liquidity depth, tick size, negRisk.
- Builder attribution economics — do builder rebates improve the `s/2 > σ` margin?
- Real hedge slippage at target sizes → sets the minimum viable spread `s`.
- Settlement reconciliation — Hula resolves when Polymarket resolves; how to handle the lag and any disputed resolution.
- negRisk handling if any candidate mirror market is multi-outcome.
