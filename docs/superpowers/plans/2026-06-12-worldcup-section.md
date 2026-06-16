# World Cup 2026 Hub (`/worldcup`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated, World-Cup-themed prediction-market hub at `/worldcup` — a live/next-match highlight + tournament-winner leaderboard + upcoming-matches grid, made "obviously up-to-date" by team flags keyed to real fixtures, live badges, a kickoff countdown, and an "updated today" stamp.

**Architecture:** A self-contained client route (`app/worldcup/page.tsx`) that renders entirely from a curated local fixtures module, then overlays live Polymarket odds (best-effort) from the existing `GET /api/prices`. Pure, testable helpers live in `lib/worldcup/`. YES/NO taps capture waitlist signal via the existing `POST /api/waitlist`. No real money/settlement (pre-launch posture). Styling lives in a new `wc-*` namespace in `app/globals.css`, built on the existing dark `--t-*` "tournament" tokens.

**Tech Stack:** Next.js App Router (client component), React hooks, TypeScript, Vitest, flagcdn.com for flag images, existing `/api/prices` (Polymarket mirror) and `/api/waitlist` (Resend) endpoints.

**Spec:** `docs/superpowers/specs/2026-06-12-worldcup-section-design.md`

---

## File Structure

- **Create `lib/worldcup/state.ts`** — pure, side-effect-free helpers: `matchState`, `selectSpotlight`, `flagUrl`, `countdownParts`. No `Date.now()` inside; `now` is always passed in.
- **Create `lib/worldcup/state.test.ts`** — unit tests for the above.
- **Create `lib/worldcup/odds.ts`** — pure odds-overlay helpers: `winnerPct` (Yes-prob overlay for winner markets) and `matchHomePct` (best-effort home-team overlay for match markets), plus `allWcSlugs`.
- **Create `lib/worldcup/odds.test.ts`** — unit tests for the overlay helpers.
- **Create `lib/worldcup/fixtures.ts`** — curated, hand-verified data: `CONTENDERS` (winner leaderboard) and `FIXTURES` (spotlight + match grid), plus the shared `Team`/`Fixture`/`Contender` types.
- **Create `lib/worldcup/fixtures.test.ts`** — integrity tests (ISO codes are 2 letters, odds shapes sane).
- **Create `app/worldcup/page.tsx`** — the route. Inline sub-components (`Spotlight`, `WinnerLeaderboard`, `MatchGrid`, `WaitlistModal`, `CtaStrip`) following the existing `app/page.tsx` pattern.
- **Modify `app/globals.css`** — append the `wc-*` style block.

---

## Task 1: Pure state helpers (`lib/worldcup/state.ts`)

**Files:**
- Create: `lib/worldcup/state.ts`
- Test: `lib/worldcup/state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/worldcup/state.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { matchState, selectSpotlight, flagUrl, countdownParts, type Fixture } from './state'

// Minimal fixture factory — only the fields the helpers read.
function fx(id: string, kickoffISO: string): Fixture {
  return {
    id,
    home: { name: 'Home', iso: 'us' },
    away: { name: 'Away', iso: 'mx' },
    group: 'A',
    kickoffISO,
    fallback: { home: 40, draw: 30, away: 30 },
  }
}

const KICK = '2026-06-12T18:00:00.000Z'
const before = new Date('2026-06-12T17:00:00.000Z')
const during = new Date('2026-06-12T18:45:00.000Z')
const after = new Date('2026-06-12T21:00:00.000Z')

describe('matchState', () => {
  it('is scheduled before kickoff', () => {
    expect(matchState(KICK, before)).toBe('scheduled')
  })
  it('is live within ~120 min of kickoff', () => {
    expect(matchState(KICK, during)).toBe('live')
  })
  it('is final well after kickoff', () => {
    expect(matchState(KICK, after)).toBe('final')
  })
})

describe('selectSpotlight', () => {
  const live = fx('live', KICK)
  const upcoming = fx('upcoming', '2026-06-13T18:00:00.000Z')
  const done = fx('done', '2026-06-11T18:00:00.000Z')

  it('prefers a live match', () => {
    expect(selectSpotlight([done, upcoming, live], during)?.id).toBe('live')
  })
  it('falls back to the nearest upcoming when none live', () => {
    expect(selectSpotlight([done, upcoming], before)?.id).toBe('upcoming')
  })
  it('falls back to the most recent final when none live or upcoming', () => {
    expect(selectSpotlight([done], after)?.id).toBe('done')
  })
  it('returns null for no fixtures', () => {
    expect(selectSpotlight([], during)).toBeNull()
  })
})

describe('flagUrl', () => {
  it('builds a flagcdn URL for an ISO code, lowercased', () => {
    expect(flagUrl('US', 80)).toBe('https://flagcdn.com/w80/us.png')
  })
  it('defaults to width 80', () => {
    expect(flagUrl('mx')).toBe('https://flagcdn.com/w80/mx.png')
  })
})

describe('countdownParts', () => {
  it('decomposes a future kickoff', () => {
    const now = new Date('2026-06-12T16:59:50.000Z') // 1h 0m 10s before KICK
    expect(countdownParts(KICK, now)).toEqual({ d: 0, h: 1, m: 0, s: 10 })
  })
  it('clamps to zero once kickoff has passed', () => {
    expect(countdownParts(KICK, after)).toEqual({ d: 0, h: 0, m: 0, s: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/worldcup/state.test.ts`
Expected: FAIL — cannot find module `./state`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/worldcup/state.ts`:

```ts
/* Pure helpers for the /worldcup hub. No Date.now() here — callers pass `now`
 * so every function is deterministic and unit-testable. */

export type Team = { name: string; iso: string }

export type Fixture = {
  id: string
  home: Team
  away: Team
  group: string
  kickoffISO: string
  venue?: string
  slug?: string
  fallback: { home: number; draw: number; away: number }
}

export type MatchState = 'scheduled' | 'live' | 'final'

// A match is "live" from kickoff until kickoff + 120 minutes (covers 90' +
// stoppage + halftime, without a real score feed). Before → scheduled, after →
// final.
const LIVE_WINDOW_MS = 120 * 60 * 1000

export function matchState(kickoffISO: string, now: Date): MatchState {
  const kickoff = new Date(kickoffISO).getTime()
  const t = now.getTime()
  if (t < kickoff) return 'scheduled'
  if (t < kickoff + LIVE_WINDOW_MS) return 'live'
  return 'final'
}

// Spotlight priority: any live match (earliest kickoff) → nearest upcoming →
// most recent final. Null only when there are no fixtures at all.
export function selectSpotlight(fixtures: Fixture[], now: Date): Fixture | null {
  if (fixtures.length === 0) return null
  const withState = fixtures.map((f) => ({ f, state: matchState(f.kickoffISO, now) }))

  const live = withState
    .filter((x) => x.state === 'live')
    .sort((a, b) => a.f.kickoffISO.localeCompare(b.f.kickoffISO))
  if (live.length > 0) return live[0].f

  const upcoming = withState
    .filter((x) => x.state === 'scheduled')
    .sort((a, b) => a.f.kickoffISO.localeCompare(b.f.kickoffISO))
  if (upcoming.length > 0) return upcoming[0].f

  const finals = withState
    .filter((x) => x.state === 'final')
    .sort((a, b) => b.f.kickoffISO.localeCompare(a.f.kickoffISO))
  return finals[0]?.f ?? null
}

export function flagUrl(iso: string, width = 80): string {
  return `https://flagcdn.com/w${width}/${iso.toLowerCase()}.png`
}

export function countdownParts(
  kickoffISO: string,
  now: Date
): { d: number; h: number; m: number; s: number } {
  let ms = new Date(kickoffISO).getTime() - now.getTime()
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 }
  const s = Math.floor(ms / 1000) % 60
  const m = Math.floor(ms / (1000 * 60)) % 60
  const h = Math.floor(ms / (1000 * 60 * 60)) % 24
  const d = Math.floor(ms / (1000 * 60 * 60 * 24))
  return { d, h, m, s }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/worldcup/state.test.ts`
Expected: PASS (4 describe blocks, all green).

- [ ] **Step 5: Commit**

```bash
git add lib/worldcup/state.ts lib/worldcup/state.test.ts
git commit -m "feat(worldcup): pure state helpers (matchState, spotlight, flagUrl, countdown)"
```

---

## Task 2: Odds-overlay helpers (`lib/worldcup/odds.ts`)

**Files:**
- Create: `lib/worldcup/odds.ts`
- Test: `lib/worldcup/odds.test.ts`

The `/api/prices` response shape is `{ [slug]: { outcomes: {name,price}[]; is_stale: boolean; fetched_at: string } }` (price is a 0–1 probability). Winner markets are Yes/No (`outcomes[0]` = "Yes"). Match markets vary, so `matchHomePct` matches the home team's name defensively and falls back when it can't.

- [ ] **Step 1: Write the failing test**

Create `lib/worldcup/odds.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { winnerPct, matchHomePct, allWcSlugs, type PricesMap } from './odds'

const prices: PricesMap = {
  'wc-argentina': { outcomes: [{ name: 'Yes', price: 0.21 }, { name: 'No', price: 0.79 }], is_stale: false, fetched_at: '' },
  'wc-stale': { outcomes: [{ name: 'Yes', price: 0.9 }], is_stale: true, fetched_at: '' },
  'wc-mex-rsa': { outcomes: [{ name: 'Mexico', price: 0.55 }, { name: 'Draw', price: 0.25 }, { name: 'South Africa', price: 0.20 }], is_stale: false, fetched_at: '' },
}

describe('winnerPct', () => {
  it('returns the live Yes probability as a rounded percent', () => {
    expect(winnerPct(prices, 'wc-argentina', 9)).toBe(21)
  })
  it('uses the fallback when the slug is missing', () => {
    expect(winnerPct(prices, 'wc-france', 14)).toBe(14)
  })
  it('uses the fallback when the row is stale', () => {
    expect(winnerPct(prices, 'wc-stale', 30)).toBe(30)
  })
  it('uses the fallback when slug is undefined', () => {
    expect(winnerPct(prices, undefined, 50)).toBe(50)
  })
})

describe('matchHomePct', () => {
  it('matches the home team name (case-insensitive) and returns its rounded percent', () => {
    expect(matchHomePct(prices, 'wc-mex-rsa', 'Mexico', 40)).toBe(55)
  })
  it('falls back when no outcome name contains the home team', () => {
    expect(matchHomePct(prices, 'wc-mex-rsa', 'Brazil', 40)).toBe(40)
  })
  it('falls back when slug missing/undefined', () => {
    expect(matchHomePct(prices, undefined, 'Mexico', 33)).toBe(33)
  })
})

describe('allWcSlugs', () => {
  it('collects and de-dupes defined slugs from contenders and fixtures', () => {
    const slugs = allWcSlugs(
      [{ slug: 'wc-argentina' }, { slug: 'wc-france' }],
      [{ slug: 'wc-mex-rsa' }, { slug: undefined }, { slug: 'wc-argentina' }]
    )
    expect(slugs.sort()).toEqual(['wc-argentina', 'wc-france', 'wc-mex-rsa'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/worldcup/odds.test.ts`
Expected: FAIL — cannot find module `./odds`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/worldcup/odds.ts`:

```ts
/* Best-effort live-odds overlay for /worldcup. Everything degrades to the
 * curated fallback: missing slug, stale row, or unparseable outcomes all keep
 * the hand-set number, so the page is never blank or wrong-looking. */

export type Outcome = { name: string; price: number }
export type PriceInfo = { outcomes: Outcome[]; is_stale: boolean; fetched_at: string }
export type PricesMap = Record<string, PriceInfo>

function freshRow(prices: PricesMap, slug: string | undefined): PriceInfo | null {
  if (!slug) return null
  const row = prices[slug]
  if (!row || row.is_stale || !Array.isArray(row.outcomes)) return null
  return row
}

// Winner markets are Yes/No; outcomes[0] is "Yes". Returns a rounded percent.
export function winnerPct(prices: PricesMap, slug: string | undefined, fallback: number): number {
  const row = freshRow(prices, slug)
  const yes = row?.outcomes[0]?.price
  return typeof yes === 'number' ? Math.round(yes * 100) : fallback
}

// Match markets vary in outcome naming. Find the outcome whose name contains the
// home team's name (case-insensitive); use its price. Fall back otherwise.
export function matchHomePct(
  prices: PricesMap,
  slug: string | undefined,
  homeName: string,
  fallback: number
): number {
  const row = freshRow(prices, slug)
  if (!row) return fallback
  const needle = homeName.toLowerCase()
  const hit = row.outcomes.find((o) => o.name.toLowerCase().includes(needle))
  return typeof hit?.price === 'number' ? Math.round(hit.price * 100) : fallback
}

// Union of all defined slugs across contenders + fixtures, de-duped.
export function allWcSlugs(
  contenders: { slug?: string }[],
  fixtures: { slug?: string }[]
): string[] {
  const set = new Set<string>()
  for (const c of contenders) if (c.slug) set.add(c.slug)
  for (const f of fixtures) if (f.slug) set.add(f.slug)
  return Array.from(set)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/worldcup/odds.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/worldcup/odds.ts lib/worldcup/odds.test.ts
git commit -m "feat(worldcup): live-odds overlay helpers (winnerPct, matchHomePct, allWcSlugs)"
```

---

## Task 3: Curated fixtures data (`lib/worldcup/fixtures.ts`)

**Files:**
- Create: `lib/worldcup/fixtures.ts`
- Test: `lib/worldcup/fixtures.test.ts`

Reuses the existing winner slugs in `lib/oracle/slugs.ts` (`LIVE_MARKETS`: `wc-argentina`, `wc-france`, `wc-spain`, `wc-england`, `wc-brazil`) and match slugs (`SLUG_TO_QUERY`: `wc-mex-rsa`, `wc-arg-alg`). Other rows render from curated fallback odds. Kickoff times below are illustrative real-tournament slots — the engineer should keep them in the future relative to the demo date so the spotlight/countdown have something to show; update as the tournament progresses.

- [ ] **Step 1: Write the failing test**

Create `lib/worldcup/fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CONTENDERS, FIXTURES } from './fixtures'

describe('CONTENDERS', () => {
  it('is non-empty and every contender has a 2-letter ISO and a fallback pct', () => {
    expect(CONTENDERS.length).toBeGreaterThan(0)
    for (const c of CONTENDERS) {
      expect(c.iso).toMatch(/^[a-z]{2}$/)
      expect(c.fallbackPct).toBeGreaterThanOrEqual(0)
      expect(c.fallbackPct).toBeLessThanOrEqual(100)
    }
  })
})

describe('FIXTURES', () => {
  it('is non-empty and every fixture has valid teams, ISO codes and fallback odds', () => {
    expect(FIXTURES.length).toBeGreaterThan(0)
    for (const f of FIXTURES) {
      expect(f.home.iso).toMatch(/^[a-z]{2}$/)
      expect(f.away.iso).toMatch(/^[a-z]{2}$/)
      expect(Number.isNaN(Date.parse(f.kickoffISO))).toBe(false)
      const sum = f.fallback.home + f.fallback.draw + f.fallback.away
      expect(sum).toBeGreaterThan(90)
      expect(sum).toBeLessThan(110)
    }
  })
  it('has unique fixture ids', () => {
    const ids = FIXTURES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/worldcup/fixtures.test.ts`
Expected: FAIL — cannot find module `./fixtures`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/worldcup/fixtures.ts`:

```ts
import type { Fixture, Team } from './state'

export type Contender = {
  name: string
  iso: string        // ISO 3166-1 alpha-2, lowercase (flagcdn key)
  slug?: string      // winner-market slug in lib/oracle/slugs.ts LIVE_MARKETS
  fallbackPct: number
}

// Winner leaderboard. Live odds overlay onto fallbackPct where `slug` resolves.
// Ordered high→low by fallback; the page re-sorts by live pct after overlay.
export const CONTENDERS: Contender[] = [
  { name: 'Spain',     iso: 'es', slug: 'wc-spain',     fallbackPct: 17 },
  { name: 'France',    iso: 'fr', slug: 'wc-france',    fallbackPct: 16 },
  { name: 'Argentina', iso: 'ar', slug: 'wc-argentina', fallbackPct: 12 },
  { name: 'Brazil',    iso: 'br', slug: 'wc-brazil',    fallbackPct: 11 },
  { name: 'England',   iso: 'gb', slug: 'wc-england',   fallbackPct: 10 },
  { name: 'Portugal',  iso: 'pt',                       fallbackPct: 7 },
  { name: 'Germany',   iso: 'de',                       fallbackPct: 6 },
  { name: 'Netherlands', iso: 'nl',                     fallbackPct: 5 },
]

const T = (name: string, iso: string): Team => ({ name, iso })

// Spotlight + match grid. `slug` points at a SLUG_TO_QUERY match market when one
// exists; otherwise the curated `fallback` odds are shown. Keep kickoffISO times
// realistic and refresh as matchdays pass.
export const FIXTURES: Fixture[] = [
  {
    id: 'wc-mex-rsa',
    home: T('Mexico', 'mx'),
    away: T('South Africa', 'za'),
    group: 'A',
    kickoffISO: '2026-06-12T22:00:00.000Z',
    venue: 'Estadio Azteca',
    slug: 'wc-mex-rsa',
    fallback: { home: 55, draw: 25, away: 20 },
  },
  {
    id: 'wc-arg-alg',
    home: T('Argentina', 'ar'),
    away: T('Algeria', 'dz'),
    group: 'J',
    kickoffISO: '2026-06-17T01:00:00.000Z',
    venue: 'Arrowhead Stadium',
    slug: 'wc-arg-alg',
    fallback: { home: 68, draw: 20, away: 12 },
  },
  {
    id: 'wc-esp-por',
    home: T('Spain', 'es'),
    away: T('Portugal', 'pt'),
    group: 'E',
    kickoffISO: '2026-06-18T19:00:00.000Z',
    venue: 'MetLife Stadium',
    fallback: { home: 47, draw: 27, away: 26 },
  },
  {
    id: 'wc-bra-fra',
    home: T('Brazil', 'br'),
    away: T('France', 'fr'),
    group: 'C',
    kickoffISO: '2026-06-20T22:00:00.000Z',
    venue: 'SoFi Stadium',
    fallback: { home: 41, draw: 28, away: 31 },
  },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/worldcup/fixtures.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/worldcup/fixtures.ts lib/worldcup/fixtures.test.ts
git commit -m "feat(worldcup): curated contenders + fixtures data"
```

---

## Task 4: Page shell, header, data wiring (`app/worldcup/page.tsx`)

**Files:**
- Create: `app/worldcup/page.tsx`

Builds the route skeleton: capture `now`, tick every second, fetch live odds, render a themed header with an "updated today" stamp. Sub-components are stubbed and filled in Tasks 5–8. This task is verified by running the dev server and loading the page.

- [ ] **Step 1: Create the page with header + data wiring (sub-components stubbed)**

Create `app/worldcup/page.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CONTENDERS, FIXTURES } from '../../lib/worldcup/fixtures'
import { selectSpotlight } from '../../lib/worldcup/state'
import { allWcSlugs, type PricesMap } from '../../lib/worldcup/odds'

/* ────────────────────────────────────────────────────────────────────────
 * /worldcup — World Cup 2026 prediction-market hub
 *
 * Pre-launch display showcase. Renders from curated fixtures (lib/worldcup),
 * overlays best-effort live Polymarket odds (/api/prices), and captures
 * waitlist signal on YES taps (/api/waitlist, source=worldcup). No settlement.
 *
 * "Obviously up-to-date" engine: real team flags (flagcdn) keyed to fixtures +
 * a ticking kickoff countdown + LIVE/FULL-TIME badges + an "updated today"
 * stamp. See docs/superpowers/specs/2026-06-12-worldcup-section-design.md.
 * ──────────────────────────────────────────────────────────────────────── */

export default function WorldCupHub() {
  const [now, setNow] = useState<Date | null>(null)
  const [prices, setPrices] = useState<PricesMap>({})
  const [waitlistFor, setWaitlistFor] = useState<string | null>(null)

  // Mount: capture `now` (deferred to client to avoid hydration mismatch) and
  // tick every second so countdowns + live/final transitions stay current.
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Best-effort live odds. Any failure keeps the curated fallbacks.
  useEffect(() => {
    const slugs = allWcSlugs(CONTENDERS, FIXTURES)
    if (slugs.length === 0) return
    let cancelled = false
    fetch(`/api/prices?events=${slugs.join(',')}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: PricesMap) => { if (!cancelled) setPrices(data) })
      .catch(() => { /* keep fallbacks */ })
    return () => { cancelled = true }
  }, [])

  const spotlight = useMemo(
    () => (now ? selectSpotlight(FIXTURES, now) : null),
    [now]
  )
  const gridFixtures = useMemo(
    () => FIXTURES.filter((f) => f.id !== spotlight?.id),
    [spotlight]
  )

  const updatedLabel = now
    ? now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    : '—'

  return (
    <main className="hula-v2 wc">
      <header className="wc-header">
        <Link href="/" className="wc-back">← Hula</Link>
        <span className="wc-wordmark">World Cup <em>2026</em></span>
        <span className="wc-updated" suppressHydrationWarning>
          <span className="wc-updated-dot" /> Updated {updatedLabel} · live odds
        </span>
      </header>

      <Spotlight fixture={spotlight} now={now} prices={prices} onYes={setWaitlistFor} />
      <WinnerLeaderboard prices={prices} onYes={setWaitlistFor} />
      <MatchGrid fixtures={gridFixtures} now={now} prices={prices} onYes={setWaitlistFor} />
      <CtaStrip />

      {waitlistFor && (
        <WaitlistModal context={waitlistFor} onClose={() => setWaitlistFor(null)} />
      )}

      <footer className="wc-foot">
        21+ only · <strong>Play smart</strong> · Live odds via Polymarket · Pre-launch — no real bets yet
      </footer>
    </main>
  )
}

// --- Stubs filled in Tasks 5–8 -------------------------------------------
function Spotlight(_: { fixture: import('../../lib/worldcup/state').Fixture | null; now: Date | null; prices: PricesMap; onYes: (c: string) => void }) {
  return <section className="wc-spotlight">spotlight</section>
}
function WinnerLeaderboard(_: { prices: PricesMap; onYes: (c: string) => void }) {
  return <section className="wc-leaderboard">leaderboard</section>
}
function MatchGrid(_: { fixtures: import('../../lib/worldcup/state').Fixture[]; now: Date | null; prices: PricesMap; onYes: (c: string) => void }) {
  return <section className="wc-grid">grid</section>
}
function CtaStrip() {
  return <section className="wc-cta">cta</section>
}
function WaitlistModal(_: { context: string; onClose: () => void }) {
  return null
}
```

- [ ] **Step 2: Verify it compiles and renders**

Run: `npm run dev` then load `http://localhost:3000/worldcup`.
Expected: page loads with the header ("← Hula", "World Cup 2026", "Updated … · live odds") and the four stub section words. No console errors. Stop the dev server.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/worldcup/page.tsx
git commit -m "feat(worldcup): page shell, themed header, odds + countdown wiring"
```

---

## Task 5: Spotlight hero (highlight)

**Files:**
- Modify: `app/worldcup/page.tsx` (replace the `Spotlight` stub; add imports)

- [ ] **Step 1: Add imports**

At the top of `app/worldcup/page.tsx`, extend the `state` import and add the odds import:

```tsx
import { selectSpotlight, matchState, flagUrl, countdownParts } from '../../lib/worldcup/state'
import { allWcSlugs, matchHomePct, type PricesMap } from '../../lib/worldcup/odds'
```

(Replace the existing two import lines for `state` and `odds`.)

- [ ] **Step 2: Replace the `Spotlight` stub**

```tsx
function Flag({ iso, name, size = 80 }: { iso: string; name: string; size?: number }) {
  return (
    <img
      className="wc-flag"
      src={flagUrl(iso, size)}
      alt={name}
      width={size}
      height={Math.round((size * 3) / 4)}
      loading="lazy"
      onError={(e) => {
        const el = e.currentTarget
        el.style.display = 'none'
        const chip = el.nextElementSibling as HTMLElement | null
        if (chip) chip.style.display = 'inline-flex'
      }}
    />
  )
}

function Spotlight({
  fixture, now, prices, onYes,
}: {
  fixture: import('../../lib/worldcup/state').Fixture | null
  now: Date | null
  prices: PricesMap
  onYes: (c: string) => void
}) {
  if (!fixture || !now) {
    return (
      <section className="wc-spotlight" data-empty="true">
        <div className="wc-spotlight-eyebrow">Next matchday</div>
        <div className="wc-spotlight-title">Schedule loading…</div>
      </section>
    )
  }

  const state = matchState(fixture.kickoffISO, now)
  const cd = countdownParts(fixture.kickoffISO, now)
  const homePct = matchHomePct(prices, fixture.slug, fixture.home.name, fixture.fallback.home)
  const drawPct = fixture.fallback.draw
  const awayPct = Math.max(0, 100 - homePct - drawPct)

  const badge =
    state === 'live' ? <span className="wc-badge wc-badge-live"><i /> LIVE</span>
    : state === 'final' ? <span className="wc-badge wc-badge-final">FULL TIME</span>
    : <span className="wc-badge wc-badge-soon">
        {cd.d > 0 ? `${cd.d}d ` : ''}
        {String(cd.h).padStart(2, '0')}:{String(cd.m).padStart(2, '0')}:{String(cd.s).padStart(2, '0')}
      </span>

  return (
    <section className="wc-spotlight" data-state={state}>
      <div className="wc-spotlight-eyebrow">
        {state === 'live' ? 'Happening now' : state === 'final' ? 'Latest result' : 'Up next'} · Group {fixture.group}
      </div>

      <div className="wc-spotlight-match">
        <div className="wc-team">
          <Flag iso={fixture.home.iso} name={fixture.home.name} size={160} />
          <span className="wc-flag-chip" style={{ display: 'none' }}>{fixture.home.iso.toUpperCase()}</span>
          <span className="wc-team-name">{fixture.home.name}</span>
        </div>
        <div className="wc-spotlight-mid">{badge}<span className="wc-vs">vs</span></div>
        <div className="wc-team">
          <Flag iso={fixture.away.iso} name={fixture.away.name} size={160} />
          <span className="wc-flag-chip" style={{ display: 'none' }}>{fixture.away.iso.toUpperCase()}</span>
          <span className="wc-team-name">{fixture.away.name}</span>
        </div>
      </div>

      {fixture.venue && <div className="wc-spotlight-venue">{fixture.venue}</div>}

      <div className="wc-odds-row">
        <button className="wc-odd wc-odd-home" onClick={() => onYes(`${fixture.home.name} to win`)}>
          <span className="wc-odd-lbl">{fixture.home.name}</span>
          <span className="wc-odd-pct">{homePct}%</span>
        </button>
        <button className="wc-odd wc-odd-draw" onClick={() => onYes(`${fixture.home.name} v ${fixture.away.name} — Draw`)}>
          <span className="wc-odd-lbl">Draw</span>
          <span className="wc-odd-pct">{drawPct}%</span>
        </button>
        <button className="wc-odd wc-odd-away" onClick={() => onYes(`${fixture.away.name} to win`)}>
          <span className="wc-odd-lbl">{fixture.away.name}</span>
          <span className="wc-odd-pct">{awayPct}%</span>
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run dev`, load `/worldcup`.
Expected: spotlight shows two large flags, team names, a countdown badge (or LIVE/FULL TIME depending on the fixture times you set), venue, and three odds buttons. Clicking an odds button logs nothing yet but should not error (modal stub returns null). `npx tsc --noEmit` passes. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add app/worldcup/page.tsx
git commit -m "feat(worldcup): spotlight highlight with flags, countdown, live badge, odds"
```

---

## Task 6: Winner leaderboard

**Files:**
- Modify: `app/worldcup/page.tsx` (replace the `WinnerLeaderboard` stub; extend odds import)

- [ ] **Step 1: Extend the odds import**

Ensure the odds import line includes `winnerPct` and `CONTENDERS` is imported (it already is from fixtures):

```tsx
import { allWcSlugs, matchHomePct, winnerPct, type PricesMap } from '../../lib/worldcup/odds'
```

- [ ] **Step 2: Replace the `WinnerLeaderboard` stub**

```tsx
function WinnerLeaderboard({ prices, onYes }: { prices: PricesMap; onYes: (c: string) => void }) {
  // Overlay live odds, then sort high→low by the (live-or-fallback) pct.
  const rows = CONTENDERS
    .map((c) => ({ ...c, pct: winnerPct(prices, c.slug, c.fallbackPct) }))
    .sort((a, b) => b.pct - a.pct)
  const max = Math.max(...rows.map((r) => r.pct), 1)

  return (
    <section className="wc-leaderboard">
      <div className="wc-section-head">
        <h2 className="wc-section-title">Who wins the World Cup?</h2>
        <span className="wc-section-note">Live odds · updated continuously</span>
      </div>
      <div className="wc-leaderboard-list">
        {rows.map((r) => (
          <button key={r.name} className="wc-lb-row" onClick={() => onYes(`${r.name} to win the World Cup`)}>
            <img
              className="wc-lb-flag"
              src={flagUrl(r.iso, 40)}
              alt={r.name}
              width={28}
              height={21}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
            />
            <span className="wc-lb-name">{r.name}</span>
            <span className="wc-lb-bar"><i style={{ width: `${(r.pct / max) * 100}%` }} /></span>
            <span className="wc-lb-pct">{r.pct}%</span>
          </button>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run dev`, load `/worldcup`.
Expected: leaderboard lists contenders sorted by %, each with a flag, name, a gold bar, and a % (live values for Spain/France/Argentina/Brazil/England when `/api/prices` returns them, fallback otherwise). `npx tsc --noEmit` passes. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add app/worldcup/page.tsx
git commit -m "feat(worldcup): tournament-winner leaderboard with live odds + flags"
```

---

## Task 7: Upcoming matches grid

**Files:**
- Modify: `app/worldcup/page.tsx` (replace the `MatchGrid` stub)

- [ ] **Step 1: Replace the `MatchGrid` stub**

```tsx
function kickoffLabel(kickoffISO: string): string {
  const d = new Date(kickoffISO)
  const day = d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} · ${time}`
}

function MatchGrid({
  fixtures, now, prices, onYes,
}: {
  fixtures: import('../../lib/worldcup/state').Fixture[]
  now: Date | null
  prices: PricesMap
  onYes: (c: string) => void
}) {
  if (fixtures.length === 0) return null
  return (
    <section className="wc-grid">
      <div className="wc-section-head">
        <h2 className="wc-section-title">Upcoming matches</h2>
        <span className="wc-section-note">Tap a team to follow the market</span>
      </div>
      <div className="wc-grid-list">
        {fixtures.map((f) => {
          const state = now ? matchState(f.kickoffISO, now) : 'scheduled'
          const homePct = matchHomePct(prices, f.slug, f.home.name, f.fallback.home)
          const awayPct = Math.max(0, 100 - homePct - f.fallback.draw)
          return (
            <article key={f.id} className="wc-card" data-state={state}>
              <div className="wc-card-head">
                <span className="wc-card-group">Group {f.group}</span>
                <span className="wc-card-when">
                  {state === 'live' ? <span className="wc-badge wc-badge-live"><i /> LIVE</span>
                   : state === 'final' ? 'Full time'
                   : kickoffLabel(f.kickoffISO)}
                </span>
              </div>
              <div className="wc-card-teams">
                <button className="wc-card-team" onClick={() => onYes(`${f.home.name} to win`)}>
                  <img className="wc-card-flag" src={flagUrl(f.home.iso, 40)} alt={f.home.name} width={28} height={21} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                  <span className="wc-card-team-name">{f.home.name}</span>
                  <span className="wc-card-team-pct">{homePct}%</span>
                </button>
                <button className="wc-card-team" onClick={() => onYes(`${f.away.name} to win`)}>
                  <img className="wc-card-flag" src={flagUrl(f.away.iso, 40)} alt={f.away.name} width={28} height={21} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                  <span className="wc-card-team-name">{f.away.name}</span>
                  <span className="wc-card-team-pct">{awayPct}%</span>
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run dev`, load `/worldcup`.
Expected: a grid of match cards (excluding the spotlight match), each with group, kickoff time (or LIVE/Full time), and two tappable team rows with flags + %. `npx tsc --noEmit` passes. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add app/worldcup/page.tsx
git commit -m "feat(worldcup): upcoming matches grid"
```

---

## Task 8: Waitlist capture modal + CTA strip

**Files:**
- Modify: `app/worldcup/page.tsx` (replace `WaitlistModal` and `CtaStrip` stubs)

Reuses `POST /api/waitlist` with `source: 'worldcup'`. The `context` string (e.g. "Spain to win the World Cup") is sent as `why` so the team can see which market drove the signal.

- [ ] **Step 1: Replace the `CtaStrip` and `WaitlistModal` stubs**

```tsx
function CtaStrip() {
  return (
    <section className="wc-cta">
      <h2 className="wc-cta-title">Trade the World Cup. <em>Settled in pesos.</em></h2>
      <p className="wc-cta-sub">Get in before the final — founding members trade zero-fee for life.</p>
      <button className="wc-cta-btn" onClick={() => {
        const el = document.getElementById('wc-waitlist-anchor')
        el?.scrollIntoView({ behavior: 'smooth' })
      }}>
        Reserve your handle →
      </button>
      <span id="wc-waitlist-anchor" />
    </section>
  )
}

function WaitlistModal({ context, onClose }: { context: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'worldcup', why: context }),
      })
      setStatus(res.ok ? 'success' : 'error')
      if (res.ok) setEmail('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="wc-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wc-modal-card">
        <button className="wc-modal-x" onClick={onClose} aria-label="Close">×</button>
        <div className="wc-modal-eyebrow">World Cup 2026</div>
        <h3 className="wc-modal-title">{context}</h3>
        <p className="wc-modal-sub">
          We&apos;re pre-launch. Drop your email and we&apos;ll let you trade this market the moment we go live.
        </p>
        {status === 'success' ? (
          <div className="wc-modal-done">You&apos;re in — salamat! We&apos;ll be in touch.</div>
        ) : (
          <form className="wc-modal-form" onSubmit={submit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.ph"
              disabled={status === 'loading'}
              required
            />
            <button type="submit" className="wc-cta-btn" disabled={status === 'loading' || !email.trim()}>
              {status === 'loading' ? 'Loading…' : 'Notify me →'}
            </button>
            {status === 'error' && <div className="wc-modal-err">Something broke. Try again.</div>}
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the React type import**

Ensure the top-of-file import includes the React types used (`useState` is already imported). No extra import needed for `React.FormEvent` since it's a global type via `@types/react`. Confirm `npx tsc --noEmit` passes.

- [ ] **Step 3: Verify**

Run: `npm run dev`, load `/worldcup`.
Expected: clicking any odds/team/leaderboard button opens the modal titled with that market; submitting an email shows the success state. CTA strip renders and its button scrolls. Network tab shows `POST /api/waitlist` with `{source:'worldcup', why:'…'}`. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add app/worldcup/page.tsx
git commit -m "feat(worldcup): waitlist capture modal + CTA strip"
```

---

## Task 9: World Cup theme styles (`wc-*` namespace)

**Files:**
- Modify: `app/globals.css` (append at end of file)

Built on the existing dark `--t-*` tournament tokens (`--t-bg #0A0A0B`, `--t-surface #141417`, `--t-gold #F4B942`, `--t-text`, `--t-text-2`, `--t-success`, `--t-danger`). Mobile-first; this is a masa-reachable surface.

- [ ] **Step 1: Append the stylesheet**

Add to the end of `app/globals.css`:

```css
/* ── /worldcup — World Cup 2026 hub ─────────────────────────────────────── */
.hula-v2.wc {
  background: var(--t-bg);
  color: var(--t-text);
  min-height: 100vh;
  font-family: var(--sans);
  padding-bottom: 40px;
}
.wc * { box-sizing: border-box; }
.wc-header {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 18px; border-bottom: 1px solid var(--t-border);
  position: sticky; top: 0; background: rgba(10,10,11,0.9); backdrop-filter: blur(8px); z-index: 10;
}
.wc-back { color: var(--t-text-2); text-decoration: none; font-size: 14px; font-weight: 500; }
.wc-back:hover { color: var(--t-text); }
.wc-wordmark { font-family: var(--serif); font-size: 18px; font-weight: 600; }
.wc-wordmark em { color: var(--t-gold); font-style: italic; }
.wc-updated {
  margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em; color: var(--t-text-2);
  text-transform: uppercase;
}
.wc-updated-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--t-success); box-shadow: 0 0 0 0 var(--t-success); animation: wc-pulse 2s infinite; }
@keyframes wc-pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); } 70% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }

/* Spotlight */
.wc-spotlight {
  margin: 20px 16px; padding: 24px 20px; border-radius: 20px;
  background: radial-gradient(120% 100% at 50% 0%, #1a1a20 0%, var(--t-surface) 60%);
  border: 1px solid var(--t-border); text-align: center;
}
.wc-spotlight[data-state="live"] { border-color: rgba(16,185,129,0.4); }
.wc-spotlight-eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--t-gold); }
.wc-spotlight-title { font-family: var(--serif); font-size: 22px; margin-top: 8px; }
.wc-spotlight-match { display: flex; align-items: flex-start; justify-content: center; gap: 18px; margin: 20px 0 8px; }
.wc-team { display: flex; flex-direction: column; align-items: center; gap: 10px; flex: 1; max-width: 140px; }
.wc-flag { border-radius: 6px; box-shadow: 0 2px 12px rgba(0,0,0,0.5); object-fit: cover; }
.wc-flag-chip { display: inline-flex; align-items: center; justify-content: center; width: 120px; height: 90px; border-radius: 6px; background: var(--t-surface-2); font-family: var(--mono); font-size: 22px; color: var(--t-text-2); }
.wc-team-name { font-size: 15px; font-weight: 600; }
.wc-spotlight-mid { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 18px; }
.wc-vs { font-family: var(--serif); font-style: italic; color: var(--t-text-2); font-size: 14px; }
.wc-spotlight-venue { font-size: 12px; color: var(--t-text-3); margin-bottom: 16px; }

.wc-badge { font-family: var(--mono); font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 999px; letter-spacing: 0.04em; display: inline-flex; align-items: center; gap: 5px; }
.wc-badge-live { background: var(--t-yes-bg); color: var(--t-success); }
.wc-badge-live i { width: 6px; height: 6px; border-radius: 999px; background: var(--t-success); animation: wc-pulse 1.4s infinite; }
.wc-badge-final { background: var(--t-surface-2); color: var(--t-text-2); }
.wc-badge-soon { background: rgba(244,185,66,0.12); color: var(--t-gold); font-variant-numeric: tabular-nums; }

/* Odds buttons (shared) */
.wc-odds-row { display: grid; grid-template-columns: 1fr 0.8fr 1fr; gap: 8px; }
.wc-odd { display: flex; flex-direction: column; gap: 3px; padding: 12px 8px; border-radius: 12px; border: 1px solid var(--t-border); background: var(--t-surface-2); color: var(--t-text); cursor: pointer; transition: border-color 0.15s, transform 0.05s; }
.wc-odd:hover { border-color: var(--t-gold); }
.wc-odd:active { transform: translateY(1px); }
.wc-odd-lbl { font-size: 12px; color: var(--t-text-2); }
.wc-odd-pct { font-family: var(--mono); font-size: 18px; font-weight: 600; }

/* Section heads */
.wc-section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 28px 18px 12px; gap: 12px; }
.wc-section-title { font-family: var(--serif); font-size: 20px; font-weight: 600; }
.wc-section-note { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--t-text-3); }

/* Leaderboard */
.wc-leaderboard-list { display: flex; flex-direction: column; gap: 6px; margin: 0 16px; }
.wc-lb-row { display: grid; grid-template-columns: 28px 1fr 2fr auto; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--t-border); background: var(--t-surface); color: var(--t-text); cursor: pointer; text-align: left; }
.wc-lb-row:hover { border-color: var(--t-gold); }
.wc-lb-flag { border-radius: 3px; object-fit: cover; }
.wc-lb-name { font-size: 14px; font-weight: 600; }
.wc-lb-bar { height: 8px; border-radius: 999px; background: var(--t-surface-2); overflow: hidden; }
.wc-lb-bar > i { display: block; height: 100%; background: linear-gradient(90deg, var(--t-gold), #ffd97a); }
.wc-lb-pct { font-family: var(--mono); font-size: 14px; font-weight: 600; min-width: 38px; text-align: right; }

/* Match grid */
.wc-grid-list { display: grid; grid-template-columns: 1fr; gap: 10px; margin: 0 16px; }
@media (min-width: 620px) { .wc-grid-list { grid-template-columns: 1fr 1fr; } }
.wc-card { border: 1px solid var(--t-border); border-radius: 14px; background: var(--t-surface); padding: 14px; }
.wc-card[data-state="live"] { border-color: rgba(16,185,129,0.4); }
.wc-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.wc-card-group { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--t-text-3); }
.wc-card-when { font-family: var(--mono); font-size: 11px; color: var(--t-text-2); }
.wc-card-teams { display: flex; flex-direction: column; gap: 6px; }
.wc-card-team { display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; border: 1px solid transparent; background: var(--t-surface-2); color: var(--t-text); cursor: pointer; text-align: left; }
.wc-card-team:hover { border-color: var(--t-gold); }
.wc-card-flag { border-radius: 3px; object-fit: cover; }
.wc-card-team-name { font-size: 14px; font-weight: 500; }
.wc-card-team-pct { font-family: var(--mono); font-size: 14px; font-weight: 600; }

/* CTA */
.wc-cta { margin: 32px 16px 0; padding: 28px 22px; border-radius: 20px; text-align: center; background: linear-gradient(135deg, #1a1407, var(--t-surface)); border: 1px solid rgba(244,185,66,0.25); }
.wc-cta-title { font-family: var(--serif); font-size: 22px; }
.wc-cta-title em { color: var(--t-gold); font-style: italic; }
.wc-cta-sub { color: var(--t-text-2); font-size: 14px; margin: 8px 0 18px; }
.wc-cta-btn { background: var(--t-gold); color: #1a1407; border: none; border-radius: 12px; padding: 13px 22px; font-size: 15px; font-weight: 600; cursor: pointer; }
.wc-cta-btn:hover { filter: brightness(1.05); }
.wc-cta-btn:disabled { opacity: 0.6; cursor: default; }

/* Modal */
.wc-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
.wc-modal-card { position: relative; width: 100%; max-width: 380px; background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 18px; padding: 26px 22px; }
.wc-modal-x { position: absolute; top: 12px; right: 14px; background: none; border: none; color: var(--t-text-2); font-size: 24px; cursor: pointer; line-height: 1; }
.wc-modal-eyebrow { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--t-gold); }
.wc-modal-title { font-family: var(--serif); font-size: 20px; margin: 6px 0 10px; }
.wc-modal-sub { font-size: 14px; color: var(--t-text-2); margin-bottom: 16px; }
.wc-modal-form { display: flex; flex-direction: column; gap: 10px; }
.wc-modal-form input { padding: 13px 14px; border-radius: 12px; border: 1px solid var(--t-border); background: var(--t-bg); color: var(--t-text); font-size: 15px; }
.wc-modal-form input:focus { outline: 2px solid var(--t-gold); outline-offset: 1px; }
.wc-modal-done { font-size: 15px; color: var(--t-success); padding: 8px 0; }
.wc-modal-err { font-size: 13px; color: var(--t-danger); }

/* Footer */
.wc-foot { text-align: center; font-size: 12px; color: var(--t-text-3); margin: 32px 18px 0; }
.wc-foot strong { color: var(--t-text-2); }
```

- [ ] **Step 2: Verify the full page**

Run: `npm run dev`, load `/worldcup` on a narrow viewport (375px) and a wide one.
Expected: dark premium theme; spotlight flags large and crisp; gold leaderboard bars; cards reflow to two columns ≥620px; modal centered and legible. No layout overflow. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style(worldcup): dark premium wc-* theme (flags, gold accents, mobile-first)"
```

---

## Task 10: Full test + build verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

Run: `npx vitest run lib/worldcup/`
Expected: all three test files pass (state, odds, fixtures).

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/worldcup` appears in the route list.

- [ ] **Step 4: Final manual pass**

Run: `npm run dev`, load `/worldcup`. Confirm against the spec's freshness mechanics:
- Spotlight shows the live match if one is in its 120-min window, else the nearest upcoming with a ticking countdown, else the most recent final.
- "Updated {today}" stamp shows today's date.
- Flags load for all teams; a forced bad ISO would fall back to a chip (optional spot-check).
- Clicking any market opens the waitlist modal and a successful submit shows the done state.

Stop dev server.

- [ ] **Step 5: Commit any final touch-ups** (only if Step 4 surfaced fixes)

```bash
git add -A
git commit -m "chore(worldcup): final verification touch-ups"
```

---

## Notes for the implementer

- **Do not** call `Date.now()` inside `lib/worldcup/state.ts` / `odds.ts` — `now` is always passed in (keeps tests deterministic; the page owns the clock).
- **Flags** come from `flagcdn.com` via plain `<img>` — no `next.config.js` image-domain change needed. If you later switch to `next/image`, add `flagcdn.com` to `images.remotePatterns`.
- **Odds are best-effort.** If `/api/prices` returns `{}` (all slugs unknown/stale), every surface must still render from curated fallbacks. Verify by blocking the request in devtools.
- **Kickoff times** in `FIXTURES` are illustrative. For a convincing demo, set at least one fixture's `kickoffISO` to within the next hour (countdown) and optionally one into its live window (LIVE badge).
- **Linking from the homepage** is intentionally not part of this plan (a launch decision per the spec). `/worldcup` is reachable by direct URL.
