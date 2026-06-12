# World Cup 2026 Prediction-Market Hub (`/worldcup`) — Design Spec

**Date:** 2026-06-12
**Branch:** `gerwinf/worldcup-section-design`
**Status:** Approved design → ready for implementation plan

## Summary

A dedicated, World-Cup-themed **prediction-market** hub at `/worldcup`, modelled
on Polymarket's and Limitless's World Cup pages. It surfaces the 2026 FIFA World
Cup as YES/NO + multi-outcome markets (not the `/hits` bingo model, which is a
lottery, not a prediction market). The page leads with a **live/next-match
highlight** and a **tournament-winner leaderboard**, and feels "obviously
up-to-date" through **team flags keyed to real fixtures + live badges + a kickoff
countdown + an "updated today" stamp** — no editorial photography.

This is a **pre-launch display showcase**: live odds are shown, YES/NO taps
capture waitlist signal. No real buying or settlement (consistent with the rest
of the site today).

## Why this shape

- The `/hits` bingo surface is not a prediction market (random card, no price =
  probability, no trading). The user explicitly steered toward "closer to a
  prediction market," which is the YES/NO live-odds model the landing page's
  `FeaturedCard` already uses.
- A dedicated route (vs. a landing-page section) gives the World Cup its own
  design and room to be a focused hub, like Polymarket's `/sports/world-cup`.
- "Obviously up-to-date pictures" = **Interpretation 1**: flags keyed to the
  real fixtures, wrapped in live freshness signals. This is how Polymarket and
  Limitless achieve the "current" feel — low IP risk, never stale, cheap. (Not
  editorial action photos.)

## Out of scope (v1)

- Real money / buying / settlement (waitlist capture only).
- Live in-match **scores** (a `LIVE` badge appears at kickoff, but no scoreline).
  This is the deferred "Level B"; graft on later via a sports API if it earns it.
- Props markets (Golden Boot, group winners, over/under) — deferred to phase 2.
- A generalized multi-sport "hub" abstraction — build WC concretely first; extract
  later only if a second hub (PBA/NBA) actually appears (YAGNI).

## Architecture

Self-contained route reusing existing infrastructure.

- **`app/worldcup/page.tsx`** — client component (mirrors `app/page.tsx` and
  `app/hits/page.tsx`). Wrapped in `<main className="hula-v2">` to inherit design
  tokens.
- **`lib/worldcup/fixtures.ts`** — curated, hand-verified data module (same
  pattern `/picks` already uses for WC fixtures). Holds:
  - **Contenders** (winner leaderboard): `{ name, iso, slug }` pointing at the
    existing `LIVE_MARKETS` winner slugs (`wc-argentina`, `wc-france`, `wc-spain`,
    `wc-england`, `wc-brazil`, …). `fallbackPct` per contender.
  - **Fixtures** (spotlight + match grid): `{ id, home:{name,iso}, away:{name,iso},
    group, kickoffISO, venue?, slug? , fallback:{home,draw,away} }`. `slug` points
    at a `SLUG_TO_QUERY` entry (`wc-mex-rsa`, `wc-arg-alg`, …) when a tradeable
    Polymarket market exists; otherwise the curated `fallback` odds are shown.
- **`lib/worldcup/state.ts`** — pure helpers (unit-tested):
  - `matchState(kickoffISO, now)` → `'scheduled' | 'live' | 'final'`
    (`live` = kickoff … kickoff + ~120 min).
  - `selectSpotlight(fixtures, now)` → live match → else nearest upcoming → else
    most recent final.
  - `flagUrl(iso, size?)` → `https://flagcdn.com/<w>/<iso>.png`.
  - `countdownParts(kickoffISO, now)` → `{ d, h, m, s }` for the ticking timer.
- **Live odds:** existing `GET /api/prices?events=<all wc slugs>`. Response shape
  `{ slug: { outcomes:[{name,price}], is_stale, fetched_at } }`. Overlay live %
  onto curated fallbacks (same overlay pattern as the landing grid); on missing
  or `is_stale` rows, keep the fallback.
- **Waitlist capture:** existing `POST /api/waitlist` with
  `{ email, source: 'worldcup', why? }`. (Optional, low-cost: extend the route's
  notify branch to treat `'worldcup'` like `'picks'` so taps are emailed to the
  team — nice-to-have, not required for v1.)
- **Styling:** new `wc-*` namespace in `app/globals.css` (mirrors how `hits-*`
  and the landing classes are namespaced). No CSS framework changes.
- **Flags:** `flagcdn.com`, keyed to ISO 3166-1 alpha-2 codes. Free, no API key,
  always correct per fixture. `<img>` with an `onError` fallback to a neutral
  country-code chip. (Add `flagcdn.com` to `next.config.js` images only if we
  switch to `next/image`; plain `<img>` needs no config.)

## Page structure (top → bottom)

1. **Header** — World-Cup-themed bar: back-to-home link, wordmark, and a
   freshness stamp **"Updated {today} · live odds"** (today's date rendered
   client-side after mount to avoid hydration mismatch).
2. **Highlight / spotlight hero** — the live-or-next match:
   - Two **large flags** + team names + group label.
   - **Kickoff countdown** (ticking) for `scheduled`; flips to a **`LIVE`** badge
     for `live`; **`FULL TIME`** for `final`.
   - Match-winner odds: **Home / Draw / Away** (live where a `slug` exists, else
     curated fallback), with a primary YES-style CTA that opens waitlist capture.
3. **Winner leaderboard** — "Who wins the World Cup?" Top contenders as rows:
   **flag + country + live % bar + %**, sorted by probability. Anchored to live
   Polymarket winner odds; "Updated today" caption. Tapping a row opens waitlist
   capture pre-tagged with that contender.
4. **Upcoming matches grid** — match cards: two flags, kickoff time + group,
   Home/Draw/Away odds, waitlist CTA. Ordered by kickoff; excludes the one shown
   in the spotlight.
5. **Waitlist CTA strip** — "Get in before the final" email capture (reuses the
   landing `EmailForm` pattern, `source: 'worldcup'`).
6. **Footer** — reused site footer + the 21+ / responsible-play line.

## Freshness mechanics ("obviously up-to-date" engine)

- **Countdown** ticks every second to kickoff via a client interval (cleared on
  unmount).
- **State badge** derived from kickoff time: `SCHEDULED → LIVE → FULL TIME`.
- **Spotlight auto-selects** the most relevant match (live → next → most recent).
- **"Updated today"** stamp + **correct flags per fixture** make it visibly clear
  the page is tracking the real tournament in real time.
- All time math uses a single `now` captured on mount + interval tick, so the
  pure helpers stay testable (pass `now` in; never call `Date.now()` inside
  them at module scope).

## Data flow & error handling

- **On mount:** capture `now`; start the 1s interval; `fetch('/api/prices?events=
  <slugs>')` for every contender + fixture slug; overlay live % onto curated
  fallbacks.
- **Odds fetch fails / empty / stale** → curated fallback odds. The page is fully
  rendered from the local fixtures module before any fetch resolves (no blank
  state, no flash — same approach as the landing grid).
- **Flag image fails** (`onError`) → neutral chip showing the ISO code.
- **No upcoming fixtures** (between matchdays / tournament over) → spotlight falls
  back to the winner leaderboard with a "next matchday" line instead of an empty
  hero.

## Design / theme

Premium and flag-forward — closer to Polymarket than to the colorful `/hits`
casino aesthetic, because this is the prediction-market surface. Tournament-dark
base, **gold** winner accents (trophy), flags as the primary visual texture.
Built on the existing `hula-v2` tokens and type scale so it reads as native Hula.

## Testing

Vitest (already configured). Pure-logic unit tests in `lib/worldcup/state.test.ts`:

- `matchState` transitions across the scheduled/live/final boundaries.
- `selectSpotlight` picks live over upcoming over final, and handles the
  empty-fixtures case.
- `flagUrl` builds the expected `flagcdn.com` URL for a given ISO + size.
- `countdownParts` decomposes a future kickoff correctly and clamps at zero.

No network or rendering tests in v1 (the page is presentational over curated
data + a best-effort odds overlay).

## Open questions / assumptions

- **Fixture maintenance:** v1 fixtures are hand-curated in `lib/worldcup/
  fixtures.ts` and updated manually as the tournament progresses (acceptable for
  a pre-launch showcase; same as `/picks`). A live fixtures ingest is explicitly
  out of scope.
- **Slug coverage:** only `wc-mex-rsa` and `wc-arg-alg` have match slugs today,
  and five winner contenders have ID-pinned markets. Everything else renders from
  curated fallback odds; add slugs to `lib/oracle/slugs.ts` over time and the
  live overlay picks them up automatically.
- **Linking:** whether `/worldcup` is linked from the homepage nav or shared
  manually (like `/picks`) is a launch decision, not a build dependency.
