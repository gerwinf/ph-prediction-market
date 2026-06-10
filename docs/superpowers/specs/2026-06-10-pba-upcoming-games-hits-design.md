# PBA upcoming games on /hits — design

**Date:** 2026-06-10
**Branch:** gerwinf/pba-upcoming-games-hits

## Goal

Show upcoming PBA games on `/hits` and let users **pre-buy** a card for a game
that hasn't started yet. The card sits dormant and activates automatically when
ops flips the fixture to `live`. Data is sourced from an external PBA schedule
feed (no public PBA API exists) through a pipeline that mirrors the existing
Polymarket signal pipeline, so the plumbing is consistent and reusable.

## Decisions

- **Scope:** both the data pipeline and the UI.
- **Source:** external scrape/feed of the PBA schedule (Approach 1 — direct JSON
  endpoint preferred, mirror-HTML scrape as fallback), behind a pluggable
  "fixture source" seam.
- **Interaction:** pre-buy / reserve — a card bound to a `scheduled` fixture,
  activating at tip-off.
- **Curation:** auto-publish as `scheduled` + ops override (edit/cancel). No
  candidate-approval gate.
- **UI window:** today + next 2-3 games as a short list.

## Why this shape

A card is just a `cards` row pointing at a `match_id`. Bind it to a `scheduled`
fixture and, when ops flips that fixture to `live` and events fire, the card
lights up via the existing live path; when `final`, it settles via the existing
`/api/ops/fixture-status` settlement. So pre-buy needs almost no new payments
code — the work is the ingest pipeline, an upcoming-games list, and a
"waiting for tip-off" card state.

## Architecture

### 1. Fixture-source seam (`lib/fixtures/`, mirrors `lib/catalog/`)

- `lib/fixtures/feed-pba.ts` — **pure** mapper
  `mapPbaScheduleToFixtures(raw, nowMs): FixtureCandidate[]`. Deterministic,
  unit-tested like `mapPolymarketEventToCandidate`. Stable ids
  (`pba-<away>-<home>-<YYYY-MM-DD>`), **PHT → UTC** conversion, past/duplicate
  filtering, venue extraction.
- `lib/fixtures/fetch-pba.ts` — glue/fetcher hitting the discovered endpoint.
  Network only; the model-extraction fallback slots in here later.
- `lib/fixtures/types.ts` — `FixtureCandidate` + thin `FixtureSource` shape so a
  second source (NBA, World Cup) drops in cleanly.

### 2. Ingestion + where it runs

**Data-source reality (probed 2026-06-10, incl. a headless-browser render):**
no clean runtime feed exists, AND `pba.ph/schedule` renders only the *single
next game* even with full JS — there is no full-schedule view (its filters are
unfinished `Lorem Ipsum` placeholders). Inquirer is a JS shell; the stats bucket
is private (403); asia-basket is historical.

But that one game **is in the server-rendered HTML**, so a plain `fetch` gets it
— no browser needed. That collapses the original "Option 1 GitHub Action +
Playwright" plan into something simpler: parse the next game in the **existing
daily Vercel cron**. The feed yields one reliable game with accurate
time/venue/teams; ops adds the next few via the override console.

- `lib/fixtures/fetch-pba.ts` — `parsePbaScheduleHtml` (pure, tested against a
  captured sample) + `fetchPbaSchedule` (thin `fetch` glue). No Playwright.
- `lib/fixtures/maintain.ts` → `ingestPbaFixtures(admin, rawGames, nowMs)`: map →
  dedup → upsert. **Idempotent and status-safe**: inserts new games, updates
  only still-`scheduled` rows, never clobbers `live`/`final`/`canceled`. The
  insert/update/skip decision is the pure, tested `planFixtureIngest`.
- Wired as a `pba` step in `app/api/cron/maintain-catalog` (the existing daily
  cron) — no new cron, no Action, no secrets beyond what's already set.
- `scripts/ingest-pba.ts` — same fetch→ingest, runnable on demand by ops.

### 3. Schema migration (non-breaking)

Add nullable `source text` and `venue text` to `match_fixtures`. No new status.

### 4. `/api/fixtures`

Widen upcoming window 8h → ~3 days; return the list of upcoming `sports`
fixtures; add `venue` to the select.

### 5. `/hits` — upcoming list + pre-buy entry

Hero stays the headline (live else nearest upcoming). New compact "Mga susunod
na laro" list (today + next 2-3): `match_label · time · venue` + "Reserve ₱X
card" CTA. Selecting sets the active game; Buy runs existing `completePurchase`
with `matchId = <scheduled fixture id>`.

### 6. Card page — pre-live state

`app/hits/[card_id]/page.tsx` gains a `scheduled` state: dormant board + banner
"Magsisimula ang laro <time> · mag-iilaw ang cells sa tip-off." Reads fixture
status (not just URL param), auto-transitions to live via existing polling.

### 7. `/ops` override (lean)

`/ops/fixtures` list with cancel (reuse `/api/ops/fixture-status` → `canceled`)
and edit label/start-time (small new endpoint).

## Error handling & edge cases

- Scrape/endpoint failure → ingest logs and no-ops; existing fixtures persist;
  `/hits` falls back to demo-only. No crash.
- **Canceled game with pre-bought cards** → ops cancel refunds those cards'
  wagers (the one genuinely new bit of logic).
- Timezone (PHT→UTC), idempotency, and status-preservation handled in
  mapper/ingest.

## Testing

- Unit-test the pure mapper against a captured raw-schedule sample (PHT→UTC,
  past filter, stable ids, dedup, multi-day).
- Test ingest idempotency + status-preservation with a mock admin client.
- Manual QA: pre-buy → tip-off transition → settlement.

## Phasing

- **Phase A (data):** migration + seam + mapper + ingest + cron.
- **Phase B (UI):** upcoming list + pre-buy entry + card pre-live state.
- **Phase C:** ops override panel + cancel-refund.
