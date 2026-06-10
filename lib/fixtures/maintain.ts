/**
 * Fixture ingestion — the work behind the daily PBA schedule sync.
 *
 * `ingestPbaFixtures` maps scraped rows to candidates, reads what already
 * exists, and upserts: insert new games, refresh still-`scheduled` ones, and
 * NEVER touch a row ops has flipped to live/final/canceled. The insert-vs-
 * update-vs-skip decision is factored into the pure `planFixtureIngest` so the
 * status-preservation rule is unit-testable without a DB.
 *
 * Takes the service-role admin client (bypasses RLS); the pure mapping lives in
 * feed-pba.ts.
 */
import { createAdminClient } from '../supabase/admin'
import { mapPbaScheduleToFixtures } from './feed-pba'
import type { FixtureCandidate, RawScheduleGame } from './types'

type Admin = ReturnType<typeof createAdminClient>

export type IngestFixturesResult = {
  inserted: number
  updated: number
  skipped: number
}

/** A minimal view of an existing fixture row for the planning step. */
type ExistingFixture = { id: string; status: string }

export type FixtureIngestPlan = {
  toInsert: FixtureCandidate[]
  toUpdate: FixtureCandidate[]
  skipped: FixtureCandidate[]
}

/**
 * Decide what to do with each candidate given the rows already in the table.
 * Pure — no DB. Rule: brand-new id → insert; existing & still `scheduled` →
 * update (the feed may have moved the tip-off or fixed a label); existing in
 * any ops-owned status (live/final/canceled) → skip, so ingest never clobbers
 * a game ops has taken over.
 */
export function planFixtureIngest(
  candidates: FixtureCandidate[],
  existing: ExistingFixture[]
): FixtureIngestPlan {
  const statusById = new Map(existing.map((e) => [e.id, e.status]))
  const plan: FixtureIngestPlan = { toInsert: [], toUpdate: [], skipped: [] }

  for (const c of candidates) {
    const status = statusById.get(c.id)
    if (status === undefined) plan.toInsert.push(c)
    else if (status === 'scheduled') plan.toUpdate.push(c)
    else plan.skipped.push(c)
  }
  return plan
}

/**
 * Map → read existing → plan → write. Returns counts. Safe to run repeatedly;
 * a fetch that yields zero games is a no-op (existing fixtures are untouched).
 */
export async function ingestPbaFixtures(
  admin: Admin,
  rawGames: RawScheduleGame[],
  nowMs: number
): Promise<IngestFixturesResult> {
  const candidates = mapPbaScheduleToFixtures(rawGames, nowMs)
  if (candidates.length === 0) return { inserted: 0, updated: 0, skipped: 0 }

  const ids = candidates.map((c) => c.id)
  const { data: existing, error: readErr } = await admin
    .from('match_fixtures')
    .select('id, status')
    .in('id', ids)
  if (readErr) throw new Error(`db_read_failed: ${readErr.message}`)

  const plan = planFixtureIngest(candidates, (existing ?? []) as ExistingFixture[])

  if (plan.toInsert.length > 0) {
    const { error: insErr } = await admin.from('match_fixtures').insert(
      plan.toInsert.map((c) => ({
        id: c.id,
        card_type: c.card_type,
        match_label: c.match_label,
        starts_at: c.starts_at,
        status: c.status,
        source: c.source,
        venue: c.venue,
      }))
    )
    if (insErr) throw new Error(`db_insert_failed: ${insErr.message}`)
  }

  // Refresh still-scheduled rows individually — only the feed-owned fields, so
  // a label/time correction propagates without disturbing ops state.
  for (const c of plan.toUpdate) {
    const { error: upErr } = await admin
      .from('match_fixtures')
      .update({ match_label: c.match_label, starts_at: c.starts_at, venue: c.venue, source: c.source })
      .eq('id', c.id)
      .eq('status', 'scheduled') // race-safe: skip if ops flipped it meanwhile
    if (upErr) throw new Error(`db_update_failed: ${upErr.message}`)
  }

  return {
    inserted: plan.toInsert.length,
    updated: plan.toUpdate.length,
    skipped: plan.skipped.length,
  }
}
