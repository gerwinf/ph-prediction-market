import { WC_PLAYERS, type WcTeamCode } from './players-wc'

/**
 * FIFA live-timeline → /hits event keys.
 *
 * FIFA's public keyless API (the same one behind our fixtures refresh) exposes
 * per-match timelines: typed, minute-stamped events with running score and an
 * en-GB description. This module maps them onto the /hits event keys defined
 * in events-wc.ts + pool-builder.ts so cards light up from the real game
 * instead of ops hand-firing every event.
 *
 * Layering: `mapFifaTimeline` is PURE (unit-tested against a real captured
 * timeline); `syncFifaEvents` is the server-side orchestrator that fetches,
 * maps, diffs against already-fired keys, inserts, and advances the fixture
 * status. It must never throw — a broken feed degrades to "cells stop
 * lighting", never a broken poll.
 *
 * Not every cell is feed-detectable (VAR, woodwork, header goals have no
 * reliable FIFA type). Those keys simply never auto-fire; /ops manual firing
 * still works and coexists (dedupe is by event_key).
 */

// FIFA timeline event types (observed + verified on WC 2026 matches).
const T = {
  GOAL: 0,
  YELLOW: 2,
  SUB: 5,
  PERIOD_START: 7,
  PERIOD_END: 8,
  ATTEMPT: 12,
  CORNER: 16,
  MATCH_END: 26,
  PEN_GOAL: 41,
  SAVE: 57,
  MISC: 71, // "Penalty given", "Red card given" — discriminate on description
} as const

export type FifaTimelineEvent = {
  EventId?: string
  IdTeam?: string | null
  IdPlayer?: string | null
  Type?: number
  MatchMinute?: string
  Period?: number
  HomeGoals?: number
  AwayGoals?: number
  HomePenaltyGoals?: number
  AwayPenaltyGoals?: number
  EventDescription?: Array<{ Locale?: string; Description?: string }>
}

export type MatchContext = {
  homeIdTeam: string
  awayIdTeam: string
  homeCode: WcTeamCode | string // lower-cased into event keys ('por-first')
  awayCode: WcTeamCode | string
}

export type MappedEvent = { eventKey: string; minute: string; description: string }

const desc = (e: FifaTimelineEvent): string =>
  e.EventDescription?.[0]?.Description ?? ''

const minuteNum = (m?: string): number => {
  const n = parseInt(m ?? '', 10)
  return Number.isFinite(n) ? n : 0
}

/** Normalize for name matching: lowercase, strip diacritics. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Map a FIFA timeline onto /hits event keys. Deterministic and pure. Each key
 * appears at most once (first qualifying moment). Player keys are matched by
 * normalized full-name substring against the WC_PLAYERS squads for the two
 * teams in `ctx` — an unmatched player just doesn't light a cell.
 */
export function mapFifaTimeline(
  events: FifaTimelineEvent[],
  ctx: MatchContext
): MappedEvent[] {
  const out: MappedEvent[] = []
  const fired = new Set<string>()
  const add = (eventKey: string, e: FifaTimelineEvent) => {
    if (fired.has(eventKey)) return
    fired.add(eventKey)
    out.push({ eventKey, minute: e.MatchMinute ?? '', description: desc(e) })
  }

  const codeFor = (idTeam?: string | null): string | null =>
    idTeam === ctx.homeIdTeam
      ? String(ctx.homeCode).toLowerCase()
      : idTeam === ctx.awayIdTeam
        ? String(ctx.awayCode).toLowerCase()
        : null

  const squad = WC_PLAYERS.filter(
    (p) => p.team === ctx.homeCode || p.team === ctx.awayCode
  ).map((p) => ({ id: p.id, needle: norm(p.name) }))
  const playerFor = (e: FifaTimelineEvent): string | null => {
    const d = norm(desc(e))
    return squad.find((p) => d.includes(p.needle))?.id ?? null
  }

  let yellows = 0
  let corners = 0
  let periodStarts = 0
  let firstPeriodEnded = false
  const goalsByPlayer = new Map<string, number>()
  const subbedInPlayerIds = new Set<string>()
  // Track whether the side currently in front was ever behind (comeback).
  let homeWasBehind = false
  let awayWasBehind = false

  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    const type = e.Type

    if (type === T.GOAL || type === T.PEN_GOAL) {
      const home = e.HomeGoals ?? 0
      const away = e.AwayGoals ?? 0
      if (home > away) awayWasBehind = true
      if (away > home) homeWasBehind = true

      const code = codeFor(e.IdTeam)
      if (code && home + away === 1) add(`${code}-first`, e)
      if (home > 0 && away > 0) add('both-teams-score', e)
      if (home + away >= 3) add('over-2-goals', e)
      if (minuteNum(e.MatchMinute) <= 15 && !(e.MatchMinute ?? '').includes('+')) {
        add('first-goal-15', e)
      }
      if ((e.MatchMinute ?? '').includes('+')) add('injury-time-goal', e)
      if (type === T.PEN_GOAL) add('penalty-scored', e)

      const player = playerFor(e)
      if (player) {
        const n = (goalsByPlayer.get(player) ?? 0) + 1
        goalsByPlayer.set(player, n)
        add(`${player}-goal`, e)
        add(`${player}-sot`, e) // a goal is a shot on target
        if (n >= 2) add(`${player}-brace`, e)
      }
      if (e.IdPlayer && subbedInPlayerIds.has(e.IdPlayer)) add('sub-scores', e)
    } else if (type === T.YELLOW) {
      yellows += 1
      add('yellow-card', e)
      if (yellows >= 3) add('three-yellows', e)
      const player = playerFor(e)
      if (player) add(`${player}-card`, e)
    } else if (type === T.MISC) {
      const d = desc(e).toLowerCase()
      if (d.includes('penalty')) add('penalty-given', e)
      if (d.includes('red card')) add('red-card', e)
    } else if (type === T.CORNER) {
      corners += 1
      if (corners >= 10) add('corner-count-10', e)
    } else if (type === T.ATTEMPT) {
      // An attempt immediately answered by a keeper save = shot on target.
      if (events[i + 1]?.Type === T.SAVE) {
        const player = playerFor(e)
        if (player) add(`${player}-sot`, e)
      }
    } else if (type === T.PERIOD_START) {
      periodStarts += 1
      if (periodStarts > 2) add('goes-to-et', e)
    } else if (type === T.PERIOD_END) {
      if (!firstPeriodEnded) {
        firstPeriodEnded = true
        const home = e.HomeGoals ?? 0
        const away = e.AwayGoals ?? 0
        if (home === 0 && away === 0) add('nil-nil-half', e)
        else {
          const leader = home > away ? codeFor(ctx.homeIdTeam) : away > home ? codeFor(ctx.awayIdTeam) : null
          if (leader) add(`${leader}-half-lead`, e)
        }
      }
    } else if (type === T.SUB) {
      if (e.IdPlayer) subbedInPlayerIds.add(e.IdPlayer)
    } else if (type === T.MATCH_END) {
      const home = e.HomeGoals ?? 0
      const away = e.AwayGoals ?? 0
      const homePens = e.HomePenaltyGoals ?? 0
      const awayPens = e.AwayPenaltyGoals ?? 0
      const winner =
        home !== away
          ? (home > away ? codeFor(ctx.homeIdTeam) : codeFor(ctx.awayIdTeam))
          : homePens !== awayPens
            ? (homePens > awayPens ? codeFor(ctx.homeIdTeam) : codeFor(ctx.awayIdTeam))
            : null
      if (winner) {
        add(`${winner}-win`, e)
        const winnerWasBehind = winner === String(ctx.homeCode).toLowerCase() ? homeWasBehind : awayWasBehind
        if (winnerWasBehind) add('comeback-win', e)
      }
      if (home === 0 || away === 0) add('clean-sheet', e)
      if (home + away < 3) add('under-2-goals', e)
    }
  }

  return out
}

/** Fixture status implied by the timeline: untouched → live → final. */
export function fixtureStatusFromTimeline(
  events: FifaTimelineEvent[]
): 'scheduled' | 'live' | 'final' {
  if (events.some((e) => e.Type === T.MATCH_END)) return 'final'
  if (events.some((e) => e.Type === T.PERIOD_START)) return 'live'
  return 'scheduled'
}

/* ────────────────────────────────────────────────────────────────────────
 * Server-side sync (called from GET /api/events for wc- matches)
 * ──────────────────────────────────────────────────────────────────────── */

const FIFA_BASE = 'https://api.fifa.com/api/v3'
const ID_COMPETITION = '17'
const ID_SEASON = '285023'
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }

const SYNC_TTL_MS = 20_000
const CALENDAR_TTL_MS = 6 * 60 * 60 * 1000

// Per-instance memo. Multiple lambda instances may each sync once per TTL —
// harmless, inserts are diffed against fired keys first.
const lastSyncAt = new Map<string, number>()
let calendarCache: { at: number; results: unknown[] } | null = null

type FifaCalendarMatch = {
  IdMatch?: string
  IdStage?: string
  Date?: string
  Home?: { IdCountry?: string; IdTeam?: string } | null
  Away?: { IdCountry?: string; IdTeam?: string } | null
}

async function fetchCalendar(): Promise<FifaCalendarMatch[]> {
  if (calendarCache && Date.now() - calendarCache.at < CALENDAR_TTL_MS) {
    return calendarCache.results as FifaCalendarMatch[]
  }
  const res = await fetch(
    `${FIFA_BASE}/calendar/matches?idCompetition=${ID_COMPETITION}&idSeason=${ID_SEASON}&count=200&language=en`,
    { headers: UA, cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`FIFA calendar ${res.status}`)
  const j = (await res.json()) as { Results?: FifaCalendarMatch[] }
  calendarCache = { at: Date.now(), results: j.Results ?? [] }
  return j.Results ?? []
}

/**
 * Parse the two FIFA country codes out of a `wc-<home>-<away>-<date>` fixture
 * id. Unlike players-wc's teamsFromWcMatchId (which gates the CARD POOL to
 * squads we've curated), the feed accepts any 3-letter codes — they're
 * verified against the FIFA calendar before anything is fetched, and unknown
 * squads simply light no player cells.
 */
export function wcCodesFromMatchId(matchId: string): [string, string] | null {
  const m = matchId.match(/^wc-([a-z]{3})-([a-z]{3})-(\d{4}-\d{2}-\d{2})$/i)
  if (!m) return null
  return [m[1].toUpperCase(), m[2].toUpperCase()]
}

/**
 * Resolve our `wc-<home>-<away>-<date>` fixture id to the FIFA match. Matches
 * on both IdCountry codes (either orientation) and the date. Returns null for
 * anything we can't resolve — the sync then no-ops.
 */
export async function resolveFifaMatch(matchId: string): Promise<
  | { idStage: string; idMatch: string; ctx: MatchContext }
  | null
> {
  const teams = wcCodesFromMatchId(matchId)
  if (!teams) return null
  const [a, b] = teams
  const date = matchId.split('-').slice(3).join('-') // yyyy-mm-dd

  const cal = await fetchCalendar()
  for (const m of cal) {
    const h = m.Home?.IdCountry
    const w = m.Away?.IdCountry
    if (!h || !w || !m.IdMatch || !m.IdStage) continue
    const sameDay = (m.Date ?? '').startsWith(date)
    if (!sameDay) continue
    if ((h === a && w === b) || (h === b && w === a)) {
      return {
        idStage: m.IdStage,
        idMatch: m.IdMatch,
        ctx: {
          homeIdTeam: m.Home?.IdTeam ?? '',
          awayIdTeam: m.Away?.IdTeam ?? '',
          homeCode: h as WcTeamCode,
          awayCode: w as WcTeamCode,
        },
      }
    }
  }
  return null
}

/**
 * Lazy-on-read feed sync. Piggybacks the /api/events poll (cards poll every
 * ~3s); the TTL keeps FIFA fetches to ~1 per 20s per instance. Inserts only
 * event keys not already fired for the match (so /ops manual fires coexist),
 * and advances match_fixtures.status forward (scheduled → live → final) from
 * the timeline. Never throws.
 */
export async function syncFifaEvents(matchId: string): Promise<void> {
  try {
    if (!matchId.startsWith('wc-')) return
    const last = lastSyncAt.get(matchId) ?? 0
    if (Date.now() - last < SYNC_TTL_MS) return
    lastSyncAt.set(matchId, Date.now())

    const resolved = await resolveFifaMatch(matchId)
    if (!resolved) return

    const res = await fetch(
      `${FIFA_BASE}/timelines/${ID_COMPETITION}/${ID_SEASON}/${resolved.idStage}/${resolved.idMatch}?language=en`,
      { headers: UA, cache: 'no-store' }
    )
    if (!res.ok) return
    const j = (await res.json()) as { Event?: FifaTimelineEvent[] }
    const timeline = j.Event ?? []
    if (timeline.length === 0) return

    const mapped = mapFifaTimeline(timeline, resolved.ctx)

    const { createAdminClient } = await import('../supabase/admin')
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('events')
      .select('event_key')
      .eq('match_id', matchId)
    const firedKeys = new Set((existing ?? []).map((r) => r.event_key as string))

    const fresh = mapped.filter((m) => !firedKeys.has(m.eventKey))
    if (fresh.length > 0) {
      await admin.from('events').insert(
        fresh.map((m) => ({
          match_id: matchId,
          event_key: m.eventKey,
          payload: { source: 'fifa', minute: m.minute, description: m.description },
        }))
      )
    }

    // Advance fixture status (forward only — never demote a final match).
    const implied = fixtureStatusFromTimeline(timeline)
    if (implied !== 'scheduled') {
      const { data: fix } = await admin
        .from('match_fixtures')
        .select('status')
        .eq('id', matchId)
        .maybeSingle()
      const current = fix?.status as string | undefined
      const rank: Record<string, number> = { scheduled: 0, live: 1, final: 2 }
      if (current && (rank[implied] ?? 0) > (rank[current] ?? 0)) {
        await admin.from('match_fixtures').update({ status: implied }).eq('id', matchId)
      }
    }
  } catch {
    /* feed must never break the events poll */
  }
}
