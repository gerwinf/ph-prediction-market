/**
 * Seed the `markets` catalog (migrations 009 + 012) with the World Cup section
 * from today's hardcoded data:
 *   - wc_fixture   rows ← lib/worldcup FIXTURES
 *   - wc_contender rows ← lib/worldcup CONTENDERS
 *
 * All rows land as status='approved', source='human', reviewed_by='seed'.
 * Idempotent: a row whose (kind, lower(title)) already exists for source='human'
 * is skipped, so re-runs never duplicate.
 *
 * Run: npx tsx scripts/seed-worldcup-catalog.ts
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { FIXTURES, CONTENDERS } from '../lib/worldcup/fixtures'
import type { WcFixturePayload, WcContenderPayload } from '../lib/catalog/types'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

type WcMarketInsert = {
  kind: 'wc_fixture' | 'wc_contender'
  category: string | null
  title: string
  fixture_id: null
  status: 'approved'
  interest_score: number
  source: 'human'
  reviewed_by: 'seed'
  payload: WcFixturePayload | WcContenderPayload
}

/** One wc_fixture insert per hardcoded FIXTURE. */
function buildFixtureInserts(): WcMarketInsert[] {
  return FIXTURES.map((f) => {
    const payload: WcFixturePayload = {
      home: { name: f.home.name, iso: f.home.iso },
      away: { name: f.away.name, iso: f.away.iso },
      group: f.group,
      kickoff_iso: f.kickoffISO,
      fallback: f.fallback,
      ...(f.venue ? { venue: f.venue } : {}),
      ...(f.slug ? { slug: f.slug } : {}),
    }
    return {
      kind: 'wc_fixture',
      category: 'worldcup',
      title: `${f.home.name} vs ${f.away.name}`,
      fixture_id: null,
      status: 'approved',
      interest_score: 0, // fixtures render by kickoff, not interest
      source: 'human',
      reviewed_by: 'seed',
      payload,
    }
  })
}

/** One wc_contender insert per hardcoded CONTENDER (interest = fallback pct). */
function buildContenderInserts(): WcMarketInsert[] {
  return CONTENDERS.map((c) => {
    const payload: WcContenderPayload = {
      name: c.name,
      iso: c.iso,
      fallback_pct: c.fallbackPct,
      vol: c.vol,
      delta: c.delta,
      ...(c.slug ? { slug: c.slug } : {}),
    }
    return {
      kind: 'wc_contender',
      category: 'worldcup',
      title: c.name,
      fixture_id: null,
      status: 'approved',
      interest_score: c.fallbackPct,
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

  const all = [...buildFixtureInserts(), ...buildContenderInserts()]

  // Skip rows already seeded (kind + lower(title)) so re-runs are idempotent.
  const { data: existing, error: readErr } = await admin
    .from('markets')
    .select('kind, title')
    .eq('source', 'human')
    .in('kind', ['wc_fixture', 'wc_contender'])
  if (readErr) {
    console.error('❌ could not read existing markets:', readErr.message)
    process.exit(1)
  }
  const seen = new Set((existing ?? []).map((r) => `${r.kind}::${String(r.title).toLowerCase()}`))
  const toInsert = all.filter((r) => !seen.has(`${r.kind}::${r.title.toLowerCase()}`))

  const skipped = all.length - toInsert.length
  if (toInsert.length === 0) {
    console.log(`Nothing to insert — all ${all.length} WC rows already present (skipped ${skipped}).`)
    return
  }

  const { error: insErr } = await admin.from('markets').insert(toInsert)
  if (insErr) {
    console.error('❌ insert failed:', insErr.message)
    process.exit(1)
  }

  const fixtures = toInsert.filter((r) => r.kind === 'wc_fixture').length
  const contenders = toInsert.filter((r) => r.kind === 'wc_contender').length
  console.log(`✅ inserted ${toInsert.length} WC rows (${fixtures} fixtures + ${contenders} contenders). Skipped ${skipped}.`)
}

main()
