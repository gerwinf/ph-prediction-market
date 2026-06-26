# Live Polymarket volume — design

Date: 2026-06-26
Scope: small. Surface the real Polymarket volume we already fetch, for the 8
pinned markets. No estimation for unpinned markets (deferred).

## Problem

`volume_usd` is already fetched from Polymarket (`MirrorPrice.volumeUsd`),
stored in `mirror_prices`, and even `select`ed in `app/api/prices/route.ts` —
but it is dropped before the JSON response. Every volume label in the UI is a
hardcoded peso string (`VOL ₱6.1M`). So pinned markets show curated fiction even
though we have their real traded volume.

## Goal

For the 8 markets pinned in `LIVE_MARKETS`, show their real Polymarket volume
(converted USD→₱) wherever a volume label is rendered. Unpinned markets keep
their curated string, unchanged. Degrade exactly like `livePct`: a missing /
stale / unparseable row falls back to the hardcoded string — never blank.

## Changes

### 1. `app/api/prices/route.ts` — return the volume already read
Add `volume_usd` to the response object and its type:

```ts
const response: Record<string, {
  outcomes: unknown; is_stale: boolean; fetched_at: string; volume_usd: number | null
}> = {}
...
response[slug] = { outcomes: r.outcomes, is_stale: r.is_stale, fetched_at: r.fetched_at, volume_usd: r.volume_usd }
```

No new fetch — `r.volume_usd` is already on the row.

### 2. `lib/worldcup/odds.ts` — compression + formatter + `liveVol` helper
This module already owns the `PriceInfo` type the landing page imports the shape
of, and the fresh/stale degradation logic. Add there:

- Extend `PriceInfo` with `volume_usd?: number | null`.
- `compressVol(usd): number` — see "Units / scaling decision" below.
- `formatPeso(php: number): string` — compact a peso amount:
  - `>= 1e9` → `₱X.XB` (1 decimal)
  - `>= 1e6` → `₱X.XM` (1 decimal, e.g. `₱6.1M`, `₱4.0M` — matches existing strings)
  - `>= 1e3` → `₱XXXK` (integer)
  - else → `₱X` (integer)
- `liveVol(prices, slug, fallbackStr)` → if the row is fresh (reuse `freshRow`)
  and `volume_usd` is a finite number `> 0`, return `formatPeso(compressVol(volume_usd))`;
  else return `fallbackStr`.

### 3. Mirror the type + wire call sites
- `app/page.tsx`: extend its local `PriceInfo` type with `volume_usd?: number | null`;
  import `liveVol`.
  - `MarketCard` (line ~333): `VOL {liveVol(prices, m.slug, m.vol)}`
  - `FeaturedCard` (line ~196): `VOL {liveVol(prices, 'wc-argentina', '₱4.21M')}`
- `app/worldcup/page.tsx`: `WinnerLeaderboard` (line ~229):
  `Vol {liveVol(prices, r.slug, r.vol)}`

## Units / scaling decision

Polymarket volume is global and spans 3+ orders of magnitude (~$200K crypto →
~$74M World Cup). Shown raw (converted at a flat FX rate) the WC markets read as
₱4.1B next to ₱6M PH-local cards — looks like a glitch. A flat cap collapses all
big markets to one identical ceiling; a flat linear scale that tames $74M crushes
the $216K market to near-zero. So the label is a **compressed activity index**,
not a literal figure:

`compressVol(usd)` log-maps real USD volume onto a fixed peso band:
- anchors: `VOL_USD_LO = 100_000` → `VOL_PHP_FLOOR = ₱1.0M`,
  `VOL_USD_HI = 100_000_000` → `VOL_PHP_CEIL = ₱9.0M`, clamped at both ends.
- `t = clamp((ln(usd) − ln(LO)) / (ln(HI) − ln(LO)), 0, 1)`,
  `php = FLOOR · (CEIL/FLOOR)^t`.

Preserves ordering and differentiation while keeping every market inside the same
visual range as the curated grid. Resulting labels at current volumes:
Argentina ₱8.2M, France ₱8.1M, Spain ₱7.8M, England ₱7.6M, Brazil ₱7.5M,
China–Taiwan ₱6.6M, BTC ₱2.1M, ETH ₱1.3M. Anchors are tunable constants.

## Tests

`lib/worldcup/odds.test.ts` (extend):
- `formatPeso`: M/B/K/units thresholds and one-decimal M (`₱6.1M`).
- `compressVol`: low-anchor → floor, high-anchor → ceil, both clamped; ordering
  preserved and output stays inside the band.
- `liveVol`: fresh row with volume → compressed string; stale row → fallback;
  missing slug → fallback; missing/null/zero `volume_usd` → fallback.

## Out of scope
- Estimating volume for unpinned markets (separate follow-up).
- Showing volume on `/picks`, `/hits`, fixtures (no volume label today).
- True FX conversion (the figure is a compressed index, not a literal peso amount).
```
