/**
 * Catalog maintenance — the work behind the daily /api/cron/maintain-catalog job.
 *
 * Three operations, each safe to run on its own:
 *  - ingestSignals:        pull trending Polymarket events → new candidate rows
 *  - refreshApprovedPrices: re-fetch live odds for approved markets → fresh fallback_pct
 *  - retireEndedMarkets:    retire approved/live markets past their closes_at
 *
 * All take the service-role admin client. Glue code (DB + network); the pure
 * mapping/scoring lives in signal-polymarket.ts (unit-tested there).
 */
import { createAdminClient } from '../supabase/admin'
import { fetchPolymarketById } from '../oracle/polymarket'
import { mapPolymarketEventToCandidate } from './signal-polymarket'
import type { BinaryPayload } from './types'

type Admin = ReturnType<typeof createAdminClient>

// Trending now (24h volume), unresolved only. See ingest route notes.
const GAMMA_EVENTS_URL =
  'https://gamma-api.polymarket.com/events?order=volume24hr&ascending=false&limit=50&closed=false&active=true'
const VOLUME_FLOOR_USD = 50_000

export type IngestResult = {
  inserted: number
  skipped_dedup: number
  skipped_volume: number
  skipped_unparseable: number
}

/** Pull trending Polymarket events and insert the new ones as candidates. */
export async function ingestSignals(admin: Admin, nowMs: number): Promise<IngestResult> {
  const res = await fetch(GAMMA_EVENTS_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`gamma_error_${res.status}`)
  const json = await res.json()
  const events: unknown[] = Array.isArray(json) ? json : []

  const nowIso = new Date(nowMs).toISOString()
  let skipped_volume = 0
  let skipped_unparseable = 0
  const candidates = []

  for (const ev of events) {
    const vol = Number((ev as Record<string, unknown>)?.volume)
    if (!Number.isFinite(vol) || vol < VOLUME_FLOOR_USD) {
      skipped_volume++
      continue
    }
    const c = mapPolymarketEventToCandidate(ev, nowMs)
    if (!c) {
      skipped_unparseable++
      continue
    }
    candidates.push(c)
  }

  // Dedup within this batch by (kind, lower(title)).
  const batchSeen = new Set<string>()
  const deduped = candidates.filter((c) => {
    const key = `${c.kind}::${c.title.toLowerCase()}`
    if (batchSeen.has(key)) return false
    batchSeen.add(key)
    return true
  })

  // Skip candidates already present for this source in ANY status — keeps the
  // reject-most workflow stable and never re-proposes approved/rejected rows.
  const { data: existing, error: readErr } = await admin
    .from('markets')
    .select('kind, title')
    .eq('source', 'signal:polymarket')
  if (readErr) throw new Error(`db_read_failed: ${readErr.message}`)
  const seen = new Set((existing ?? []).map((r) => `${r.kind}::${String(r.title).toLowerCase()}`))

  const toInsert = deduped.filter((c) => !seen.has(`${c.kind}::${c.title.toLowerCase()}`))

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
      closes_at: c.closesAt,
      payload: c.payload,
    }))
    const { error: insErr } = await admin.from('markets').insert(rows)
    if (insErr) throw new Error(`db_insert_failed: ${insErr.message}`)
  }

  return {
    inserted: toInsert.length,
    skipped_dedup: deduped.length - toInsert.length,
    skipped_volume,
    skipped_unparseable,
  }
}

/**
 * Re-fetch current odds for every approved/live binary market that has a pinned
 * Polymarket market id, and update its stored fallback_pct. The landing grid
 * reads fallback_pct from the catalog, so this is what keeps approved (non-pinned)
 * markets current day-to-day.
 */
export async function refreshApprovedPrices(admin: Admin): Promise<{ refreshed: number }> {
  const { data, error } = await admin
    .from('markets')
    .select('id, payload')
    .eq('kind', 'binary')
    .in('status', ['approved', 'live'])
  if (error) throw new Error(`db_read_failed: ${error.message}`)

  const targets = (data ?? [])
    .map((r) => ({ id: r.id as string, payload: r.payload as BinaryPayload }))
    .filter((r) => typeof r.payload?.polymarket_market_id === 'string')
  if (targets.length === 0) return { refreshed: 0 }

  const prices = await fetchPolymarketById(
    targets.map((t) => ({ slug: t.id, marketId: t.payload.polymarket_market_id as string })),
  )
  const byId = new Map(prices.map((p) => [p.query, p]))

  let refreshed = 0
  for (const t of targets) {
    const p = byId.get(t.id)
    const yes = p?.outcomes[0]?.price
    if (typeof yes !== 'number') continue
    const next: BinaryPayload = { ...t.payload, fallback_pct: Math.round(yes * 100) }
    const { error: upErr } = await admin.from('markets').update({ payload: next }).eq('id', t.id)
    if (!upErr) refreshed++
  }
  return { refreshed }
}

/** Retire approved/live markets whose resolution deadline has passed. */
export async function retireEndedMarkets(admin: Admin, nowMs: number): Promise<{ retired: number }> {
  const { data, error } = await admin
    .from('markets')
    .update({ status: 'retired' })
    .in('status', ['approved', 'live'])
    .not('closes_at', 'is', null)
    .lt('closes_at', new Date(nowMs).toISOString())
    .select('id')
  if (error) throw new Error(`db_update_failed: ${error.message}`)
  return { retired: data?.length ?? 0 }
}
