# World Cup Market Detail Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every World Cup fixture its own shareable market page at `/worldcup/[fixtureId]` with matchup header, odds panel, volume, and resolution terms.

**Architecture:** A server component resolves the fixture (DB-or-fallback) and server-renders it for no-flash first paint; a client child overlays live Polymarket odds and owns the waitlist modal. Shared UI (`Flag`, `WaitlistModal`, label helpers) is extracted from `hub.tsx` into `app/worldcup/shared.tsx` so both the hub and the detail page reuse it. The hub's match cards and spotlight become links to the new pages (a card is a preview; the page is where you act).

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Vitest, plain CSS in `app/globals.css`.

## Global Constraints

- Pure helpers in `lib/worldcup/*` must be deterministic: **no `Date.now()`, no `Math.random()`, no argless `new Date()`** — callers pass `now`. (Existing convention in `lib/worldcup`.)
- Catalog reads degrade to hardcoded data on ANY failure; never throw to the user. The detail page must still render from `FIXTURES` when the DB is empty/erroring.
- `lib/catalog/read.ts` is server-only (service-role client) — NEVER import it from a client component.
- Live-odds overlay is best-effort: any fetch failure keeps the curated fallback. Never blank.
- Copy tone matches the existing hub: "21+ only", "Pre-launch — no real bets yet", peso framing (₱).
- CTA on this page is the **existing `WaitlistModal`** (source `'worldcup'`). No real bet flow in this pass.
- Styling uses existing CSS variables (`--paper`, `--line`, `--line-2`, `--ink`, `--ink-2`, `--ink-3`, `--ff-sans`, `--ff-mono`, `--up`) and the existing `.wc` / `.hula-v2` theme classes.

---

### Task 1: Pure helpers (`getFixtureById`, `fixtureVolLabel`, `resolutionText`)

**Files:**
- Create: `lib/worldcup/market.ts`
- Test: `lib/worldcup/market.test.ts`

**Interfaces:**
- Consumes: `Fixture` from `lib/worldcup/state`; `liveVol`, `compressVol`, `formatPeso`, `PricesMap` from `lib/worldcup/odds`.
- Produces:
  - `getFixtureById(fixtures: Fixture[], id: string): Fixture | null`
  - `type VolLabel = { label: string; live: boolean }`
  - `fixtureVolLabel(prices: PricesMap, fixture: Fixture): VolLabel`
  - `resolutionText(fixture: Fixture): string`

- [ ] **Step 1: Write the failing test**

Create `lib/worldcup/market.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getFixtureById, fixtureVolLabel, resolutionText } from './market'
import type { Fixture } from './state'
import type { PricesMap } from './odds'

const fx: Fixture = {
  id: 'wc-tun-ned',
  home: { name: 'Tunisia', iso: 'tn' },
  away: { name: 'Netherlands', iso: 'nl' },
  group: 'F',
  kickoffISO: '2026-06-25T23:00:00.000Z',
  fallback: { home: 16, draw: 26, away: 58 },
}

describe('getFixtureById', () => {
  it('finds a fixture by id', () => {
    expect(getFixtureById([fx], 'wc-tun-ned')).toBe(fx)
  })
  it('returns null when not found', () => {
    expect(getFixtureById([fx], 'nope')).toBeNull()
  })
  it('returns null for an empty list', () => {
    expect(getFixtureById([], 'wc-tun-ned')).toBeNull()
  })
})

describe('fixtureVolLabel', () => {
  it('uses live Polymarket volume when the slug resolves fresh', () => {
    const prices: PricesMap = {
      'wc-x': { outcomes: [{ name: 'Yes', price: 0.5 }], is_stale: false, fetched_at: 'now', volume_usd: 5_000_000 },
    }
    const out = fixtureVolLabel(prices, { ...fx, slug: 'wc-x' })
    expect(out.live).toBe(true)
    expect(out.label.startsWith('₱')).toBe(true)
  })
  it('falls back to a deterministic indicative label when there is no slug', () => {
    const out = fixtureVolLabel({}, fx)
    expect(out.live).toBe(false)
    expect(out.label.startsWith('₱')).toBe(true)
  })
  it('is deterministic for the same fixture', () => {
    expect(fixtureVolLabel({}, fx).label).toBe(fixtureVolLabel({}, fx).label)
  })
})

describe('resolutionText', () => {
  it('names both teams', () => {
    const t = resolutionText(fx)
    expect(t).toContain('Tunisia')
    expect(t).toContain('Netherlands')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/worldcup/market.test.ts`
Expected: FAIL — cannot resolve `./market` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `lib/worldcup/market.ts`:

```ts
/* Pure helpers for the per-fixture market detail page (/worldcup/[id]).
 * Deterministic — no Date.now()/Math.random(), same input → same output. */

import type { Fixture } from './state'
import { liveVol, compressVol, formatPeso, type PricesMap } from './odds'

export function getFixtureById(fixtures: Fixture[], id: string): Fixture | null {
  return fixtures.find((f) => f.id === id) ?? null
}

export type VolLabel = { label: string; live: boolean }

// Live Polymarket volume when the fixture's slug resolves to a fresh row;
// otherwise a deterministic INDICATIVE figure derived from how competitive the
// match is (tighter odds → more interest). The derived USD proxy is fed through
// the SAME compression band as the live path (lib/worldcup/odds), so indicative
// labels read at the same peso scale as real ones. No clock, no randomness.
export function fixtureVolLabel(prices: PricesMap, fixture: Fixture): VolLabel {
  const live = liveVol(prices, fixture.slug, '')
  if (live) return { label: live, live: true }

  const spread = Math.abs(fixture.fallback.home - fixture.fallback.away) // 0..100
  const competitiveness = 1 - spread / 100 // 1 = coin-flip, 0 = blowout
  const usd = 200_000 * Math.pow(50, competitiveness) // ~₱200K..₱10M band
  return { label: formatPeso(compressVol(usd)), live: false }
}

export function resolutionText(fixture: Fixture): string {
  return `Resolves to the result of ${fixture.home.name} vs ${fixture.away.name} at full time (90 minutes plus stoppage). "Draw" settles if the score is level after 90 minutes.`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/worldcup/market.test.ts`
Expected: PASS — all 8 assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/worldcup/market.ts lib/worldcup/market.test.ts
git commit -m "feat(worldcup): pure helpers for market detail page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Extract shared UI into `app/worldcup/shared.tsx`

Pure de-duplication, no behavior change. Moves `Flag`, `WaitlistModal`, `groupLabel`, `kickoffLabel` out of `hub.tsx` so the detail page can reuse them.

**Files:**
- Create: `app/worldcup/shared.tsx`
- Modify: `app/worldcup/hub.tsx` (remove the moved definitions; import them)

**Interfaces:**
- Produces (from `app/worldcup/shared.tsx`):
  - `Flag({ iso, name, size? }: { iso: string; name: string; size?: number })`
  - `WaitlistModal({ context, onClose }: { context: string; onClose: () => void })`
  - `groupLabel(group: string): string`
  - `kickoffLabel(kickoffISO: string): string`

- [ ] **Step 1: Create the shared module**

Create `app/worldcup/shared.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { flagUrl } from '../../lib/worldcup/state'

/* Shared /worldcup UI — used by the hub (hub.tsx) and the per-fixture market
 * detail page (app/worldcup/[fixtureId]/detail.tsx). Extracted verbatim from
 * hub.tsx; no behavior change. */

export function Flag({ iso, name, size = 80 }: { iso: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span className="wc-flag-chip" style={{ width: size, height: Math.round((size * 3) / 4) }}>{iso.toUpperCase()}</span>
  }
  return (
    <img
      className="wc-flag"
      src={flagUrl(iso, size)}
      alt={name}
      width={size}
      height={Math.round((size * 3) / 4)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

// Group-stage codes ("A".."L") render as "Group A"; knockout stage names
// (e.g. "Round of 32", "Quarter-final") render as-is.
export function groupLabel(group: string): string {
  return /^[A-Z]$/i.test(group) ? `Group ${group}` : group
}

export function kickoffLabel(kickoffISO: string): string {
  const d = new Date(kickoffISO)
  const day = d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} · ${time}`
}

export function WaitlistModal({ context, onClose }: { context: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  // Dismiss on Escape and pull focus into the dialog when it opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      <div className="wc-modal-card" role="dialog" aria-modal="true" aria-labelledby="wc-modal-title">
        <button className="wc-modal-x" onClick={onClose} aria-label="Close">×</button>
        <div className="wc-modal-eyebrow">World Cup 2026</div>
        <h3 className="wc-modal-title" id="wc-modal-title">{context}</h3>
        <p className="wc-modal-sub">
          We&apos;re pre-launch. Drop your email and we&apos;ll let you trade this market the moment we go live.
        </p>
        {status === 'success' ? (
          <div className="wc-modal-done">You&apos;re in — salamat! We&apos;ll be in touch.</div>
        ) : (
          <form className="wc-modal-form" onSubmit={submit}>
            <input
              ref={inputRef}
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

- [ ] **Step 2: Update `hub.tsx` to import the shared module**

In `app/worldcup/hub.tsx`, after the existing imports (around line 7), add:

```tsx
import { Flag, WaitlistModal, groupLabel, kickoffLabel } from './shared'
```

Then **delete** these four now-duplicated definitions from `hub.tsx`:
- `function Flag(...)` (around lines 109–125)
- `function groupLabel(...)` (around lines 250–252)
- `function kickoffLabel(...)` (around lines 253–258)
- `function WaitlistModal(...)` (around lines 334–395)

Leave everything else (`WorldCupHub`, `Spotlight`, `WinnerLeaderboard`, `MatchGrid`, `CtaStrip`) in place. `flagUrl` is still imported and used directly inside `WinnerLeaderboard`/`MatchGrid` `<img>` tags — keep that import.

- [ ] **Step 3: Verify types and existing tests still pass**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: PASS — existing suites (including `app/api/worldcup/route.test.ts`, `lib/worldcup/*`) unchanged and green.

- [ ] **Step 4: Commit**

```bash
git add app/worldcup/shared.tsx app/worldcup/hub.tsx
git commit -m "refactor(worldcup): extract Flag/WaitlistModal/labels into shared.tsx

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Detail page route (server `page.tsx` + client `detail.tsx`) + styles

Builds the `/worldcup/[fixtureId]` page: server resolves the fixture, client renders the 4 sections.

**Files:**
- Create: `app/worldcup/[fixtureId]/page.tsx`
- Create: `app/worldcup/[fixtureId]/detail.tsx`
- Modify: `app/globals.css` (append `wc-detail-*` styles after the existing `.wc` block)

**Interfaces:**
- Consumes: `getFixtureById`, `fixtureVolLabel`, `resolutionText` (Task 1); `Flag`, `WaitlistModal`, `groupLabel`, `kickoffLabel` (Task 2); `fetchApprovedWcFixtures` from `lib/catalog/read`; `FIXTURES` from `lib/worldcup/fixtures`; `matchState`, `countdownParts`, `Fixture` from `lib/worldcup/state`; `matchHomePct`, `PricesMap` from `lib/worldcup/odds`.
- Produces: default-exported `MarketDetail({ fixture }: { fixture: Fixture })` (client) and the route's server `page.tsx`.

- [ ] **Step 1: Create the client detail component**

Create `app/worldcup/[fixtureId]/detail.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { matchState, countdownParts, type Fixture } from '../../../lib/worldcup/state'
import { matchHomePct, type PricesMap } from '../../../lib/worldcup/odds'
import { fixtureVolLabel, resolutionText } from '../../../lib/worldcup/market'
import { Flag, WaitlistModal, groupLabel, kickoffLabel } from '../shared'

/* /worldcup/[fixtureId] — single match market page. Server-rendered fixture
 * (page.tsx) + best-effort live Polymarket overlay. CTA opens the waitlist
 * modal (no real bet flow yet). See
 * docs/superpowers/specs/2026-06-29-worldcup-market-detail-page-design.md. */

export default function MarketDetail({ fixture }: { fixture: Fixture }) {
  const [now, setNow] = useState<Date | null>(null)
  const [prices, setPrices] = useState<PricesMap>({})
  const [waitlistFor, setWaitlistFor] = useState<string | null>(null)

  // Defer `now` to mount (avoids hydration mismatch); tick for the countdown.
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Best-effort live odds for this fixture's slug. Any failure keeps fallbacks.
  useEffect(() => {
    if (!fixture.slug) return
    let cancelled = false
    fetch(`/api/prices?events=${fixture.slug}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: PricesMap) => { if (!cancelled) setPrices(data) })
      .catch(() => { /* keep fallbacks */ })
    return () => { cancelled = true }
  }, [fixture.slug])

  const state = now ? matchState(fixture.kickoffISO, now) : 'scheduled'
  const cd = now ? countdownParts(fixture.kickoffISO, now) : { d: 0, h: 0, m: 0, s: 0 }
  const homePct = matchHomePct(prices, fixture.slug, fixture.home.name, fixture.fallback.home)
  const drawPct = fixture.fallback.draw
  const awayPct = Math.max(0, 100 - homePct - drawPct)
  const vol = fixtureVolLabel(prices, fixture)

  const badge =
    state === 'live' ? <span className="wc-badge wc-badge-live"><i aria-hidden="true" /> LIVE</span>
    : state === 'final' ? <span className="wc-badge wc-badge-final">FULL TIME</span>
    : <span className="wc-badge wc-badge-soon" suppressHydrationWarning>
        {cd.d > 0 ? `${cd.d}d ` : ''}
        {String(cd.h).padStart(2, '0')}:{String(cd.m).padStart(2, '0')}:{String(cd.s).padStart(2, '0')}
      </span>

  return (
    <main className="hula-v2 wc">
      <header className="wc-header">
        <Link href="/worldcup" className="wc-back">← All matches</Link>
        <span className="wc-wordmark">World Cup <em>2026</em></span>
        <span className="wc-updated"><span className="wc-updated-dot" /> live odds</span>
      </header>

      {/* 1. Matchup header */}
      <section className="wc-detail-hero" data-state={state}>
        <div className="wc-detail-eyebrow">{groupLabel(fixture.group)} · {kickoffLabel(fixture.kickoffISO)}</div>
        <div className="wc-spotlight-match">
          <div className="wc-team">
            <Flag iso={fixture.home.iso} name={fixture.home.name} size={160} />
            <span className="wc-team-name">{fixture.home.name}</span>
          </div>
          <div className="wc-spotlight-mid">{badge}<span className="wc-vs">vs</span></div>
          <div className="wc-team">
            <Flag iso={fixture.away.iso} name={fixture.away.name} size={160} />
            <span className="wc-team-name">{fixture.away.name}</span>
          </div>
        </div>
        {fixture.venue && <div className="wc-spotlight-venue">{fixture.venue}</div>}
      </section>

      {/* 2. Odds panel — the action surface */}
      <section className="wc-detail-panel">
        <div className="wc-panel-note">Match result · price = chance · tap to follow</div>
        <div className="wc-odds-row">
          <button className="wc-odd wc-odd-home" onClick={() => setWaitlistFor(`${fixture.home.name} to beat ${fixture.away.name}`)}>
            <span className="wc-odd-lbl">{fixture.home.name}</span>
            <span className="wc-odd-pct">{homePct}%</span>
          </button>
          <button className="wc-odd wc-odd-draw" onClick={() => setWaitlistFor(`${fixture.home.name} v ${fixture.away.name} — Draw`)}>
            <span className="wc-odd-lbl">Draw</span>
            <span className="wc-odd-pct">{drawPct}%</span>
          </button>
          <button className="wc-odd wc-odd-away" onClick={() => setWaitlistFor(`${fixture.away.name} to beat ${fixture.home.name}`)}>
            <span className="wc-odd-lbl">{fixture.away.name}</span>
            <span className="wc-odd-pct">{awayPct}%</span>
          </button>
        </div>
      </section>

      {/* 3. Live volume */}
      <section className="wc-detail-stats">
        <div className="wc-detail-stat">
          <span className="wc-detail-stat-val">{vol.label}</span>
          <span className="wc-detail-stat-lbl">{vol.live ? 'Market volume · live' : 'Market volume · indicative'}</span>
        </div>
      </section>

      {/* 4. Market details / resolution */}
      <section className="wc-detail-rules">
        <h2 className="wc-detail-rules-title">How this market resolves</h2>
        <p className="wc-detail-rules-body">{resolutionText(fixture)}</p>
        <dl className="wc-detail-meta">
          <div><dt>Closes</dt><dd>{kickoffLabel(fixture.kickoffISO)}</dd></div>
          <div><dt>Source</dt><dd>{fixture.slug ? 'Live odds via Polymarket' : 'Curated odds'}</dd></div>
        </dl>
        <p className="wc-detail-disclaimer">21+ only · Pre-launch — no real bets yet</p>
      </section>

      {waitlistFor && <WaitlistModal context={waitlistFor} onClose={() => setWaitlistFor(null)} />}
    </main>
  )
}
```

- [ ] **Step 2: Create the server route**

Create `app/worldcup/[fixtureId]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { fetchApprovedWcFixtures } from '../../../lib/catalog/read'
import { FIXTURES } from '../../../lib/worldcup/fixtures'
import { getFixtureById } from '../../../lib/worldcup/market'
import MarketDetail from './detail'

/* /worldcup/[fixtureId] — server shell. Resolves the fixture from the
 * operator-curated catalog (DB → hardcoded FIXTURES fallback, same posture as
 * the hub) on the server, so the first paint is correct. 404s on unknown ids. */

export const dynamic = 'force-dynamic'

async function loadFixture(id: string) {
  const db = await fetchApprovedWcFixtures()
  const fixtures = db.length ? db : FIXTURES
  return getFixtureById(fixtures, id)
}

export async function generateMetadata(
  { params }: { params: { fixtureId: string } },
): Promise<Metadata> {
  const fixture = await loadFixture(params.fixtureId)
  if (!fixture) return { title: 'World Cup 2026 markets | Hula' }
  const matchup = `${fixture.home.name} vs ${fixture.away.name}`
  return {
    title: `${matchup} — World Cup 2026 | Hula`,
    description: `Live prediction-market odds for ${matchup}. Trade the World Cup on Hula.`,
  }
}

export default async function MarketPage({ params }: { params: { fixtureId: string } }) {
  const fixture = await loadFixture(params.fixtureId)
  if (!fixture) notFound()
  return <MarketDetail fixture={fixture} />
}
```

- [ ] **Step 3: Append detail-page styles**

In `app/globals.css`, after the existing `.wc-foot` rules (around line 3134, end of the World Cup hub block), append:

```css
/* ── /worldcup/[id] — single market detail page ─────────────────────────── */
.wc-detail-hero, .wc-detail-panel, .wc-detail-stats, .wc-detail-rules {
  max-width: 1120px; margin-inline: auto;
}
.wc-detail-hero {
  background: var(--paper); border: 1px solid var(--line); border-radius: 18px;
  padding: 28px 24px; margin-top: 18px; text-align: center;
}
@media (max-width: 720px) { .wc-detail-hero { margin-inline: 16px; padding: 22px 18px; } }
.wc-detail-hero[data-state="live"] { border-color: rgba(31,122,58,.45); }
.wc-detail-eyebrow {
  font-family: var(--ff-mono); font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.12em; color: var(--ink-3);
}
.wc-detail-panel { margin-top: 16px; }
@media (max-width: 720px) { .wc-detail-panel { margin-inline: 16px; } }
.wc-detail-stats { margin-top: 16px; display: flex; gap: 12px; }
@media (max-width: 720px) { .wc-detail-stats { margin-inline: 16px; } }
.wc-detail-stat {
  background: var(--paper); border: 1px solid var(--line); border-radius: 14px;
  padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; flex: 1;
}
.wc-detail-stat-val { font-family: var(--ff-mono); font-size: 22px; font-weight: 600; }
.wc-detail-stat-lbl {
  font-family: var(--ff-mono); font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--ink-3);
}
.wc-detail-rules {
  margin-top: 16px; background: var(--paper); border: 1px solid var(--line);
  border-radius: 14px; padding: 20px 22px;
}
@media (max-width: 720px) { .wc-detail-rules { margin-inline: 16px; } }
.wc-detail-rules-title {
  font-family: var(--ff-sans); font-size: 16px; font-weight: 600;
  letter-spacing: -0.01em; margin: 0 0 8px;
}
.wc-detail-rules-body {
  font-family: var(--ff-sans); font-size: 14px; line-height: 1.55;
  color: var(--ink-2); margin: 0 0 16px;
}
.wc-detail-meta { display: flex; gap: 28px; margin: 0 0 14px; flex-wrap: wrap; }
.wc-detail-meta dt {
  font-family: var(--ff-mono); font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--ink-3);
}
.wc-detail-meta dd { font-family: var(--ff-mono); font-size: 13px; margin: 2px 0 0; }
.wc-detail-disclaimer {
  font-family: var(--ff-mono); font-size: 11px; letter-spacing: 0.04em;
  color: var(--ink-3); margin: 0;
}
```

- [ ] **Step 4: Verify types compile and the production build succeeds**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds and the route list includes `/worldcup/[fixtureId]`.

- [ ] **Step 5: Smoke-test in dev**

Run: `npm run dev`, then open `http://localhost:3000/worldcup/wc-tun-ned`.
Expected: matchup header (Tunisia vs Netherlands, group + kickoff, countdown badge), 3-way odds panel, a volume stat labelled "indicative", and the resolution section. Tapping an odd opens the waitlist modal. Open `http://localhost:3000/worldcup/does-not-exist` → Next's 404 page.

- [ ] **Step 6: Commit**

```bash
git add "app/worldcup/[fixtureId]/page.tsx" "app/worldcup/[fixtureId]/detail.tsx" app/globals.css
git commit -m "feat(worldcup): per-fixture market detail page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Make hub cards + spotlight link to the detail pages (option B)

A card is now a preview that navigates to its market page; card-level odds become display-only. The winner leaderboard is unchanged.

**Files:**
- Modify: `app/worldcup/hub.tsx` (`Spotlight`, `MatchGrid`, and the `WorldCupHub` render that wires them)
- Modify: `app/globals.css` (link-wrapper reset for cards)

**Interfaces:**
- Consumes: `Link` from `next/link` (already imported in `hub.tsx`); routes created in Task 3.
- Produces: no new exports. `Spotlight` and `MatchGrid` drop their `onYes` prop; `WinnerLeaderboard` keeps its `onYes`.

- [ ] **Step 1: Convert `Spotlight` to a link with display-only odds**

In `app/worldcup/hub.tsx`, change the `Spotlight` signature to drop `onYes`:

```tsx
function Spotlight({
  fixture, now, prices,
}: {
  fixture: Fixture | null
  now: Date | null
  prices: PricesMap
}) {
```

Replace the odds-row block (the three `<button className="wc-odd …" onClick={() => onYes(...)}>` elements) with display-only spans, and wrap the populated card body in a link to the fixture page. The returned populated `<section>` becomes:

```tsx
  return (
    <Link href={`/worldcup/${fixture.id}`} className="wc-spotlight-link">
      <section className="wc-spotlight" data-state={state}>
        <div className="wc-spotlight-eyebrow">
          {state === 'live' ? 'Happening now' : state === 'final' ? 'Latest result' : 'Up next'} · {groupLabel(fixture.group)}
        </div>

        <div className="wc-spotlight-match">
          <div className="wc-team">
            <Flag iso={fixture.home.iso} name={fixture.home.name} size={160} />
            <span className="wc-team-name">{fixture.home.name}</span>
          </div>
          <div className="wc-spotlight-mid">{badge}<span className="wc-vs">vs</span></div>
          <div className="wc-team">
            <Flag iso={fixture.away.iso} name={fixture.away.name} size={160} />
            <span className="wc-team-name">{fixture.away.name}</span>
          </div>
        </div>

        {fixture.venue && <div className="wc-spotlight-venue">{fixture.venue}</div>}

        <div className="wc-odds-row">
          <span className="wc-odd wc-odd-home">
            <span className="wc-odd-lbl">{fixture.home.name}</span>
            <span className="wc-odd-pct">{homePct}%</span>
          </span>
          <span className="wc-odd wc-odd-draw">
            <span className="wc-odd-lbl">Draw</span>
            <span className="wc-odd-pct">{drawPct}%</span>
          </span>
          <span className="wc-odd wc-odd-away">
            <span className="wc-odd-lbl">{fixture.away.name}</span>
            <span className="wc-odd-pct">{awayPct}%</span>
          </span>
        </div>

        <div className="wc-spotlight-cta">View market →</div>
      </section>
    </Link>
  )
```

Leave the early-return empty state (`if (!fixture || !now)`) exactly as-is.

- [ ] **Step 2: Convert `MatchGrid` cards to links with display-only odds**

In `app/worldcup/hub.tsx`, change the `MatchGrid` signature to drop `onYes`:

```tsx
function MatchGrid({
  fixtures, now, prices,
}: {
  fixtures: Fixture[]
  now: Date | null
  prices: PricesMap
}) {
```

Update the panel note text and wrap each card in a link, converting the three `<button className="wc-codd …" onClick>` elements to `<span>`s. The mapped card becomes:

```tsx
      <div className="wc-panel-note">Tap a match to open its market</div>
      <div className="wc-grid-list">
        {fixtures.map((f) => {
          const state = now ? matchState(f.kickoffISO, now) : 'scheduled'
          const homePct = matchHomePct(prices, f.slug, f.home.name, f.fallback.home)
          const drawPct = f.fallback.draw
          const awayPct = Math.max(0, 100 - homePct - drawPct)
          return (
            <Link key={f.id} href={`/worldcup/${f.id}`} className="wc-mcard-link">
              <article className="wc-mcard" data-state={state}>
                <div className="wc-mcard-top">
                  <span className="wc-mcard-group">{groupLabel(f.group)}</span>
                  <span className="wc-mcard-when">
                    {state === 'live' ? <span className="wc-badge wc-badge-live"><i aria-hidden="true" /> LIVE</span>
                     : state === 'final' ? 'Full time'
                     : kickoffLabel(f.kickoffISO)}
                  </span>
                </div>
                <div className="wc-mcard-teams">
                  <span className="wc-mcard-team">
                    <img className="wc-mcard-flag" src={flagUrl(f.home.iso, 40)} alt={f.home.name} width={26} height={20} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                    <span className="wc-mcard-name">{f.home.name}</span>
                  </span>
                  <span className="wc-mcard-team">
                    <img className="wc-mcard-flag" src={flagUrl(f.away.iso, 40)} alt={f.away.name} width={26} height={20} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                    <span className="wc-mcard-name">{f.away.name}</span>
                  </span>
                </div>
                <div className="wc-mcard-odds">
                  <span className="wc-codd wc-codd-team">
                    <span className="wc-codd-lbl">{f.home.name}</span>
                    <span className="wc-codd-pct">{homePct}%</span>
                  </span>
                  <span className="wc-codd wc-codd-draw">
                    <span className="wc-codd-lbl">Draw</span>
                    <span className="wc-codd-pct">{drawPct}%</span>
                  </span>
                  <span className="wc-codd wc-codd-team">
                    <span className="wc-codd-lbl">{f.away.name}</span>
                    <span className="wc-codd-pct">{awayPct}%</span>
                  </span>
                </div>
              </article>
            </Link>
          )
        })}
      </div>
```

- [ ] **Step 3: Update the `WorldCupHub` render to stop passing `onYes` to those two**

In `app/worldcup/hub.tsx`, in the `WorldCupHub` return, change the spotlight and match-grid usages to drop the `onYes` prop (the winner leaderboard keeps it):

```tsx
      <Spotlight fixture={spotlight} now={now} prices={prices} />
```

```tsx
      {tab === 'matches'
        ? <MatchGrid fixtures={gridFixtures} now={now} prices={prices} />
        : <WinnerLeaderboard contenders={contenders} prices={prices} onYes={setWaitlistFor} />}
```

`waitlistFor` / `setWaitlistFor` and the `{waitlistFor && <WaitlistModal …>}` render stay — the leaderboard still uses them.

- [ ] **Step 4: Add link-wrapper style resets**

In `app/globals.css`, append after the Task 3 detail block:

```css
/* Card wrappers are links now (option B): a card opens its market page. */
.wc-mcard-link, .wc-spotlight-link { display: block; text-decoration: none; color: inherit; }
.wc-spotlight-cta {
  margin-top: 14px; text-align: center; font-family: var(--ff-mono);
  font-size: 12px; letter-spacing: 0.04em; color: var(--ink-3);
}
.wc-spotlight-link:hover .wc-spotlight-cta { color: var(--ink); }
```

- [ ] **Step 5: Verify types compile and the build succeeds**

Run: `npx tsc --noEmit`
Expected: no errors (in particular, no "onYes is missing" — both `Spotlight` and `MatchGrid` no longer declare it).

Run: `npm test`
Expected: PASS — existing suites unchanged.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Smoke-test in dev**

Run: `npm run dev`, open `http://localhost:3000/worldcup`.
Expected: clicking the spotlight card navigates to `/worldcup/<spotlight-id>`; clicking any match card navigates to its page; the "Who wins the Cup" tab's YES/NO buttons still open the waitlist modal.

- [ ] **Step 7: Commit**

```bash
git add app/worldcup/hub.tsx app/globals.css
git commit -m "feat(worldcup): hub match cards link to their market pages

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- `/worldcup/[fixtureId]` server+client split → Task 3. ✓
- `generateMetadata` per match → Task 3 Step 2. ✓
- `shared.tsx` extraction (Flag, WaitlistModal, label helpers) → Task 2. ✓
- Section 1 matchup header → Task 3 Step 1. ✓
- Section 2 odds panel → waitlist modal → Task 3 Step 1. ✓
- Section 3 live volume (option ii, deterministic fallback) → Task 1 (`fixtureVolLabel`) + Task 3 Step 1. ✓
- Section 4 resolution / close / source / disclaimer → Task 1 (`resolutionText`) + Task 3 Step 1. ✓
- Navigation option B (cards/spotlight → links, contenders unchanged) → Task 4. ✓
- DB-or-fallback + `notFound()` → Task 3 Step 2. ✓
- Unit tests for `getFixtureById`, `fixtureVolLabel` (incl. determinism), resolution text → Task 1. ✓
- No new data sources / no schema change → confirmed (Task 3 uses existing `fetchApprovedWcFixtures` + `/api/prices`). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `fixtureVolLabel` returns `VolLabel { label, live }` and is consumed as `vol.label` / `vol.live` in Task 3. `getFixtureById` returns `Fixture | null`, checked with `if (!fixture) notFound()`. `Spotlight`/`MatchGrid` drop `onYes` consistently in both their definitions (Task 4 Steps 1–2) and call sites (Step 3). `WinnerLeaderboard` keeps `onYes`. ✓
