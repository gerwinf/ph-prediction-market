/**
 * Refresh the World Cup fixtures in the `markets` catalog from the OFFICIAL FIFA
 * data API (the same source powering fifa.com's schedule page).
 *
 *   GET https://api.fifa.com/api/v3/calendar/matches
 *       ?idCompetition=17&idSeason=285023   (17 = FIFA World Cup, 285023 = 2026)
 *
 * On each run it pulls the current + upcoming matches (resolved teams only),
 * REPLACES all `wc_fixture` rows with that set, and leaves `wc_contender` rows
 * untouched. Curated `fallback` odds are preserved across runs (matched on the
 * FIFA match id); brand-new fixtures get a neutral default until an operator
 * tweaks them in /ops/markets.
 *
 * Manual, idempotent — run it whenever you want the board to roll forward:
 *   npx tsx scripts/refresh-worldcup-fixtures.ts            # next ~8 days
 *   npx tsx scripts/refresh-worldcup-fixtures.ts 14         # next 14 days
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import type { WcFixturePayload } from '../lib/catalog/types'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

const ID_COMPETITION = '17' // FIFA World Cup
const ID_SEASON = '285023' // 2026 (Canada/Mexico/USA)
const DEFAULT_FORWARD_DAYS = 8
const MAX_FIXTURES = 12 // keep the /worldcup grid focused
const DEFAULT_FALLBACK = { home: 40, draw: 30, away: 30 }

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

type Loc = { Locale: string; Description: string }
type FifaTeam = { IdCountry?: string; TeamName?: Loc[] } | null
type FifaMatch = {
  IdMatch: string
  Date: string
  Home: FifaTeam
  Away: FifaTeam
  GroupName?: Loc[]
  StageName?: Loc[]
  Stadium?: { Name?: Loc[]; CityName?: Loc[] }
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

type FixtureRow = {
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

async function fetchFifaMatches(): Promise<FifaMatch[]> {
  const url =
    `https://api.fifa.com/api/v3/calendar/matches` +
    `?idCompetition=${ID_COMPETITION}&idSeason=${ID_SEASON}&count=200&language=en`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
  if (!res.ok) throw new Error(`FIFA API ${res.status} ${res.statusText}`)
  const json = (await res.json()) as { Results?: FifaMatch[] }
  return json.Results ?? []
}

async function main() {
  const forwardDays = Number(process.argv[2]) || DEFAULT_FORWARD_DAYS
  const now = Date.now()
  const from = now - 24 * 60 * 60 * 1000 // include matches that kicked off yesterday
  const until = now + forwardDays * 24 * 60 * 60 * 1000

  const all = await fetchFifaMatches()

  // Current + upcoming, real teams only, within the window, soonest first.
  const window = all
    .filter((m) => isResolved(m.Home) && isResolved(m.Away))
    .filter((m) => {
      const t = Date.parse(m.Date)
      return !Number.isNaN(t) && t >= from && t <= until
    })
    .sort((a, b) => a.Date.localeCompare(b.Date))
    .slice(0, MAX_FIXTURES)

  if (window.length === 0) {
    console.log(`No resolved FIFA fixtures in the next ${forwardDays} days — leaving the catalog as-is.`)
    return
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Read existing wc_fixture rows to (a) preserve curated odds by FIFA match id
  // and (b) know what to clear out.
  const { data: existing, error: readErr } = await admin
    .from('markets')
    .select('id, payload')
    .eq('kind', 'wc_fixture')
  if (readErr) {
    console.error('❌ could not read existing fixtures:', readErr.message)
    process.exit(1)
  }
  const oddsByFifaId = new Map<string, WcFixturePayload['fallback']>()
  for (const r of existing ?? []) {
    const p = (r.payload ?? {}) as { fifa_match_id?: string; fallback?: WcFixturePayload['fallback'] }
    if (p.fifa_match_id && p.fallback) oddsByFifaId.set(p.fifa_match_id, p.fallback)
  }

  const rows: FixtureRow[] = window.map((m) => ({
    kind: 'wc_fixture',
    category: 'worldcup',
    title: `${teamName(m.Home)} vs ${teamName(m.Away)}`,
    fixture_id: null,
    status: 'approved',
    interest_score: 0,
    source: 'feed:fifa',
    reviewed_by: 'feed',
    payload: {
      home: { name: teamName(m.Home), iso: teamIso(m.Home) },
      away: { name: teamName(m.Away), iso: teamIso(m.Away) },
      group: groupLabel(m),
      kickoff_iso: new Date(m.Date).toISOString(),
      venue: venueLabel(m) || undefined,
      fallback: oddsByFifaId.get(m.IdMatch) ?? DEFAULT_FALLBACK,
      fifa_match_id: m.IdMatch,
    },
  }))

  // Clean replace: drop every wc_fixture row, then insert the fresh window.
  const removed = (existing ?? []).length
  if (removed > 0) {
    const { error: delErr } = await admin.from('markets').delete().eq('kind', 'wc_fixture')
    if (delErr) {
      console.error('❌ could not clear old fixtures:', delErr.message)
      process.exit(1)
    }
  }

  const { error: insErr } = await admin.from('markets').insert(rows)
  if (insErr) {
    console.error('❌ insert failed:', insErr.message)
    process.exit(1)
  }

  console.log(`✅ refreshed wc_fixture: removed ${removed}, inserted ${rows.length}.`)
  for (const r of rows) {
    const k = new Date(r.payload.kickoff_iso).toISOString().slice(0, 16).replace('T', ' ')
    console.log(`   ${k}Z  Group ${r.payload.group}  ${r.title}  @ ${r.payload.venue ?? '—'}`)
  }
}

main()
