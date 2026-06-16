/**
 * Verify the market-maker tables exist and are seeded after migration 012.
 *
 *   npx tsx scripts/db-verify-mm.ts
 *
 * Prints market_book row count (one per approved/live binary market — created
 * by the backfill + the markets_seed_book trigger) and a sample row, plus the
 * positions count. Exits non-zero if the tables are missing.
 */
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  const { data: books, error: bErr } = await admin
    .from('market_book')
    .select('market_id, p, margin, polymarket_slug, cap, exposure_yes, exposure_no')
    .limit(5)
  if (bErr) {
    console.error('market_book query failed:', bErr.message)
    process.exit(1)
  }
  const { count: bookCount } = await admin
    .from('market_book')
    .select('*', { count: 'exact', head: true })
  const { count: posCount } = await admin
    .from('positions')
    .select('*', { count: 'exact', head: true })

  console.log(`market_book rows: ${bookCount ?? 0}`)
  console.log(`positions rows:   ${posCount ?? 0}`)
  console.log('sample books:')
  for (const b of books ?? []) {
    console.log(
      `  ${b.market_id}  p=${b.p}  margin=${b.margin}  slug=${b.polymarket_slug ?? '—'}  cap=${b.cap}`,
    )
  }
  if ((bookCount ?? 0) === 0) {
    console.warn('\n⚠  No market_book rows. Seed binary markets first: npx tsx scripts/seed-catalog-from-hardcoded.ts')
  } else {
    console.log('\n✓ market-maker tables present and seeded.')
  }
}

main()
