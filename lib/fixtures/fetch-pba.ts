/**
 * Fetch + parse the PBA schedule from pba.ph.
 *
 * pba.ph/schedule server-renders the next upcoming game (verified: the full
 * schedule view isn't exposed — its filters are unfinished). So a plain server
 * `fetch` is enough; no headless browser is required, which means this runs
 * inside the existing daily Vercel cron.
 *
 * `parsePbaScheduleHtml` is pure (HTML in, rows out) and unit-tested against a
 * captured sample. `fetchPbaSchedule` is the thin network glue around it. If
 * pba.ph ever drops server rendering, the parser returns [] and ingest no-ops —
 * ops keeps adding games by hand either way.
 */
import type { RawScheduleGame } from './types'

const SCHEDULE_URL = 'https://www.pba.ph/schedule'

/** Pull the inner text of the first `<tag ...>text</tag>` in a chunk. */
function firstTagText(chunk: string, tag: string): string | null {
  const m = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null
}

/**
 * Parse pba.ph's `#pba-schedule` markup into raw game rows. Structure (per
 * game): a `.schedule-day` carries the date `<h2>`; each game inside has a
 * `.schedule-time-venue` (two `<p>`: time, venue) and a `.schedule-teams` with
 * two `.schedule-team` whose names sit in `<p class="ms-3">`. Handles multiple
 * games under one date, and tolerates layout cruft via segment-local matching.
 */
export function parsePbaScheduleHtml(html: string): RawScheduleGame[] {
  // Drop HTML comments — the markup ships a commented-out "WEEK N | MONTH"
  // heading that would otherwise be mistaken for the date.
  const clean = html.replace(/<!--[\s\S]*?-->/g, '')

  const games: RawScheduleGame[] = []
  // Split into day chunks; the text before the first `schedule-day` is preamble.
  const dayChunks = clean.split(/class="schedule-day/).slice(1)

  for (const day of dayChunks) {
    const dateText = firstTagText(day, 'h2') ?? ''
    // Each game starts at a `schedule-time-venue`; segment from one to the next.
    const segs = day.split(/class="schedule-time-venue/).slice(1)
    for (const seg of segs) {
      const ps = [...seg.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
        m[1].replace(/<[^>]+>/g, '').trim()
      )
      const timeText = ps[0] ?? ''
      const venue = ps[1] ?? ''
      const teams = [...seg.matchAll(/<p class="ms-3"[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
        m[1].replace(/<[^>]+>/g, '').trim()
      )
      if (dateText && timeText && teams[0] && teams[1]) {
        games.push({ dateText, timeText, venue, teamA: teams[0], teamB: teams[1] })
      }
    }
  }
  return games
}

/** Fetch the live schedule HTML and parse it. Network errors propagate to the caller. */
export async function fetchPbaSchedule(): Promise<RawScheduleGame[]> {
  const res = await fetch(SCHEDULE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HulaBot/1.0; +https://taya.ph)' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`pba_fetch_failed_${res.status}`)
  return parsePbaScheduleHtml(await res.text())
}
