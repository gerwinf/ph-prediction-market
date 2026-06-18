# World Cup section — editable from /ops/markets

**Date:** 2026-06-17
**Status:** Design approved — ready for implementation plan
**Branch:** gerwinf/lansing

## Problem

The `/worldcup` hub renders entirely from hardcoded `lib/worldcup/fixtures.ts`
(`FIXTURES` match grid + `CONTENDERS` winner leaderboard). Every change needs a
code edit + deploy, and fixtures go stale by date — this has already forced
repeated manual refresh deploys (PRs #18, #20, #22). The goal: let an operator
refresh and curate the WC section from `/ops/markets` with **no deploy**, the
same way the landing grid and `/hits` pools are already managed.

## Decisions (confirmed)

- **(A) Table strategy — reuse `markets`.** Add two new `kind`s rather than a new
  table. Inherits the `/ops/markets` console, RLS, and the
  candidate→approved/live→retired pipeline for free. WC payloads are richer than
  `binary`/`event_cell`, so `payload` jsonb does more work — acceptable.
- **(B) Editor depth — B1 (raw JSON).** No purpose-built form fields. WC rows
  appear in the existing console and are edited via its existing JSON `payload`
  textarea. Keeps the build small; operator edits raw JSON.
- **(C) Scope — ship fixtures + contenders together.** They share the migration,
  read endpoint, and seed script.

## Scope

Reuse the existing catalog pipeline (migration 009: `markets` table). No new
table, no new auth, no new infra. WC becomes two new `kind`s in the catalog.

### In scope

1. **Migration** — `supabase/migrations/012_markets_wc_kinds.sql` (highest in
   this branch is `011`; verify against `main` at implementation time to avoid a
   number collision). Drop and re-add the `markets.kind` check constraint to add
   `'wc_fixture'` and `'wc_contender'`. Additive — existing rows untouched.

   ```sql
   alter table public.markets drop constraint if exists markets_kind_check;
   alter table public.markets add constraint markets_kind_check
     check (kind in ('binary', 'event_cell', 'wc_fixture', 'wc_contender'));
   ```

2. **Payload shapes (jsonb)** — mirror today's hardcoded types. The catalog
   row's own `id` (uuid) becomes the rendered fixture id, so payloads carry no id
   of their own:
   - `wc_fixture`:
     `{ home: {name, iso}, away: {name, iso}, group, kickoff_iso, venue?, slug?, fallback: {home, draw, away} }`
   - `wc_contender`:
     `{ name, iso, slug?, fallback_pct, vol, delta }`

   Row `title` = human label ("England vs Croatia" / "Spain"). Ordering:
   fixtures render by `kickoff_iso` (adapter sorts); contenders by live-or-fallback
   pct (the page already sorts contenders at render time).

3. **Read path**
   - `lib/catalog/read.ts`: two new adapters
     `fetchApprovedWcFixtures(): Promise<Fixture[]>` and
     `fetchApprovedWcContenders(): Promise<Contender[]>`. Service-role admin read,
     `status in ('approved','live')`, **return `[]` on empty/error** (identical
     posture to `fetchApprovedBinaryMarkets`). They map snake_case payload → the
     camelCase `Fixture`/`Contender` shapes `page.tsx` expects:
     `kickoff_iso`→`kickoffISO`, `fallback_pct`→`fallbackPct`, row `id`→`fixture.id`.
   - New `GET /api/worldcup` route → `{ fixtures, contenders }`. **If both
     adapters come back empty/error, the route returns the hardcoded
     `FIXTURES`/`CONTENDERS`** so the response is always populated. (Per-kind: if
     fixtures are empty but contenders exist, fall back only the empty one.)
   - `app/worldcup/page.tsx`: stays a client component. Replace the static-import
     constants with state seeded from the hardcoded `FIXTURES`/`CONTENDERS`, then
     `fetch('/api/worldcup')` on mount (same pattern as its existing
     `/api/prices` fetch). On fetch failure, keep the static seed — belt and
     suspenders with the route-level fallback. Admin client never ships to the
     browser.

4. **Ops console — no changes.** With B1, WC rows already render generically
   (`<kind> · <category> · <source> · <status>`) in the existing
   Queue/Catalog/Retired tabs, and the edit form already supports JSON `payload`
   editing plus `title`/`interest_score`/`status`. Nothing to build here.

5. **Seed** — one-shot `scripts/seed-worldcup-catalog.ts`, modeled on
   `scripts/seed-catalog-from-hardcoded.ts`. Imports the current
   `FIXTURES`/`CONTENDERS` as `status='approved'`, `source='human'`,
   `reviewed_by='seed'`. Idempotent via a `(kind, lower(title))` existence check
   (the partial unique index only covers `status='candidate'`). Run once on
   deploy so the section is populated immediately.

### Out of scope (YAGNI)

- Match settlement / results / scores entry (no settlement today).
- Auto-ingesting the real schedule from a sports API — entry/edit is manual.
- Auth changes — reuse the existing `OPS_SHARED_SECRET` / `X-Ops-Secret` flow.
- Live-odds plumbing — `slug → LIVE_MARKETS` pinning stays as-is; the editor only
  *sets* the slug. Pinning new Polymarket ids remains a code change in
  `lib/oracle/slugs.ts`.
- Removing `lib/worldcup/fixtures.ts` — it stays as the fallback source.
- Ops-console kind filter / dedicated WC tab — cut for simplicity; WC rows live
  in the existing lifecycle tabs.

## Testing

- Existing worldcup unit tests (`fixtures.test.ts`, `odds.test.ts`,
  `state.test.ts`) stay green.
- New: adapter payload→type mapping and the fallback-on-empty/error path; the
  `/api/worldcup` route's per-kind fallback behavior.

## Success criteria

- An operator can add/edit/retire a WC match and a contender in `/ops/markets`
  (via JSON payload editing) and see it on `/worldcup` with **no deploy**.
- With an empty catalog or any read error, `/worldcup` renders exactly as today
  (hardcoded fallback) — fully non-breaking.
- Existing worldcup unit tests still pass; new read-adapter + endpoint logic is
  unit-tested with the fallback path covered.
