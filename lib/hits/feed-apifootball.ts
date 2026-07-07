import { WC_TEAMS } from './players-wc'
import { wcCodesFromMatchId } from './feed-fifa'

/**
 * API-Football (api-sports.io) → /hits event keys. SUPPLEMENTARY feed.
 *
 * FIFA's public timeline is the primary source (feed-fifa.ts) but has no
 * event types for VAR or missed penalties. API-Football carries both as
 * first-class events, so this sync fills exactly those blind-spot keys:
 *
 *   type 'Var'                          → var-review (+ var-overturn when
 *                                         the call is cancelled/overturned)
 *   type 'Goal', detail 'Missed Penalty' → penalty-missed
 *
 * Nothing else is mapped on purpose — everything FIFA already detects stays
 * single-sourced (dedupe is by event_key either way, this just avoids two
 * feeds racing each other for the same keys).
 *
 * Quota: the FREE plan is 100 req/day (10 r/min) and serves a rolling
 * today±1 window — enough for live matches. The sync therefore (a) only
 * polls fixtures whose status is 'live', (b) sits behind a 240s TTL
 * (~37 polls per match, two matches/day fits the free quota), and
 * (c) no-ops entirely without the API_FOOTBALL_KEY env var.
 *
 * Layering mirrors feed-fifa: `mapApiFootballEvents` is PURE (unit-tested
 * against a real captured payload); `syncApiFootballEvents` orchestrates and
 * must never throw.
 */

const AF_BASE = 'https://v3.football.api-sports.io'
const SYNC_TTL_MS = 240_000

export type AfEvent = {
  time?: { elapsed?: number | null; extra?: number | null } | null
  team?: { id?: number; name?: string | null } | null
  player?: { id?: number | null; name?: string | null } | null
  type?: string | null // 'Goal' | 'Card' | 'subst' | 'Var'
  detail?: string | null // 'Normal Goal' | 'Missed Penalty' | 'Goal cancelled' | …
  comments?: string | null
}

export type AfMappedEvent = { eventKey: string; minute: string; description: string }

const minuteOf = (e: AfEvent): string => {
  const t = e.time
  if (!t || typeof t.elapsed !== 'number') return ''
  return `${t.elapsed}${t.extra ? `+${t.extra}` : ''}'`
}

/** Map API-Football fixture events onto the FIFA-blind /hits keys. Pure. */
export function mapApiFootballEvents(events: AfEvent[]): AfMappedEvent[] {
  const out: AfMappedEvent[] = []
  const fired = new Set<string>()
  const add = (eventKey: string, e: AfEvent, description: string) => {
    if (fired.has(eventKey)) return
    fired.add(eventKey)
    out.push({ eventKey, minute: minuteOf(e), description })
  }

  for (const e of events) {
    const type = (e.type ?? '').toLowerCase()
    const detail = e.detail ?? ''
    const team = e.team?.name ?? ''
    const player = e.player?.name ?? ''

    if (type === 'var') {
      add('var-review', e, `VAR: ${detail}${team ? ` — ${team}` : ''}`)
      if (/cancel|disallow|overturn/i.test(detail)) {
        add('var-overturn', e, `VAR overturns the call: ${detail}${team ? ` — ${team}` : ''}`)
      }
    } else if (type === 'goal' && /missed penalty/i.test(detail)) {
      add('penalty-missed', e, `Penalty missed${player ? ` — ${player}` : ''}${team ? ` (${team})` : ''}`)
    }
  }
  return out
}

/* ────────────────────────────────────────────────────────────────────────
 * Server-side sync (called from GET /api/events next to syncFifaEvents)
 * ──────────────────────────────────────────────────────────────────────── */

// Per-instance memos, same pattern as feed-fifa.
const lastSyncAt = new Map<string, number>()
const fixtureIdByMatch = new Map<string, number | null>()

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Resolve our wc-<home>-<away>-<date> id to an API-Football fixture id. */
async function resolveAfFixtureId(matchId: string, key: string): Promise<number | null> {
  if (fixtureIdByMatch.has(matchId)) return fixtureIdByMatch.get(matchId) ?? null

  const codes = wcCodesFromMatchId(matchId)
  const date = matchId.split('-').slice(3).join('-')
  if (!codes || !date) {
    fixtureIdByMatch.set(matchId, null)
    return null
  }
  const names = codes.map((c) => {
    const team = WC_TEAMS[c as keyof typeof WC_TEAMS]
    return norm(team ? team.full : c)
  })

  const res = await fetch(`${AF_BASE}/fixtures?date=${date}`, {
    headers: { 'x-apisports-key': key },
    cache: 'no-store',
  })
  if (!res.ok) return null // don't memo — transient failure may recover
  const j = (await res.json()) as {
    response?: Array<{
      fixture?: { id?: number }
      teams?: { home?: { name?: string }; away?: { name?: string } }
    }>
  }
  const hit = (j.response ?? []).find((f) => {
    const h = norm(f.teams?.home?.name ?? '')
    const a = norm(f.teams?.away?.name ?? '')
    return (h === names[0] && a === names[1]) || (h === names[1] && a === names[0])
  })
  const id = hit?.fixture?.id ?? null
  fixtureIdByMatch.set(matchId, id)
  return id
}

/**
 * Lazy-on-read supplementary sync. Inserts only the FIFA-blind keys, only
 * while the fixture is live, only when API_FOOTBALL_KEY is configured.
 * Never throws.
 */
export async function syncApiFootballEvents(matchId: string): Promise<void> {
  try {
    const key = process.env.API_FOOTBALL_KEY
    if (!key || !matchId.startsWith('wc-')) return
    const last = lastSyncAt.get(matchId) ?? 0
    if (Date.now() - last < SYNC_TTL_MS) return
    lastSyncAt.set(matchId, Date.now())

    const { createAdminClient } = await import('../supabase/admin')
    const admin = createAdminClient()

    // Quota guard: only spend API requests on games that are actually live.
    const { data: fix } = await admin
      .from('match_fixtures')
      .select('status')
      .eq('id', matchId)
      .maybeSingle()
    if (fix?.status !== 'live') return

    const fixtureId = await resolveAfFixtureId(matchId, key)
    if (!fixtureId) return

    const res = await fetch(`${AF_BASE}/fixtures/events?fixture=${fixtureId}`, {
      headers: { 'x-apisports-key': key },
      cache: 'no-store',
    })
    if (!res.ok) return
    const j = (await res.json()) as { response?: AfEvent[] }
    const mapped = mapApiFootballEvents(j.response ?? [])
    if (mapped.length === 0) return

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
          payload: { source: 'api-football', minute: m.minute, description: m.description },
        }))
      )
    }
  } catch {
    /* supplementary feed must never break the events poll */
  }
}
