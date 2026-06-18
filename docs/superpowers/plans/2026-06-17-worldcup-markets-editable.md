# World Cup section editable from /ops/markets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator add/edit/retire World Cup fixtures and contenders from `/ops/markets` (via JSON payload editing) and have `/worldcup` reflect the changes with no deploy, while keeping the hardcoded data as a non-breaking fallback.

**Architecture:** Reuse the existing `markets` catalog (migration 009) by adding two new `kind`s — `wc_fixture` and `wc_contender`. New server-only read adapters fetch approved/live WC rows and map their jsonb payloads back into the page's existing `Fixture`/`Contender` shapes. A new public `GET /api/worldcup` returns `{ fixtures, contenders }`, falling back per-kind to the hardcoded `FIXTURES`/`CONTENDERS` on empty/error. `app/worldcup/page.tsx` (already a client component) fetches that endpoint on mount, seeded from the hardcoded data. A one-shot seed script imports today's hardcoded data as approved rows.

**Tech Stack:** Next.js App Router (client + route handlers), Supabase (Postgres + service-role admin client), TypeScript, Vitest, `tsx` for scripts.

## Global Constraints

- **Non-breaking fallback is mandatory.** Every read adapter returns `[]` on ANY error or empty result; the route and page must render exactly as today when the catalog is empty or unreachable. Copy verbatim the posture in `lib/catalog/read.ts` (`try { ... if (error || !data) return [] } catch { return [] }`).
- **Never import the admin client into a client component.** `lib/catalog/read.ts` and the route handler are server-only; `lib/supabase/admin.ts` must not reach the browser bundle.
- **Migration is additive only.** Do not alter or drop existing rows; only widen the `markets_kind_check` constraint.
- **Payload keys are snake_case in the DB** (`kickoff_iso`, `fallback_pct`), mapped to the page's camelCase types (`kickoffISO`, `fallbackPct`) in the read adapters.
- **Tests run with:** `npm test` (alias for `vitest run`). Run a single file with `npx vitest run <path>`.
- **Do not modify `lib/oracle/slugs.ts`.** Pinning new Polymarket ids stays a separate code change; the editor only *sets* the `slug` string in a payload.
- **Do not change `/ops/markets` UI.** WC rows render via the existing generic row + JSON payload editor.

---

## File structure

- `supabase/migrations/012_markets_wc_kinds.sql` — **create**: widen `kind` check constraint.
- `lib/catalog/types.ts` — **modify**: add `WcFixturePayload`, `WcContenderPayload`; widen `MarketKind`.
- `lib/catalog/read.ts` — **modify**: add pure mappers + two fetch adapters.
- `lib/catalog/read.wc.test.ts` — **create**: unit tests for the pure mappers + fixture sort.
- `app/api/worldcup/route.ts` — **create**: public GET returning `{ fixtures, contenders }` with per-kind fallback.
- `app/api/worldcup/route.test.ts` — **create**: route fallback + passthrough tests.
- `app/worldcup/page.tsx` — **modify**: fetch `/api/worldcup` on mount; thread `fixtures`/`contenders` through state.
- `scripts/seed-worldcup-catalog.ts` — **create**: one-shot seed from hardcoded data.

---

## Task 1: Migration — add the two WC kinds

**Files:**
- Create: `supabase/migrations/012_markets_wc_kinds.sql`

**Interfaces:**
- Produces: the DB now accepts `kind` values `'wc_fixture'` and `'wc_contender'` in `public.markets`.

> No automated test — this is a SQL migration. Verified by Task 6 (the seed inserts WC rows; a failing constraint would error the insert).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/012_markets_wc_kinds.sql`:

```sql
-- ============================================================================
-- Migration 012: World Cup catalog kinds
-- ============================================================================
-- The /worldcup hub becomes editable from /ops/markets by reusing the markets
-- catalog (migration 009). Two new kinds back the section:
--
--   wc_fixture   — a single match card (teams, group, kickoff, venue, fallback
--                  odds, optional Polymarket slug). payload shape:
--                  { home:{name,iso}, away:{name,iso}, group, kickoff_iso,
--                    venue?, slug?, fallback:{home,draw,away} }
--   wc_contender — a "who wins the Cup" leaderboard row. payload shape:
--                  { name, iso, slug?, fallback_pct, vol, delta }
--
-- Additive only: existing 'binary' / 'event_cell' rows are untouched. We drop
-- and re-add the check constraint because Postgres has no "add value" for a
-- CHECK-IN list the way it does for enums.
-- ============================================================================

alter table public.markets drop constraint if exists markets_kind_check;

alter table public.markets add constraint markets_kind_check
  check (kind in ('binary', 'event_cell', 'wc_fixture', 'wc_contender'));
```

- [ ] **Step 2: Sanity-check the constraint name matches migration 009**

Run: `grep -n "kind in" supabase/migrations/009_markets_catalog.sql`
Expected: shows `check (kind in ('binary', 'event_cell'))`. The inline check in 009 is unnamed, so Postgres auto-named it `markets_kind_check`. Confirm by running (against a DB you can reach):

Run: `psql "$DATABASE_URL" -c "\d public.markets" | grep kind` (optional — only if a DB is reachable)
Expected: a constraint line referencing `markets_kind_check`. If the auto-name differs in your environment, adjust the `drop constraint if exists` line to match before applying. The `if exists` guard means a wrong name simply no-ops the drop; the `add constraint` would then fail on a duplicate — so this check matters.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_markets_wc_kinds.sql
git commit -m "feat(worldcup): add wc_fixture + wc_contender catalog kinds (migration 012)"
```

---

## Task 2: Payload types

**Files:**
- Modify: `lib/catalog/types.ts`

**Interfaces:**
- Produces:
  - `WcFixturePayload = { home: {name: string; iso: string}; away: {name: string; iso: string}; group: string; kickoff_iso: string; venue?: string; slug?: string; fallback: {home: number; draw: number; away: number} }`
  - `WcContenderPayload = { name: string; iso: string; slug?: string; fallback_pct: number; vol: string; delta: number }`
  - `MarketKind` widened to `'binary' | 'event_cell' | 'wc_fixture' | 'wc_contender'`

> No standalone test — these are type declarations, exercised by Tasks 3–6 and the typecheck in `npm run build`.

- [ ] **Step 1: Widen the `MarketKind` union**

In `lib/catalog/types.ts`, change line 14 from:

```ts
export type MarketKind = 'binary' | 'event_cell'
```

to:

```ts
export type MarketKind = 'binary' | 'event_cell' | 'wc_fixture' | 'wc_contender'
```

- [ ] **Step 2: Add the two WC payload types**

In `lib/catalog/types.ts`, after the `EventCellPayload` block (after line 46), add:

```ts
/**
 * World Cup match-card payload (kind='wc_fixture'). Snake_case mirrors the DB;
 * the read adapter maps it to the page's camelCase `Fixture` (lib/worldcup/state).
 * - `kickoff_iso`: ISO 8601 UTC kickoff time. Fixtures render ordered by this.
 * - `slug`: optional LIVE_MARKETS key (lib/oracle/slugs) for a live odds overlay.
 * - `fallback`: curated home/draw/away percentages shown until a live feed resolves.
 */
export type WcFixturePayload = {
  home: { name: string; iso: string }
  away: { name: string; iso: string }
  group: string
  kickoff_iso: string
  venue?: string
  slug?: string
  fallback: { home: number; draw: number; away: number }
}

/**
 * World Cup winner-leaderboard payload (kind='wc_contender'). Snake_case mirrors
 * the DB; the read adapter maps it to the page's camelCase `Contender`.
 * - `fallback_pct`: curated championship probability shown until a live feed resolves.
 * - `vol` / `delta`: curated flavor (market depth label + 24h move in pct points).
 */
export type WcContenderPayload = {
  name: string
  iso: string
  slug?: string
  fallback_pct: number
  vol: string
  delta: number
}
```

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors. (Widening `MarketKind` does not break `CatalogBinaryMarket`/`CatalogEventCell`, which pin their own `kind`.)

- [ ] **Step 4: Commit**

```bash
git add lib/catalog/types.ts
git commit -m "feat(worldcup): add WC fixture + contender payload types"
```

---

## Task 3: Read adapters + pure mappers

**Files:**
- Modify: `lib/catalog/read.ts`
- Test: `lib/catalog/read.wc.test.ts`

**Interfaces:**
- Consumes: `Row` (already defined in `read.ts`), `WcFixturePayload`/`WcContenderPayload` (Task 2), `Fixture` (from `../worldcup/state`), `Contender` (from `../worldcup/fixtures`).
- Produces:
  - `mapWcFixtureRow(row: Row): Fixture`
  - `mapWcFixtureRows(rows: Row[]): Fixture[]` — maps then sorts ascending by `kickoffISO`.
  - `mapWcContenderRow(row: Row): Contender`
  - `fetchApprovedWcFixtures(): Promise<Fixture[]>` — `[]` on empty/error.
  - `fetchApprovedWcContenders(): Promise<Contender[]>` — `[]` on empty/error.

- [ ] **Step 1: Write the failing test**

Create `lib/catalog/read.wc.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { mapWcFixtureRow, mapWcFixtureRows, mapWcContenderRow } from './read'

/** A raw markets row as returned by the SELECT in read.ts. */
function fixtureRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-uuid-1',
    kind: 'wc_fixture',
    category: null,
    title: 'Spain vs Portugal',
    fixture_id: null,
    status: 'approved',
    interest_score: 0,
    source: 'human',
    payload: {
      home: { name: 'Spain', iso: 'es' },
      away: { name: 'Portugal', iso: 'pt' },
      group: 'E',
      kickoff_iso: '2026-06-18T19:00:00.000Z',
      venue: 'MetLife Stadium',
      slug: 'wc-esp-por',
      fallback: { home: 47, draw: 27, away: 26 },
    },
    ...overrides,
  }
}

function contenderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-uuid-2',
    kind: 'wc_contender',
    category: null,
    title: 'Spain',
    fixture_id: null,
    status: 'approved',
    interest_score: 17,
    source: 'human',
    payload: {
      name: 'Spain',
      iso: 'es',
      slug: 'wc-spain',
      fallback_pct: 17,
      vol: '₱5.2M',
      delta: 1,
    },
    ...overrides,
  }
}

describe('mapWcFixtureRow', () => {
  test('maps snake_case payload + row id into the camelCase Fixture shape', () => {
    const f = mapWcFixtureRow(fixtureRow() as never)
    expect(f).toEqual({
      id: 'row-uuid-1',
      home: { name: 'Spain', iso: 'es' },
      away: { name: 'Portugal', iso: 'pt' },
      group: 'E',
      kickoffISO: '2026-06-18T19:00:00.000Z',
      venue: 'MetLife Stadium',
      slug: 'wc-esp-por',
      fallback: { home: 47, draw: 27, away: 26 },
    })
  })

  test('omits optional venue/slug when absent in payload', () => {
    const row = fixtureRow({
      payload: {
        home: { name: 'Germany', iso: 'de' },
        away: { name: 'Japan', iso: 'jp' },
        group: 'D',
        kickoff_iso: '2026-06-19T19:00:00.000Z',
        fallback: { home: 60, draw: 23, away: 17 },
      },
    })
    const f = mapWcFixtureRow(row as never)
    expect(f.venue).toBeUndefined()
    expect(f.slug).toBeUndefined()
    expect(f.id).toBe('row-uuid-1')
  })
})

describe('mapWcFixtureRows', () => {
  test('sorts ascending by kickoffISO regardless of input order', () => {
    const later = fixtureRow({ id: 'b', payload: { ...fixtureRow().payload, kickoff_iso: '2026-06-20T22:00:00.000Z' } })
    const earlier = fixtureRow({ id: 'a', payload: { ...fixtureRow().payload, kickoff_iso: '2026-06-17T19:00:00.000Z' } })
    const out = mapWcFixtureRows([later, earlier] as never)
    expect(out.map((f) => f.id)).toEqual(['a', 'b'])
  })
})

describe('mapWcContenderRow', () => {
  test('maps snake_case payload into the camelCase Contender shape', () => {
    const c = mapWcContenderRow(contenderRow() as never)
    expect(c).toEqual({
      name: 'Spain',
      iso: 'es',
      slug: 'wc-spain',
      fallbackPct: 17,
      vol: '₱5.2M',
      delta: 1,
    })
  })

  test('omits optional slug when absent', () => {
    const row = contenderRow({
      payload: { name: 'Germany', iso: 'de', fallback_pct: 6, vol: '₱2.1M', delta: -2 },
    })
    const c = mapWcContenderRow(row as never)
    expect(c.slug).toBeUndefined()
    expect(c.fallbackPct).toBe(6)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/catalog/read.wc.test.ts`
Expected: FAIL — `mapWcFixtureRow`/`mapWcFixtureRows`/`mapWcContenderRow` are not exported from `./read`.

- [ ] **Step 3: Implement the mappers and adapters**

In `lib/catalog/read.ts`, extend the type imports (lines 10–15) to add the new payload types:

```ts
import type {
  CatalogBinaryMarket,
  CatalogEventCell,
  BinaryPayload,
  EventCellPayload,
  WcFixturePayload,
  WcContenderPayload,
} from './types'
```

Add these type-only imports just below the existing import block (after line 15):

```ts
import type { Fixture } from '../worldcup/state'
import type { Contender } from '../worldcup/fixtures'
```

Then append to the end of `lib/catalog/read.ts`:

```ts
/* ── World Cup adapters ──────────────────────────────────────────────────
 * The /worldcup hub reads two WC kinds. Mappers convert the snake_case jsonb
 * payload + the row's own id into the page's camelCase Fixture/Contender shapes.
 * Both fetchers return [] on any failure → the page keeps its hardcoded data.
 * ──────────────────────────────────────────────────────────────────────── */

/** One wc_fixture row → a render-ready Fixture (row id becomes the fixture id). */
export function mapWcFixtureRow(row: Row): Fixture {
  const p = (row.payload ?? {}) as WcFixturePayload
  const f: Fixture = {
    id: row.id,
    home: p.home,
    away: p.away,
    group: p.group,
    kickoffISO: p.kickoff_iso,
    fallback: p.fallback,
  }
  if (p.venue !== undefined) f.venue = p.venue
  if (p.slug !== undefined) f.slug = p.slug
  return f
}

/** Map + sort fixtures ascending by kickoff — the order the grid renders in. */
export function mapWcFixtureRows(rows: Row[]): Fixture[] {
  return rows.map(mapWcFixtureRow).sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO))
}

/** One wc_contender row → a render-ready Contender. */
export function mapWcContenderRow(row: Row): Contender {
  const p = (row.payload ?? {}) as WcContenderPayload
  const c: Contender = {
    name: p.name,
    iso: p.iso,
    fallbackPct: p.fallback_pct,
    vol: p.vol,
    delta: p.delta,
  }
  if (p.slug !== undefined) c.slug = p.slug
  return c
}

/** Approved/live WC fixtures, sorted by kickoff. [] on any failure. */
export async function fetchApprovedWcFixtures(): Promise<Fixture[]> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('markets')
      .select(SELECT)
      .eq('kind', 'wc_fixture')
      .in('status', LIVE_STATUSES)
    if (error || !data) return []
    return mapWcFixtureRows(data as Row[])
  } catch {
    return []
  }
}

/** Approved/live WC contenders. [] on any failure. The page re-sorts by pct. */
export async function fetchApprovedWcContenders(): Promise<Contender[]> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('markets')
      .select(SELECT)
      .eq('kind', 'wc_contender')
      .in('status', LIVE_STATUSES)
      .order('interest_score', { ascending: false })
    if (error || !data) return []
    return (data as Row[]).map(mapWcContenderRow)
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/catalog/read.wc.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/read.ts lib/catalog/read.wc.test.ts
git commit -m "feat(worldcup): catalog read adapters for WC fixtures + contenders"
```

---

## Task 4: `GET /api/worldcup` route

**Files:**
- Create: `app/api/worldcup/route.ts`
- Test: `app/api/worldcup/route.test.ts`

**Interfaces:**
- Consumes: `fetchApprovedWcFixtures`, `fetchApprovedWcContenders` (Task 3); `FIXTURES`, `CONTENDERS` (from `lib/worldcup/fixtures`).
- Produces: `GET()` → `NextResponse` of `{ fixtures: Fixture[]; contenders: Contender[] }`. Per-kind fallback: a kind whose adapter returns `[]` falls back to its hardcoded array.

- [ ] **Step 1: Write the failing test**

Create `app/api/worldcup/route.test.ts`:

```ts
import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the read adapters so the route is tested without a DB.
vi.mock('../../../lib/catalog/read', () => ({
  fetchApprovedWcFixtures: vi.fn(),
  fetchApprovedWcContenders: vi.fn(),
}))

import { GET } from './route'
import { FIXTURES, CONTENDERS } from '../../../lib/worldcup/fixtures'
import { fetchApprovedWcFixtures, fetchApprovedWcContenders } from '../../../lib/catalog/read'

const mockFixtures = vi.mocked(fetchApprovedWcFixtures)
const mockContenders = vi.mocked(fetchApprovedWcContenders)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/worldcup', () => {
  test('falls back to hardcoded data when both adapters are empty', async () => {
    mockFixtures.mockResolvedValue([])
    mockContenders.mockResolvedValue([])
    const res = await GET()
    const body = await res.json()
    expect(body.fixtures).toEqual(FIXTURES)
    expect(body.contenders).toEqual(CONTENDERS)
  })

  test('returns DB data when present', async () => {
    const dbFixture = { id: 'x', home: { name: 'A', iso: 'aa' }, away: { name: 'B', iso: 'bb' }, group: 'A', kickoffISO: '2026-06-30T19:00:00.000Z', fallback: { home: 50, draw: 25, away: 25 } }
    const dbContender = { name: 'A', iso: 'aa', fallbackPct: 20, vol: '₱1M', delta: 0 }
    mockFixtures.mockResolvedValue([dbFixture] as never)
    mockContenders.mockResolvedValue([dbContender] as never)
    const res = await GET()
    const body = await res.json()
    expect(body.fixtures).toEqual([dbFixture])
    expect(body.contenders).toEqual([dbContender])
  })

  test('falls back per-kind independently', async () => {
    const dbContender = { name: 'A', iso: 'aa', fallbackPct: 20, vol: '₱1M', delta: 0 }
    mockFixtures.mockResolvedValue([]) // empty → fall back
    mockContenders.mockResolvedValue([dbContender] as never) // present → keep
    const res = await GET()
    const body = await res.json()
    expect(body.fixtures).toEqual(FIXTURES)
    expect(body.contenders).toEqual([dbContender])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/worldcup/route.test.ts`
Expected: FAIL — `./route` does not exist / `GET` is not exported.

- [ ] **Step 3: Implement the route**

Create `app/api/worldcup/route.ts`:

```ts
/**
 * GET /api/worldcup
 *
 * Public. Returns the World Cup section's data:
 *   { fixtures: Fixture[], contenders: Contender[] }
 *
 * Fixtures come from approved/live wc_fixture rows (sorted by kickoff);
 * contenders from approved/live wc_contender rows. When a kind's catalog read
 * is empty or errors, that kind falls back to the hardcoded data in
 * lib/worldcup/fixtures — so /worldcup always renders, exactly as it does today
 * when the catalog is untouched. The admin client stays server-side.
 */
import { NextResponse } from 'next/server'
import { fetchApprovedWcFixtures, fetchApprovedWcContenders } from '../../../lib/catalog/read'
import { FIXTURES, CONTENDERS } from '../../../lib/worldcup/fixtures'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  const [dbFixtures, dbContenders] = await Promise.all([
    fetchApprovedWcFixtures(),
    fetchApprovedWcContenders(),
  ])

  return NextResponse.json({
    fixtures: dbFixtures.length ? dbFixtures : FIXTURES,
    contenders: dbContenders.length ? dbContenders : CONTENDERS,
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/api/worldcup/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/worldcup/route.ts app/api/worldcup/route.test.ts
git commit -m "feat(worldcup): GET /api/worldcup with per-kind hardcoded fallback"
```

---

## Task 5: Wire `/worldcup` page to the endpoint

**Files:**
- Modify: `app/worldcup/page.tsx`

**Interfaces:**
- Consumes: `GET /api/worldcup` (Task 4); existing `Fixture` type from `../../lib/worldcup/state`; `Contender` type from `../../lib/worldcup/fixtures`.
- Produces: page renders from component state seeded with the hardcoded data, replaced by the endpoint response on mount.

> No unit test — this is a client component and the project has no component-test harness. Verified by `npm run build` (typecheck) + the manual smoke check in Step 6.

- [ ] **Step 1: Import the `Contender` type alongside the hardcoded data**

In `app/worldcup/page.tsx`, change line 5 from:

```ts
import { CONTENDERS, FIXTURES } from '../../lib/worldcup/fixtures'
```

to:

```ts
import { CONTENDERS, FIXTURES, type Contender } from '../../lib/worldcup/fixtures'
```

- [ ] **Step 2: Add state seeded from the hardcoded data and fetch the endpoint on mount**

In `WorldCupHub` (after line 25, the `tab` state), add two state hooks:

```ts
  const [fixtures, setFixtures] = useState<Fixture[]>(FIXTURES)
  const [contenders, setContenders] = useState<Contender[]>(CONTENDERS)
```

Then add a new effect immediately after the `now`-ticker effect (after line 33):

```ts
  // Load operator-curated WC data. Any failure keeps the hardcoded seed; the
  // endpoint itself also falls back per-kind, so this is belt-and-suspenders.
  useEffect(() => {
    let cancelled = false
    fetch('/api/worldcup')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (Array.isArray(data.fixtures)) setFixtures(data.fixtures)
        if (Array.isArray(data.contenders)) setContenders(data.contenders)
      })
      .catch(() => { /* keep hardcoded seed */ })
    return () => { cancelled = true }
  }, [])
```

- [ ] **Step 3: Replace the module-constant references with state**

Within `WorldCupHub`, update these references (the constants are now only used to seed state):

- The prices effect — change line 37 `const slugs = allWcSlugs(CONTENDERS, FIXTURES)` to `const slugs = allWcSlugs(contenders, fixtures)`, and add `[fixtures, contenders]` as the effect's dependency array (replace the existing `[]` on what is line 45) so prices refetch when curated data loads.
- The spotlight memo — change line 48 `selectSpotlight(FIXTURES, now)` to `selectSpotlight(fixtures, now)`, and add `fixtures` to its dependency array (line 49–50 → `[now, fixtures]`).
- The grid memo — change line 51–54 to filter `fixtures` and depend on `[fixtures, spotlight]`:

```ts
  const gridFixtures = useMemo(
    () => fixtures.filter((f) => f.id !== spotlight?.id),
    [fixtures, spotlight]
  )
```

- The winner tab count — change line 78 `{CONTENDERS.length}` to `{contenders.length}`.

- [ ] **Step 4: Pass `contenders` into `WinnerLeaderboard`**

Change the render (line 84) from:

```tsx
        : <WinnerLeaderboard prices={prices} onYes={setWaitlistFor} />}
```

to:

```tsx
        : <WinnerLeaderboard contenders={contenders} prices={prices} onYes={setWaitlistFor} />}
```

Then update the `WinnerLeaderboard` signature + body (lines 188–192) from:

```tsx
function WinnerLeaderboard({ prices, onYes }: { prices: PricesMap; onYes: (c: string) => void }) {
  // Overlay live odds, then sort high→low by the (live-or-fallback) pct.
  const rows = CONTENDERS
    .map((c) => ({ ...c, pct: winnerPct(prices, c.slug, c.fallbackPct) }))
    .sort((a, b) => b.pct - a.pct)
```

to:

```tsx
function WinnerLeaderboard({ contenders, prices, onYes }: { contenders: Contender[]; prices: PricesMap; onYes: (c: string) => void }) {
  // Overlay live odds, then sort high→low by the (live-or-fallback) pct.
  const rows = contenders
    .map((c) => ({ ...c, pct: winnerPct(prices, c.slug, c.fallbackPct) }))
    .sort((a, b) => b.pct - a.pct)
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Confirm no remaining bare `CONTENDERS`/`FIXTURES` references inside component bodies (they should appear ONLY in the import and the two `useState` seeds):

Run: `grep -n "CONTENDERS\|FIXTURES" app/worldcup/page.tsx`
Expected: exactly three lines — the import (line 5) and the two `useState(...)` seeds.

- [ ] **Step 6: Manual smoke check**

Run: `npm run dev` then open `http://localhost:3000/worldcup`.
Expected: the page renders identically to before (hardcoded data is the fallback and the catalog is still empty at this point). The Network tab shows a `GET /api/worldcup` returning `{ fixtures, contenders }`. Matches and "Who wins the Cup" tabs both populate.

- [ ] **Step 7: Commit**

```bash
git add app/worldcup/page.tsx
git commit -m "feat(worldcup): fetch /api/worldcup on mount, fall back to hardcoded"
```

---

## Task 6: Seed script

**Files:**
- Create: `scripts/seed-worldcup-catalog.ts`

**Interfaces:**
- Consumes: `FIXTURES`, `CONTENDERS` (from `../lib/worldcup/fixtures`); `WcFixturePayload`, `WcContenderPayload` (Task 2).
- Produces: inserts `wc_fixture` + `wc_contender` rows into `markets` as `status='approved'`, `source='human'`, `reviewed_by='seed'`. Idempotent.

> No unit test — it's a one-shot ops script that talks to the live DB (same posture as the existing `scripts/seed-catalog-from-hardcoded.ts`, which has no test). Verified by running it against the DB.

- [ ] **Step 1: Write the script**

Create `scripts/seed-worldcup-catalog.ts`:

```ts
/**
 * Seed the `markets` catalog (migrations 009 + 012) with the World Cup section
 * from today's hardcoded data:
 *   - wc_fixture   rows ← lib/worldcup FIXTURES
 *   - wc_contender rows ← lib/worldcup CONTENDERS
 *
 * All rows land as status='approved', source='human', reviewed_by='seed'.
 * Idempotent: a row whose (kind, lower(title)) already exists for source='human'
 * is skipped, so re-runs never duplicate.
 *
 * Run: npx tsx scripts/seed-worldcup-catalog.ts
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { FIXTURES, CONTENDERS } from '../lib/worldcup/fixtures'
import type { WcFixturePayload, WcContenderPayload } from '../lib/catalog/types'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

type WcMarketInsert = {
  kind: 'wc_fixture' | 'wc_contender'
  category: string | null
  title: string
  fixture_id: null
  status: 'approved'
  interest_score: number
  source: 'human'
  reviewed_by: 'seed'
  payload: WcFixturePayload | WcContenderPayload
}

/** One wc_fixture insert per hardcoded FIXTURE. */
function buildFixtureInserts(): WcMarketInsert[] {
  return FIXTURES.map((f) => {
    const payload: WcFixturePayload = {
      home: { name: f.home.name, iso: f.home.iso },
      away: { name: f.away.name, iso: f.away.iso },
      group: f.group,
      kickoff_iso: f.kickoffISO,
      fallback: f.fallback,
      ...(f.venue ? { venue: f.venue } : {}),
      ...(f.slug ? { slug: f.slug } : {}),
    }
    return {
      kind: 'wc_fixture',
      category: 'worldcup',
      title: `${f.home.name} vs ${f.away.name}`,
      fixture_id: null,
      status: 'approved',
      interest_score: 0, // fixtures render by kickoff, not interest
      source: 'human',
      reviewed_by: 'seed',
      payload,
    }
  })
}

/** One wc_contender insert per hardcoded CONTENDER (interest = fallback pct). */
function buildContenderInserts(): WcMarketInsert[] {
  return CONTENDERS.map((c) => {
    const payload: WcContenderPayload = {
      name: c.name,
      iso: c.iso,
      fallback_pct: c.fallbackPct,
      vol: c.vol,
      delta: c.delta,
      ...(c.slug ? { slug: c.slug } : {}),
    }
    return {
      kind: 'wc_contender',
      category: 'worldcup',
      title: c.name,
      fixture_id: null,
      status: 'approved',
      interest_score: c.fallbackPct,
      source: 'human',
      reviewed_by: 'seed',
      payload,
    }
  })
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const all = [...buildFixtureInserts(), ...buildContenderInserts()]

  // Skip rows already seeded (kind + lower(title)) so re-runs are idempotent.
  const { data: existing, error: readErr } = await admin
    .from('markets')
    .select('kind, title')
    .eq('source', 'human')
    .in('kind', ['wc_fixture', 'wc_contender'])
  if (readErr) {
    console.error('❌ could not read existing markets:', readErr.message)
    process.exit(1)
  }
  const seen = new Set((existing ?? []).map((r) => `${r.kind}::${String(r.title).toLowerCase()}`))
  const toInsert = all.filter((r) => !seen.has(`${r.kind}::${r.title.toLowerCase()}`))

  const skipped = all.length - toInsert.length
  if (toInsert.length === 0) {
    console.log(`Nothing to insert — all ${all.length} WC rows already present (skipped ${skipped}).`)
    return
  }

  const { error: insErr } = await admin.from('markets').insert(toInsert)
  if (insErr) {
    console.error('❌ insert failed:', insErr.message)
    process.exit(1)
  }

  const fixtures = toInsert.filter((r) => r.kind === 'wc_fixture').length
  const contenders = toInsert.filter((r) => r.kind === 'wc_contender').length
  console.log(`✅ inserted ${toInsert.length} WC rows (${fixtures} fixtures + ${contenders} contenders). Skipped ${skipped}.`)
}

main()
```

- [ ] **Step 2: Typecheck the script**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Apply migration 012, then run the seed (in a workspace with `.env.local`)**

> Note: only the prod-creds workspace (athens) has `.env.local`. Apply migration 012 to that environment's Supabase first (via the project's normal migration apply flow), then:

Run: `npx tsx scripts/seed-worldcup-catalog.ts`
Expected: `✅ inserted 12 WC rows (4 fixtures + 8 contenders). Skipped 0.`

Run it a second time:
Run: `npx tsx scripts/seed-worldcup-catalog.ts`
Expected: `Nothing to insert — all 12 WC rows already present (skipped 12).`

- [ ] **Step 4: Verify end-to-end**

Open `/worldcup` against that environment.
Expected: renders from the seeded catalog rows (visually identical to the hardcoded version). Then open `/ops/markets`, find a `wc_fixture` row in the Catalog tab, edit its `payload` JSON (e.g. change a `kickoff_iso`), save, and reload `/worldcup` — the change appears with no deploy.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-worldcup-catalog.ts
git commit -m "feat(worldcup): one-shot seed of WC catalog from hardcoded data"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the existing `lib/worldcup/*.test.ts` and the new `lib/catalog/read.wc.test.ts` + `app/api/worldcup/route.test.ts`.

- [ ] **Production build**

Run: `npm run build`
Expected: builds with no type errors. `/api/worldcup` appears in the route list.

---

## Self-review notes (for the implementer)

- **Spec coverage:** migration (Task 1) ✓ · payload shapes (Task 2) ✓ · read path + `/api/worldcup` with fallback (Tasks 3–4) ✓ · page fetch (Task 5) ✓ · seed (Task 6) ✓ · ops console unchanged (by design, B1) ✓.
- **Type consistency:** `mapWcFixtureRow`/`mapWcFixtureRows`/`mapWcContenderRow` names are identical across Task 3 definition, its test, and the route's consumed adapters. `Fixture` comes from `lib/worldcup/state`; `Contender` from `lib/worldcup/fixtures`.
- **Fallback posture:** adapters return `[]` on error (Task 3); route falls back per-kind (Task 4); page keeps its seed on fetch failure (Task 5) — three layers, all non-breaking.
- **Out of scope (unchanged):** settlement, sports-API ingest, auth changes, `lib/oracle/slugs.ts` edits, ops-console UI, removing `lib/worldcup/fixtures.ts`.
