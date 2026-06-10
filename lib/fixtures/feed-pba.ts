/**
 * PBA schedule rows → fixture candidates (pure mapping).
 *
 * Given the raw games scraped from pba.ph/schedule, produce normalized
 * `FixtureCandidate`s ready to upsert into `match_fixtures`. Pure and
 * deterministic — the caller supplies `nowMs` — so it's unit-testable like
 * `mapPolymarketEventToCandidate`, independent of how the rows were scraped.
 *
 * Responsibilities:
 *   - parse "Fri, Jun 12" + "07:30 PM" (PH local) → ISO UTC, inferring the year
 *   - map team display names → short codes + clean labels
 *   - build a deterministic id so re-runs are idempotent
 *   - drop already-started games and dedupe repeats
 */
import type { FixtureCandidate, RawScheduleGame } from './types'

const PH_OFFSET_MS = 8 * 60 * 60 * 1000 // PHT = UTC+8, no DST
const SOURCE = 'feed:pba'

/**
 * The 12 PBA season-50 teams, matched by distinctive keyword against the
 * uppercased display name. Order matters: Ginebra's full name is "Barangay
 * Ginebra San Miguel", so it MUST be checked before San Miguel (matched via
 * the unambiguous "BEERMEN").
 */
const TEAMS: Array<{ code: string; name: string; keywords: string[] }> = [
  { code: 'gin', name: 'Ginebra',      keywords: ['GINEBRA'] },
  { code: 'tnt', name: 'TNT',          keywords: ['TNT', 'TROPANG'] },
  { code: 'mer', name: 'Meralco',      keywords: ['MERALCO'] },
  { code: 'smb', name: 'San Miguel',   keywords: ['BEERMEN', 'SAN MIGUEL'] },
  { code: 'mag', name: 'Magnolia',     keywords: ['MAGNOLIA', 'HOTSHOTS'] },
  { code: 'nlx', name: 'NLEX',         keywords: ['NLEX'] },
  { code: 'npt', name: 'NorthPort',    keywords: ['NORTHPORT', 'BATANG PIER'] },
  { code: 'con', name: 'Converge',     keywords: ['CONVERGE', 'FIBERXERS'] },
  { code: 'pho', name: 'Phoenix',      keywords: ['PHOENIX'] },
  { code: 'ros', name: 'Rain or Shine', keywords: ['RAIN OR SHINE', 'ELASTO'] },
  { code: 'ter', name: 'Terrafirma',   keywords: ['TERRAFIRMA', 'DYIP'] },
  { code: 'blk', name: 'Blackwater',   keywords: ['BLACKWATER', 'BOSSING'] },
]

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/** Resolve a display name to a known team, or a slugged fallback. */
function resolveTeam(displayName: string): { code: string; name: string } {
  const hay = displayName.toUpperCase()
  for (const t of TEAMS) {
    if (t.keywords.some((k) => hay.includes(k))) return { code: t.code, name: t.name }
  }
  // Unknown team (guest/all-star): derive a stable code + readable label.
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const code = slug.slice(0, 3) || 'xxx'
  const name = displayName
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return { code, name }
}

/**
 * Parse a PH-local date + time into a UTC epoch, inferring the year from the
 * reference clock. A month earlier than "now"'s month rolls over to next year
 * (e.g. a January game seen in June is next January). Returns null when either
 * field is unparseable.
 */
function parsePhKickoff(
  dateText: string,
  timeText: string,
  nowMs: number
): { utcMs: number; phYear: number; phMonth: number; phDay: number } | null {
  const dm = dateText.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/)
  if (!dm) return null
  const month = MONTHS[dm[1].toLowerCase()]
  if (month === undefined) return null
  const day = Number(dm[2])

  const tm = timeText.match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])/)
  if (!tm) return null
  let hour = Number(tm[1]) % 12
  if (/[Pp]/.test(tm[3])) hour += 12
  const minute = Number(tm[2])

  // Year inference off the PH-local "now".
  const nowPh = new Date(nowMs + PH_OFFSET_MS)
  let year = nowPh.getUTCFullYear()
  if (month < nowPh.getUTCMonth()) year += 1

  // PH wall-clock → UTC instant (subtract the +8 offset). Built via Date.UTC so
  // the result is independent of the host machine's timezone.
  const utcMs = Date.UTC(year, month, day, hour, minute) - PH_OFFSET_MS
  return { utcMs, phYear: year, phMonth: month, phDay: day }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function mapPbaScheduleToFixtures(
  rawGames: RawScheduleGame[],
  nowMs: number
): FixtureCandidate[] {
  const byId = new Map<string, FixtureCandidate>()

  for (const g of rawGames) {
    const kickoff = parsePhKickoff(g.dateText, g.timeText, nowMs)
    if (!kickoff) continue
    if (kickoff.utcMs < nowMs) continue // already started — not "upcoming"

    const a = resolveTeam(g.teamA)
    const b = resolveTeam(g.teamB)
    const phDate = `${kickoff.phYear}-${pad(kickoff.phMonth + 1)}-${pad(kickoff.phDay)}`
    const id = `pba-${a.code}-${b.code}-${phDate}`
    if (byId.has(id)) continue // dedupe repeated rows for the same game

    byId.set(id, {
      id,
      card_type: 'sports',
      match_label: `${a.name} vs ${b.name}`,
      starts_at: new Date(kickoff.utcMs).toISOString(),
      status: 'scheduled',
      source: SOURCE,
      venue: g.venue?.trim() || null,
    })
  }

  return Array.from(byId.values())
}
