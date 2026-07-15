/**
 * Live-fixture staleness window.
 *
 * A `match_fixtures` row only ever leaves `status='live'` when it's explicitly
 * finalized — by ops, or (for World Cup) by the lazy FIFA feed sync that runs
 * only while a card page is actively polling `/api/events`. If viewers leave
 * before full-time, or the feed can't resolve the match, the fixture stays
 * `live` forever. `/api/fixtures` then surfaces it as the live game with no age
 * bound, so `/hits` pins its default hero to a game that ended hours ago.
 *
 * These pure helpers give both the read path (drop stale-live from the picker)
 * and the cron (finalize + settle stale-live) a single, testable definition of
 * "this live row is clearly over."
 */

// Longest plausible wall-clock for a live sports fixture. Football with extra
// time + penalties runs ~2h45; basketball ~2h30. 5h leaves generous headroom
// for kickoff delays and short in-game stoppages so a genuinely live game is
// never hidden or force-finalized, while a stuck row recovers the same day.
export const STALE_LIVE_MS = 5 * 60 * 60 * 1000

export type LiveWindowFixture = {
  id: string
  status: string
  starts_at: string
  ends_at?: string | null
}

/** The always-on demo filler is intentionally perpetual-live — never stale. */
function isDemo(id: string): boolean {
  return id.startsWith('demo-')
}

/** Only real sports fixtures can be finalized/settled by the sweep. */
export function isSettleableId(id: string): boolean {
  return id.startsWith('wc-') || id.startsWith('pba-')
}

/**
 * True when a `live` row is clearly over: past `ends_at` if set, otherwise
 * more than STALE_LIVE_MS past `starts_at`. Demo filler is exempt. Returns
 * false for anything not currently `live`, and false when the timestamps are
 * unparseable — we only hide/finalize a row when we're sure it's stale.
 */
export function isStaleLive(fx: LiveWindowFixture, nowMs: number): boolean {
  if (fx.status !== 'live' || isDemo(fx.id)) return false
  const endsAt = fx.ends_at ? Date.parse(fx.ends_at) : NaN
  if (Number.isFinite(endsAt)) return endsAt < nowMs
  const startsAt = Date.parse(fx.starts_at)
  if (!Number.isFinite(startsAt)) return false
  return nowMs - startsAt > STALE_LIVE_MS
}

/**
 * Ids of stale-live fixtures the cron should finalize + settle: stale-live AND
 * settleable (wc-/pba-). Demo and daily filler are excluded by isStaleLive /
 * isSettleableId respectively.
 */
export function selectStaleLiveToFinalize(
  fixtures: LiveWindowFixture[],
  nowMs: number
): string[] {
  return fixtures
    .filter((fx) => isStaleLive(fx, nowMs) && isSettleableId(fx.id))
    .map((fx) => fx.id)
}
