/**
 * Refresh the /worldcup board's fixtures from the OFFICIAL FIFA data API.
 *
 * Thin wrapper around lib/worldcup/fixture-refresh — the SAME code the daily
 * `maintain-catalog` cron runs, so a manual run and the nightly job behave
 * identically. INSERT-ONLY + PRUNE-PAST (option B): new fixtures roll in, past
 * feed rows roll off, and any per-row odds an operator tuned in /ops/markets
 * are preserved (existing rows are never overwritten). See the lib file header
 * for the full contract and its one tradeoff.
 *
 * Manual, idempotent — run it whenever you want the board to roll forward now:
 *   npx tsx scripts/refresh-worldcup-fixtures.ts            # next ~8 days
 *   npx tsx scripts/refresh-worldcup-fixtures.ts 14         # next 14 days
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from 'fs'
import { refreshWcFixtures } from '../lib/worldcup/fixture-refresh'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

async function main() {
  const forwardDays = Number(process.argv[2]) || undefined
  const { candidates, inserted, pruned } = await refreshWcFixtures(forwardDays)
  console.log(
    `✅ /worldcup refresh: ${inserted} inserted, ${pruned} pruned ` +
      `(${candidates} feed fixtures in window).`
  )
}

main()
