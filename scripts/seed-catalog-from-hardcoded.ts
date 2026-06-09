/**
 * Seed the `markets` catalog (migration 009) from today's hardcoded data:
 *   - binary markets  ← lib/catalog/seed-data MARKETS  (deduped across tabs)
 *   - event_cell rows ← lib/hits CANDIDATE_EVENTS + DAILY_EVENTS
 *
 * All rows land as status='approved', source='human'. Idempotent: a row whose
 * (kind, lower(title)) already exists for source='human' is skipped, so re-runs
 * never duplicate (the partial unique index only covers candidates).
 *
 * Run: npx tsx scripts/seed-catalog-from-hardcoded.ts
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { MARKETS, type CategoryKey } from '../lib/catalog/seed-data'
import { CANDIDATE_EVENTS } from '../lib/hits/events'
import { DAILY_EVENTS } from '../lib/hits/daily-events'
import { LIVE_MARKETS } from '../lib/oracle/slugs'
import type { BinaryPayload, EventCellPayload } from '../lib/catalog/types'
import type { GameEvent } from '../lib/hits/types'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

type MarketInsert = {
  kind: 'binary' | 'event_cell'
  category: string | null
  title: string
  fixture_id: string | null
  status: 'approved'
  interest_score: number
  source: 'human'
  reviewed_by: 'seed'
  payload: BinaryPayload | EventCellPayload
}

/** '₱6.1M' → 6_100_000. Returns 0 when unparseable. */
function parseVolToPesos(vol: string): number {
  const m = vol.replace(/[₱,\s]/g, '').match(/^([\d.]+)([KMB]?)$/i)
  if (!m) return 0
  const n = parseFloat(m[1])
  const unit = m[2].toUpperCase()
  const mult = unit === 'B' ? 1e9 : unit === 'M' ? 1e6 : unit === 'K' ? 1e3 : 1
  return n * mult
}

/** Volume → 0–100 interest score (log-scaled; ₱176K≈52, ₱6.1M≈68). */
function binaryInterestScore(vol: string): number {
  const pesos = parseVolToPesos(vol)
  if (pesos <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(Math.log10(pesos) * 10)))
}

/** Rarer tiles are more interesting. */
function eventCellInterestScore(rarity: GameEvent['rarity']): number {
  return rarity === 'rare' ? 30 : rarity === 'uncommon' ? 20 : 10
}

/** Dedupe binary rows across tabs by question; collect every tab they appear in. */
function buildBinaryInserts(): MarketInsert[] {
  const byTitle = new Map<
    string,
    { cat: string; q: string; pct: number; d: number; vol: string; slug?: string; categories: string[] }
  >()

  for (const key of Object.keys(MARKETS) as CategoryKey[]) {
    for (const row of MARKETS[key]) {
      const existing = byTitle.get(row.q)
      if (existing) {
        if (!existing.categories.includes(key)) existing.categories.push(key)
      } else {
        byTitle.set(row.q, { ...row, categories: [key] })
      }
    }
  }

  return Array.from(byTitle.values()).map((r) => {
    const payload: BinaryPayload = {
      categories: r.categories,
      cat: r.cat,
      fallback_pct: r.pct,
      vol_label: r.vol,
      delta: r.d,
      ...(r.slug ? { polymarket_slug: r.slug } : {}),
      ...(r.slug && LIVE_MARKETS[r.slug] ? { polymarket_market_id: LIVE_MARKETS[r.slug].id } : {}),
    }
    return {
      kind: 'binary',
      category: r.categories[0],
      title: r.q,
      fixture_id: null,
      status: 'approved',
      interest_score: binaryInterestScore(r.vol),
      source: 'human',
      reviewed_by: 'seed',
      payload,
    }
  })
}

/** One event_cell row per GameEvent (deduped by event_key across both pools). */
function buildEventCellInserts(): MarketInsert[] {
  const byKey = new Map<string, GameEvent>()
  for (const e of [...CANDIDATE_EVENTS, ...DAILY_EVENTS]) {
    if (!byKey.has(e.id)) byKey.set(e.id, e)
  }

  return Array.from(byKey.values()).map((e) => {
    const payload: EventCellPayload = {
      event_key: e.id,
      label: e.label,
      category: e.category,
      rarity: e.rarity,
    }
    return {
      kind: 'event_cell',
      category: e.category,
      title: e.label,
      fixture_id: null,
      status: 'approved',
      interest_score: eventCellInterestScore(e.rarity),
      source: 'human',
      reviewed_by: 'seed',
      payload,
    }
  })
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const all = [...buildBinaryInserts(), ...buildEventCellInserts()]

  // Skip rows already seeded (kind + lower(title)) so re-runs are idempotent.
  const { data: existing, error: readErr } = await admin
    .from('markets')
    .select('kind, title')
    .eq('source', 'human')
  if (readErr) {
    console.error('❌ could not read existing markets:', readErr.message)
    process.exit(1)
  }
  const seen = new Set((existing ?? []).map((r) => `${r.kind}::${String(r.title).toLowerCase()}`))
  const toInsert = all.filter((r) => !seen.has(`${r.kind}::${r.title.toLowerCase()}`))

  const skipped = all.length - toInsert.length
  if (toInsert.length === 0) {
    console.log(`Nothing to insert — all ${all.length} rows already present (skipped ${skipped}).`)
    return
  }

  const { error: insErr } = await admin.from('markets').insert(toInsert)
  if (insErr) {
    console.error('❌ insert failed:', insErr.message)
    process.exit(1)
  }

  const binary = toInsert.filter((r) => r.kind === 'binary').length
  const eventCells = toInsert.filter((r) => r.kind === 'event_cell').length
  console.log(`✅ inserted ${toInsert.length} markets (${binary} binary + ${eventCells} event_cell). Skipped ${skipped}.`)
}

main()
