/**
 * /worldcup fixture auto-refresh — rolls the World Cup board forward from the
 * OFFICIAL FIFA data API (the same source powering /hits and fifa.com):
 *
 *   GET https://api.fifa.com/api/v3/calendar/matches
 *       ?idCompetition=17&idSeason=285023   (17 = FIFA World Cup, 285023 = 2026)
 *
 * Rides the daily `maintain-catalog` cron. Unlike the old clean-replace script,
 * this is INSERT-ONLY + PRUNE-PAST (option B):
 *
 *   • INSERT new fixtures the board doesn't have yet (dedup by FIFA match id).
 *     Existing rows are never updated, so any per-row odds an operator tuned in
 *     /ops/markets SURVIVE the nightly refresh.
 *   • PRUNE only feed-sourced (`source = 'feed:fifa'`) rows whose kickoff has
 *     rolled out of the window — this keeps the board scrolling forward without
 *     ever deleting an operator-created fixture.
 *
 * Tradeoff (matches lib/hits/fixture-ingest): because existing rows are never
 * updated, a FIFA kickoff/venue change on an ALREADY-INGESTED match isn't
 * picked up — insert-only preserves ops edits at the cost of feed corrections
 * to live rows. New fixtures still roll in automatically.
 *
 * The FIFA API carries no betting prices, so `fallback` odds are derived from a
 * built-in team-strength table (favorites favored, even sides → higher draw %).
 */
import type { WcFixturePayload } from '../catalog/types'

const ID_COMPETITION = '17' // FIFA World Cup
const ID_SEASON = '285023' // 2026 (Canada/Mexico/USA)
const DEFAULT_FORWARD_DAYS = 8
const GRACE_DAYS = 1 // keep matches that kicked off up to a day ago ("latest result")
const MAX_FIXTURES = 12 // keep the /worldcup grid focused
const HOME_ADV = 3 // slight bump for the FIFA-designated "home" side
const ELO_SCALE = 20 // strength points per ~order-of-magnitude odds shift
const DAY_MS = 24 * 60 * 60 * 1000

// FIFA 3-letter country codes → ISO 3166-1 alpha-2 (lowercase, flagcdn keys).
// England renders the Union Jack ('gb') to match the contenders board; Scotland
// uses the flagcdn subdivision code for the Saltire.
const FIFA_TO_ISO: Record<string, string> = {
  ALG: 'dz', ARG: 'ar', AUS: 'au', AUT: 'at', BEL: 'be', BIH: 'ba', BRA: 'br',
  CAN: 'ca', CIV: 'ci', COD: 'cd', COL: 'co', CPV: 'cv', CRO: 'hr', CUW: 'cw',
  CZE: 'cz', ECU: 'ec', EGY: 'eg', ENG: 'gb', ESP: 'es', FRA: 'fr', GER: 'de',
  GHA: 'gh', HAI: 'ht', IRN: 'ir', IRQ: 'iq', JOR: 'jo', JPN: 'jp', KOR: 'kr',
  KSA: 'sa', MAR: 'ma', MEX: 'mx', NED: 'nl', NOR: 'no', NZL: 'nz', PAN: 'pa',
  PAR: 'py', POR: 'pt', QAT: 'qa', RSA: 'za', SCO: 'gb-sct', SEN: 'sn',
  SUI: 'ch', SWE: 'se', TUN: 'tn', TUR: 'tr', URU: 'uy', USA: 'us', UZB: 'uz',
}

// Friendlier display names where FIFA's are awkward for a consumer board.
const NAME_OVERRIDE: Record<string, string> = {
  KOR: 'South Korea', IRN: 'Iran', TUR: 'Türkiye', USA: 'United States',
  CIV: 'Ivory Coast', RSA: 'South Africa',
}

// Rough team strength (0–100) used ONLY to derive curated fallback odds — the
// FIFA API carries no betting prices. Approximate, tiered by recent form/quality;
// tweak any value to taste. Unknown codes default to 70 (mid).
const STRENGTH: Record<string, number> = {
  ARG: 94, FRA: 93, ESP: 93, BRA: 91, ENG: 90, GER: 88, POR: 88, NED: 86,
  BEL: 85, CRO: 83, URU: 83, MAR: 82, SUI: 80, COL: 80, SEN: 79, JPN: 78,
  USA: 78, NOR: 78, MEX: 77, TUR: 76, CIV: 76, AUT: 76, EGY: 75, ECU: 75,
  ALG: 74, SWE: 74, KOR: 74, CAN: 74, CZE: 73, IRN: 73, COD: 72, AUS: 72,
  PAR: 72, SCO: 72, GHA: 70, TUN: 70, BIH: 70, RSA: 67, QAT: 67, PAN: 66,
  KSA: 65, UZB: 65, IRQ: 64, JOR: 63, NZL: 61, HAI: 60, CPV: 60, CUW: 56,
}

const strengthOf = (code?: string): number => (code && STRENGTH[code]) || 70

/**
 * Derive home/draw/away percentages (summing to 100) from team strength via an
 * Elo-style expected score, with draws likelier when the sides are even.
 */
function deriveFallback(homeCode?: string, awayCode?: string): WcFixturePayload['fallback'] {
  const sh = strengthOf(homeCode) + HOME_ADV
  const sa = strengthOf(awayCode)
  const expHome = 1 / (1 + Math.pow(10, (sa - sh) / ELO_SCALE)) // 0..1 expected score
  let draw = 0.3 - 0.4 * Math.abs(expHome - 0.5) // ~30% when even → shrinks when lopsided
  draw = Math.max(0.1, Math.min(0.32, draw))
  const home = Math.max(0.03, expHome - draw / 2)
  const away = Math.max(0.03, 1 - expHome - draw / 2)
  const total = home + draw + away
  const h = Math.round((home / total) * 100)
  const d = Math.round((draw / total) * 100)
  return { home: h, draw: d, away: 100 - h - d }
}

type Loc = { Locale: string; Description: string }
type FifaTeam = { IdCountry?: string; TeamName?: Loc[] } | null

export type FifaMatch = {
  IdMatch: string
  Date: string
  Home: FifaTeam
  Away: FifaTeam
  GroupName?: Loc[]
  StageName?: Loc[]
  Stadium?: { Name?: Loc[]; CityName?: Loc[] }
}

/** An insertable markets row (kind='wc_fixture') built from the FIFA feed. */
export type WcFixtureInsert = {
  kind: 'wc_fixture'
  category: 'worldcup'
  title: string
  fixture_id: null
  status: 'approved'
  interest_score: number
  source: 'feed:fifa'
  reviewed_by: 'feed'
  payload: WcFixturePayload & { fifa_match_id: string }
}

/** The slice of an existing wc_fixture row the sync planner needs. */
export type ExistingWcRow = {
  id: string
  source: string | null
  fifaMatchId: string | null
  kickoffISO: string | null
}

const en = (arr?: Loc[]): string =>
  (arr?.find((x) => x.Locale === 'en-GB') ?? arr?.[0])?.Description ?? ''

const teamName = (t: FifaTeam): string =>
  (t?.IdCountry && NAME_OVERRIDE[t.IdCountry]) || en(t?.TeamName)

const teamIso = (t: FifaTeam): string =>
  (t?.IdCountry && FIFA_TO_ISO[t.IdCountry]) || (t?.IdCountry ?? '').toLowerCase()

const isResolved = (t: FifaTeam): boolean => !!(t?.IdCountry && en(t?.TeamName))

function groupLabel(m: FifaMatch): string {
  const g = en(m.GroupName)
  if (g) return g.replace(/^Group\s+/i, '')
  return en(m.StageName) || '—'
}

function venueLabel(m: FifaMatch): string {
  const name = en(m.Stadium?.Name)
  const city = en(m.Stadium?.CityName)
  return [name, city].filter(Boolean).join(', ')
}

/**
 * Pure mapper: FIFA calendar → insertable wc_fixture rows. Keeps only matches
 * that (a) have both teams resolved and (b) kick off inside the window
 * [now − GRACE_DAYS, now + forwardDays], soonest first, capped at MAX_FIXTURES.
 */
export function wcFixtureRowsFromFifa(
  matches: FifaMatch[],
  now: Date,
  forwardDays = DEFAULT_FORWARD_DAYS,
  max = MAX_FIXTURES
): WcFixtureInsert[] {
  const from = now.getTime() - GRACE_DAYS * DAY_MS
  const until = now.getTime() + forwardDays * DAY_MS

  return matches
    .filter((m) => isResolved(m.Home) && isResolved(m.Away))
    .filter((m) => {
      const t = Date.parse(m.Date)
      return Number.isFinite(t) && t >= from && t <= until
    })
    .sort((a, b) => a.Date.localeCompare(b.Date))
    .slice(0, max)
    .map((m) => {
      const venue = venueLabel(m)
      const payload: WcFixtureInsert['payload'] = {
        home: { name: teamName(m.Home), iso: teamIso(m.Home) },
        away: { name: teamName(m.Away), iso: teamIso(m.Away) },
        group: groupLabel(m),
        kickoff_iso: new Date(m.Date).toISOString(),
        fallback: deriveFallback(m.Home?.IdCountry, m.Away?.IdCountry),
        fifa_match_id: m.IdMatch,
      }
      if (venue) payload.venue = venue
      return {
        kind: 'wc_fixture',
        category: 'worldcup',
        title: `${teamName(m.Home)} vs ${teamName(m.Away)}`,
        fixture_id: null,
        status: 'approved',
        interest_score: 0,
        source: 'feed:fifa',
        reviewed_by: 'feed',
        payload,
      }
    })
}

/**
 * Pure diff (option B): given fresh feed candidates and the rows already on the
 * board, decide what to INSERT (candidates not yet present, keyed on FIFA match
 * id) and what to PRUNE (feed-sourced rows whose kickoff has rolled past the
 * grace window). Operator-created rows and upcoming feed rows are never pruned,
 * and existing rows are never updated — so ops odds overrides always survive.
 */
export function planWcFixtureSync(
  candidates: WcFixtureInsert[],
  existing: ExistingWcRow[],
  now: Date,
  graceDays = GRACE_DAYS
): { toInsert: WcFixtureInsert[]; pruneIds: string[] } {
  const known = new Set(existing.map((r) => r.fifaMatchId).filter(Boolean) as string[])
  const toInsert = candidates.filter((c) => !known.has(c.payload.fifa_match_id))

  const cutoff = now.getTime() - graceDays * DAY_MS
  const pruneIds = existing
    .filter((r) => r.source === 'feed:fifa')
    .filter((r) => {
      const t = r.kickoffISO ? Date.parse(r.kickoffISO) : NaN
      return Number.isFinite(t) && t < cutoff
    })
    .map((r) => r.id)

  return { toInsert, pruneIds }
}

async function fetchFifaMatches(): Promise<FifaMatch[]> {
  const url =
    `https://api.fifa.com/api/v3/calendar/matches` +
    `?idCompetition=${ID_COMPETITION}&idSeason=${ID_SEASON}&count=200&language=en`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`FIFA API ${res.status} ${res.statusText}`)
  const json = (await res.json()) as { Results?: FifaMatch[] }
  return json.Results ?? []
}

/**
 * Cron step (rides maintain-catalog daily). Insert-only + prune-past; never
 * throws. Returns a summary for the cron log.
 */
export async function refreshWcFixtures(
  forwardDays = DEFAULT_FORWARD_DAYS
): Promise<{ candidates: number; inserted: number; pruned: number }> {
  try {
    const now = new Date()
    const candidates = wcFixtureRowsFromFifa(await fetchFifaMatches(), now, forwardDays)

    const { createAdminClient } = await import('../supabase/admin')
    const admin = createAdminClient()

    const { data: rows, error: readErr } = await admin
      .from('markets')
      .select('id, source, payload')
      .eq('kind', 'wc_fixture')
    if (readErr) {
      console.error('[worldcup/fixture-refresh] read failed:', readErr.message)
      return { candidates: candidates.length, inserted: 0, pruned: 0 }
    }

    const existing: ExistingWcRow[] = (rows ?? []).map((r) => {
      const p = (r.payload ?? {}) as { fifa_match_id?: string; kickoff_iso?: string }
      return {
        id: r.id as string,
        source: (r.source as string | null) ?? null,
        fifaMatchId: p.fifa_match_id ?? null,
        kickoffISO: p.kickoff_iso ?? null,
      }
    })

    const { toInsert, pruneIds } = planWcFixtureSync(candidates, existing, now)

    if (toInsert.length > 0) {
      const { error } = await admin.from('markets').insert(toInsert)
      if (error) {
        console.error('[worldcup/fixture-refresh] insert failed:', error.message)
        return { candidates: candidates.length, inserted: 0, pruned: 0 }
      }
    }
    if (pruneIds.length > 0) {
      const { error } = await admin.from('markets').delete().in('id', pruneIds)
      if (error) {
        console.error('[worldcup/fixture-refresh] prune failed:', error.message)
        return { candidates: candidates.length, inserted: toInsert.length, pruned: 0 }
      }
    }

    if (toInsert.length > 0 || pruneIds.length > 0) {
      console.info(
        `[worldcup/fixture-refresh] inserted ${toInsert.length}, pruned ${pruneIds.length}` +
          (toInsert.length ? ` — new: ${toInsert.map((r) => r.payload.fifa_match_id).join(', ')}` : '')
      )
    }
    return { candidates: candidates.length, inserted: toInsert.length, pruned: pruneIds.length }
  } catch (err) {
    console.error('[worldcup/fixture-refresh] error:', err)
    return { candidates: 0, inserted: 0, pruned: 0 }
  }
}
