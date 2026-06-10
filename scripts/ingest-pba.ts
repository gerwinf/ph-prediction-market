/**
 * Pull the next PBA game from pba.ph into match_fixtures, on demand.
 *
 * Same logic the daily maintain-catalog cron runs (fetch → map → status-safe
 * upsert) — this just lets ops trigger it manually, e.g. right after a new game
 * is announced. Idempotent: re-running won't duplicate or clobber ops state.
 *
 * Run: npx tsx scripts/ingest-pba.ts
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { fetchPbaSchedule } from '../lib/fixtures/fetch-pba'
import { ingestPbaFixtures } from '../lib/fixtures/maintain'

// Load .env.local if present; otherwise rely on the ambient environment
// (e.g. when run in CI with the secrets already exported).
if (fs.existsSync('.env.local')) {
  const env = fs.readFileSync('.env.local', 'utf-8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/)
    if (m) process.env[m[1]] = m[2]
  }
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const games = await fetchPbaSchedule()
  console.log(`Fetched ${games.length} game(s) from pba.ph:`)
  for (const g of games) console.log(`  · ${g.dateText} ${g.timeText} — ${g.teamA} vs ${g.teamB} @ ${g.venue}`)

  const result = await ingestPbaFixtures(admin as never, games, Date.now())
  console.log(`Ingest: +${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped (ops-owned)`)
}

main().catch((e) => {
  console.error('ingest-pba failed:', e)
  process.exit(1)
})
