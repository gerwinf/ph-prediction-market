/**
 * Seed one upcoming World Cup 2026 fixture + its linked Polymarket-backed
 * binary market, so we can exercise the full add → live-price → resolve
 * lifecycle on a real WC game ("option C + live poly").
 *
 * - match_fixtures row: the game itself (status 'scheduled'). This is what
 *   /hits + /api/fixtures surface as an upcoming game and what /ops can flip
 *   to 'final' to trigger settlement.
 * - markets row (kind 'binary'): a Polymarket-backed question. Polymarket has
 *   NO per-match WC markets — only tournament futures — so we pin the real,
 *   liquid "Argentina to win the World Cup" market (Gamma id 558938, slug
 *   `wc-argentina` in LIVE_MARKETS). Price resolves by id, never by search.
 *
 * Run: npx tsx scripts/seed-wc-fixture.ts
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Load .env.local (vercel-pull / hand-edited format: KEY="value" or KEY=value)
const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
}

const SLUG = 'wc-argentina' // pinned in lib/oracle/slugs.ts LIVE_MARKETS (id 558938)
const FIXTURE_ID = 'wc-arg-alg-2026-06-16'

// Argentina vs Algeria — World Cup 2026 Group J, Arrowhead Stadium, Kansas City.
// Jun 16 local (Jun 17 PHT). Genuinely upcoming as of today (2026-06-12).
const FIXTURE = {
  id: FIXTURE_ID,
  card_type: 'sports' as const,
  match_label: 'Argentina vs Algeria — World Cup 2026 · Group J',
  starts_at: '2026-06-16T20:00:00+00:00',
  status: 'scheduled' as const,
  source: 'manual:wc',
  venue: 'Arrowhead Stadium, Kansas City',
}

const MARKET = {
  kind: 'binary' as const,
  category: 'World Cup',
  title: 'Argentina to win the 2026 World Cup?',
  fixture_id: FIXTURE_ID,
  status: 'live' as const,
  interest_score: 85,
  source: 'manual:wc',
  payload: {
    categories: ['trending', 'sports'],
    cat: 'World Cup',
    fallback_pct: 9,
    vol_label: 'WC · Winner',
    polymarket_slug: SLUG,
    polymarket_market_id: '558938',
  },
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: fErr } = await admin
    .from('match_fixtures')
    .upsert(FIXTURE, { onConflict: 'id' })
  if (fErr) {
    console.error(`❌ fixture: ${fErr.message}`)
    process.exit(1)
  }
  console.log(`✅ fixture  ${FIXTURE.id}  (${FIXTURE.match_label})`)

  // Markets has no natural unique key for upsert here; insert only if absent.
  const { data: existing } = await admin
    .from('markets')
    .select('id')
    .eq('fixture_id', FIXTURE_ID)
    .eq('kind', 'binary')
    .maybeSingle()

  if (existing) {
    console.log(`✓ market already exists for ${FIXTURE_ID} (id=${existing.id}) — skipping insert`)
  } else {
    const { data, error: mErr } = await admin
      .from('markets')
      .insert(MARKET)
      .select('id')
      .single()
    if (mErr) {
      console.error(`❌ market: ${mErr.message}`)
      process.exit(1)
    }
    console.log(`✅ market   ${data.id}  (${MARKET.title}, slug=${SLUG})`)
  }

  console.log('\nNext: tick price → curl "https://www.hulaan.ph/api/prices?events=' + SLUG + '"')
  console.log('Then resolve → POST /api/ops/fixture-status { fixtureId, status:"final" }')
}

main()
