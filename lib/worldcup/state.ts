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
