/**
 * GET /api/cron/ingest-polymarket-signals
 *
 * First catalog signal source. Pulls the highest-volume active events from the
 * Polymarket Gamma API, maps each to a `binary` candidate market, and inserts
 * the new ones into the catalog for human review in /ops/markets.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (same as refresh-prices). Not wired
 * to Vercel Hobby cron (capped at once/day) — trigger manually or on Pro.
 *
 * Dedup: a candidate whose (kind, lower(title)) already exists for
 * source='signal:polymarket' (in ANY status) is skipped — so re-running never
 * duplicates the queue and never re-proposes an already-approved or already-
 * rejected market. Human-set scores are never touched.
 *
 * Response: { ok, inserted, skipped_dedup, skipped_volume, skipped_unparseable }
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { mapPolymarketEventToCandidate } from '../../../../lib/catalog/signal-polymarket'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Order by 24h volume (trending NOW) and require closed=false. Ordering by
// all-time volume + active=true surfaces resolved megamarkets (2024 election,
// last season's UCL/Premier League); the mapper additionally drops any
// closed/past event as belt-and-suspenders.
const GAMMA_EVENTS_URL =
  'https://gamma-api.polymarket.com/events?order=volume24hr&ascending=false&limit=50&closed=false&active=true'
const VOLUME_FLOOR_USD = 50_000

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'cron_secret_unset' }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let events: unknown[]
  try {
    const res = await fetch(GAMMA_EVENTS_URL, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'gamma_error', status: res.status }, { status: 502 })
    }
    const json = await res.json()
    events = Array.isArray(json) ? json : []
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'gamma_fetch_failed', message: e instanceof Error ? e.message : 'unknown' },
      { status: 502 },
    )
  }

  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  let skippedVolume = 0
  let skippedUnparseable = 0
  const candidates: ReturnType<typeof mapPolymarketEventToCandidate>[] = []

  for (const ev of events) {
    const vol = Number((ev as Record<string, unknown>)?.volume)
    if (!Number.isFinite(vol) || vol < VOLUME_FLOOR_USD) {
      skippedVolume++
      continue
    }
    const candidate = mapPolymarketEventToCandidate(ev, now)
    if (!candidate) {
      skippedUnparseable++
      continue
    }
    candidates.push(candidate)
  }

  // Dedup within this batch by (kind, lower(title)).
  const batchSeen = new Set<string>()
  const deduped = candidates.filter((c) => {
    if (!c) return false
    const key = `${c.kind}::${c.title.toLowerCase()}`
    if (batchSeen.has(key)) return false
    batchSeen.add(key)
    return true
  }) as NonNullable<ReturnType<typeof mapPolymarketEventToCandidate>>[]

  const admin = createAdminClient()

  // Skip candidates already present for this source (any status) — keeps the
  // reject-most workflow stable across runs.
  const { data: existing, error: readErr } = await admin
    .from('markets')
    .select('kind, title')
    .eq('source', 'signal:polymarket')
  if (readErr) {
    return NextResponse.json({ ok: false, error: 'db_read_failed', message: readErr.message }, { status: 500 })
  }
  const seen = new Set((existing ?? []).map((r) => `${r.kind}::${String(r.title).toLowerCase()}`))

  const toInsert = deduped.filter((c) => !seen.has(`${c.kind}::${c.title.toLowerCase()}`))
  const skippedDedup = deduped.length - toInsert.length

  if (toInsert.length > 0) {
    const rows = toInsert.map((c) => ({
      kind: c.kind,
      category: c.category,
      title: c.title,
      status: c.status,
      source: c.source,
      interest_score: c.interestScore,
      suggested_by: 'signal:polymarket',
      suggested_at: nowIso,
      payload: c.payload,
    }))
    const { error: insErr } = await admin.from('markets').insert(rows)
    if (insErr) {
      return NextResponse.json({ ok: false, error: 'db_insert_failed', message: insErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    inserted: toInsert.length,
    skipped_dedup: skippedDedup,
    skipped_volume: skippedVolume,
    skipped_unparseable: skippedUnparseable,
  })
}
