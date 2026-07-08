import { fetchFifaCalendar, type FifaCalendarMatch } from './feed-fifa'
import { WC_TEAMS } from './players-wc'

/**
 * /hits fixture auto-ingest — creates `match_fixtures` rows for upcoming
 * World Cup games so the pre-buy funnel never runs dry by someone forgetting
 * to insert a row (it did: 66% of cards are bought pre-game, and the QF
 * fixtures were missing until hand-patched on 2026-07-08).
 *
 * Gate: BOTH squads must be registered in players-wc — an unregistered code
 * would give cards a fallback pool whose cells can never light. Knockout
 * matches with unresolved (TBD) teams are skipped automatically and picked up
 * by a later run once FIFA resolves them.
 *
 * Rows are insert-only (`ignoreDuplicates`): ops-owned fields (status,
 * ends_at, settlement_mode) are never overwritten by the feed.
 */

export type IngestFixtureRow = {
  id: string
  card_type: 'sports'
  match_label: string
  starts_at: string
  status: 'scheduled'
}

const en = (arr?: Array<{ Locale?: string; Description?: string }>): string =>
  (arr?.find((x) => x.Locale === 'en-GB') ?? arr?.[0])?.Description ?? ''

const REGISTERED = new Set(Object.keys(WC_TEAMS))

/**
 * Pure mapper: FIFA calendar → insertable fixture rows. Only matches that
 * (a) start inside (now, now + horizon], (b) have both teams resolved, and
 * (c) have both squads registered.
 */
export function wcFixtureRowsFromCalendar(
  matches: FifaCalendarMatch[],
  now: Date,
  horizonDays = 8
): IngestFixtureRow[] {
  const from = now.getTime()
  const until = from + horizonDays * 24 * 60 * 60 * 1000
  const rows: IngestFixtureRow[] = []

  for (const m of matches) {
    const t = Date.parse(m.Date ?? '')
    if (!Number.isFinite(t) || t <= from || t > until) continue
    const h = m.Home?.IdCountry
    const a = m.Away?.IdCountry
    if (!h || !a || !REGISTERED.has(h) || !REGISTERED.has(a)) continue
    const homeName = en(m.Home?.TeamName)
    const awayName = en(m.Away?.TeamName)
    if (!homeName || !awayName) continue

    const utcDate = new Date(t).toISOString().slice(0, 10)
    const stage = en(m.StageName)
    rows.push({
      id: `wc-${h.toLowerCase()}-${a.toLowerCase()}-${utcDate}`,
      card_type: 'sports',
      match_label: `${homeName} vs ${awayName} — World Cup 2026${stage ? ` · ${stage}` : ''}`,
      starts_at: new Date(t).toISOString(),
      status: 'scheduled',
    })
  }
  return rows
}

/**
 * Cron step (rides maintain-catalog daily). Insert-only; never throws.
 * Returns a summary for the cron log.
 */
export async function ingestUpcomingWcFixtures(): Promise<{
  candidates: number
  inserted: number
}> {
  try {
    const calendar = await fetchFifaCalendar()
    const rows = wcFixtureRowsFromCalendar(calendar, new Date())
    if (rows.length === 0) return { candidates: 0, inserted: 0 }

    const { createAdminClient } = await import('../supabase/admin')
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('match_fixtures')
      .select('id')
      .in('id', rows.map((r) => r.id))
    const known = new Set((existing ?? []).map((r) => r.id as string))
    const fresh = rows.filter((r) => !known.has(r.id))

    if (fresh.length > 0) {
      const { error } = await admin
        .from('match_fixtures')
        .upsert(fresh, { onConflict: 'id', ignoreDuplicates: true })
      if (error) {
        console.error('[hits/fixture-ingest] insert failed:', error.message)
        return { candidates: rows.length, inserted: 0 }
      }
      console.info(
        `[hits/fixture-ingest] created ${fresh.length} fixture(s): ${fresh.map((r) => r.id).join(', ')}`
      )
    }
    return { candidates: rows.length, inserted: fresh.length }
  } catch (err) {
    console.error('[hits/fixture-ingest] error:', err)
    return { candidates: 0, inserted: 0 }
  }
}
