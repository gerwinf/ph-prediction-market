# World Cup market detail pages (`/worldcup/[fixtureId]`)

**Date:** 2026-06-29
**Status:** Approved — ready for implementation plan
**Scope:** World Cup *fixtures* only (match markets). WC winner contenders and
landing-page binary markets are explicitly out of scope for this pass.

## Problem

`/worldcup` (and the landing page) render market **cards** only. A card has no
page of its own — tapping it opens a waitlist modal. There is nowhere to see a
single market's details, its volume, resolution terms, or a focused CTA.
Kalshi and Polymarket both give every market its own page; we have none.

This spec adds a per-fixture detail page so a World Cup match market becomes a
real, shareable destination.

## Decisions (locked)

- **Scope:** WC fixtures only → `/worldcup/[fixtureId]`.
- **CTA:** odds buttons open the **existing `WaitlistModal`** (option A). No
  real bet flow — this workspace has no wallet/market-maker code. A richer
  **mock trade ticket** is a deliberate *follow-up* project, not part of this
  one.
- **Navigation (option B):** a market card is a *preview*; clicking it always
  navigates to the market page, matching Kalshi/Polymarket. Card-level odds
  become display-only. The waitlist now fires from the detail page.
- **Sections shipped:** (1) matchup header, (2) odds panel, (3) live volume,
  (4) market details / resolution. **No** price-history chart (we store only
  current price, not a time series) and **no** related-markets section.
- **Volume fallback:** option (ii) — a deterministic, per-fixture derived peso
  label, replaced by real Polymarket volume once a fixture has a resolvable
  slug. Clearly tagged as indicative until then.

## Architecture

Mirror the hub's established no-flash pattern (server-render the fixture,
client-overlay live prices).

### `app/worldcup/[fixtureId]/page.tsx` — server component

- `export const dynamic = 'force-dynamic'` (same as the hub, so every load
  reflects the latest catalog).
- Fetch fixtures via the existing `fetchApprovedWcFixtures()` (DB → falls back
  to hardcoded `FIXTURES` on any failure, per-kind, identical posture to the
  hub).
- Resolve the fixture by id with a new pure helper `getFixtureById(fixtures,
  id)`. If not found → `notFound()`.
- Server-render the matched fixture into the client detail component so first
  paint is already correct.
- `generateMetadata({ params })` returns a per-match title/description
  (e.g. title `"Tunisia vs Netherlands — World Cup 2026 | Hula"`). These pages
  exist to be shared; a generic title would waste that. Falls back to a generic
  WC title if the fixture can't be resolved.

### `app/worldcup/[fixtureId]/detail.tsx` — client component (`'use client'`)

- Props: `{ fixture: Fixture }`.
- Ticks `now` every second (deferred to mount to avoid hydration mismatch),
  same as the hub, for the badge/countdown.
- Client-fetches `/api/prices?events=<slug>` when `fixture.slug` is set;
  degrades silently to the fixture's fallbacks on any error — identical to the
  hub's `prices` overlay.
- Owns its own `WaitlistModal` instance (via a `waitlistFor` state string).

*Alternative considered & rejected:* server-fetch prices too for zero flash on
odds. The hub already client-overlays prices and that posture is accepted and
good enough; matching it keeps behavior consistent and the code simpler.

## Shared-code extraction (targeted cleanup)

`app/worldcup/hub.tsx` is a single 396-line file with every component inlined.
Before duplicating, extract the pieces both pages need into a new
`app/worldcup/shared.tsx` (`'use client'`):

- `Flag` (flag `<img>` with chip fallback)
- `WaitlistModal`
- `groupLabel` and `kickoffLabel` (pure label helpers)

`hub.tsx` imports these instead of defining them. **No behavior change** — pure
de-duplication so the detail page reuses, rather than copies, the hub's UI. The
badge construction (LIVE / FULL-TIME / countdown) is small and reads from
`matchState` + `countdownParts`; it may be extracted as a `MatchBadge`
component in `shared.tsx` if both call sites are identical, otherwise left
inline in each.

## Detail-page sections

### 1. Matchup header
Large flags (both teams), team names, `groupLabel(group)`, kickoff date/time
(`kickoffLabel`), `venue` (when present), and the LIVE / FULL-TIME / live
countdown badge driven by `matchState(kickoffISO, now)` + `countdownParts`.

### 2. Odds panel (the action surface)
The 3-way market: **Home / Draw / Away**.
- `homePct = matchHomePct(prices, slug, home.name, fallback.home)` (live
  overlay where it resolves, else fallback).
- `drawPct = fallback.draw`; `awayPct = max(0, 100 − homePct − drawPct)` —
  same arithmetic the hub's `Spotlight` uses (the three may not sum to exactly
  100 in live edge cases; acceptable for a pre-launch display).
- Each option is a button showing the team/Draw label + big probability %.
- Tapping opens the `WaitlistModal` with a clear context string, e.g.
  `"Tunisia to beat Netherlands"`, `"Tunisia v Netherlands — Draw"`,
  `"Netherlands to beat Tunisia"`.

### 3. Live volume
- A new pure helper `fixtureVolLabel(prices, fixture)`:
  - If `liveVol(prices, fixture.slug, …)` resolves to a real Polymarket figure
    → return it, tagged **live**.
  - Else return a **deterministic** derived peso label, tagged **indicative**.
    Derived from the fixture's own data (e.g. odds spread / id) so it is stable
    across renders and identical on server and client. No `Date.now()`, no
    `Math.random()` — same determinism rule as the rest of `lib/worldcup`.
- The section shows the label and whether it is live or indicative, so we never
  present a derived number as a real one.

### 4. Market details / resolution
- **How this resolves:** plain-language copy generated from the teams, e.g.
  *"Resolves to the result of Tunisia vs Netherlands at full time (90 minutes +
  stoppage). 'Draw' settles if the score is level."*
- **Closes:** the kickoff time (`kickoffLabel`).
- **Source:** "Live odds via Polymarket" when a slug resolves, else "Curated
  odds".
- **Disclaimer:** 21+ / pre-launch / no real bets yet (matches the hub footer
  tone).

## Hub navigation change (option B)

In `app/worldcup/hub.tsx`:

- **`MatchGrid` cards:** wrap each `<article class="wc-mcard">` in a
  `<Link href={\`/worldcup/${f.id}\`}>`. Convert the three odds `<button>`s to
  display-only `<span>`s (a `<button>` cannot be nested in an `<a>`). The
  card's "Tap a team or draw to follow that market" note updates to reflect
  that the whole card opens the market.
- **`Spotlight`:** becomes a link to `/worldcup/${fixture.id}` with an explicit
  "View market →" affordance; its odds row becomes display-only.
- **`WinnerLeaderboard` (contenders): unchanged** — out of scope. Its YES/NO
  buttons keep opening the waitlist modal, so `hub.tsx` keeps the `WaitlistModal`
  and `waitlistFor` state for that path.

## Data — no new sources

Everything comes from the current fixture shape (`lib/worldcup/state.ts`):
`id`, `home`/`away` (name + iso), `group`, `kickoffISO`, `venue?`, `slug?`,
`fallback {home, draw, away}` — plus `/api/prices` for the live overlay. No new
tables, no new external calls, no schema change.

## Testing

Following the existing `lib/worldcup/*.test.ts` convention (pure, deterministic,
no `Date.now()`), add unit tests for the new pure helpers:

- `getFixtureById(fixtures, id)` — match, miss, empty list.
- `fixtureVolLabel(prices, fixture)` — live path (fresh row with volume),
  indicative path (no slug / stale), and **determinism** (same input → same
  output across calls).
- Resolution-text builder — correct team names interpolated.

No component/render tests are required beyond what the repo already does (the
existing tests cover lib helpers and API routes, not React components).

## Out of scope (explicit)

- Real bet placement / wallet / order ticket (separate follow-up: the mock
  trade ticket).
- WC winner contender detail pages and landing binary-market detail pages
  (a later generalization once this pattern is proven).
- Price-history chart and order book (no time-series / order data exists).
- Related-markets section.
