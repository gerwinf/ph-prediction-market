/**
 * Verify that all Phase 0 tables exist with the expected columns.
 * Run AFTER pasting the bundled SQL into Supabase Dashboard:
 *
 *   npx tsx scripts/db-verify.ts
 *
 * Exits non-zero if any expected table or column is missing.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const env = fs.readFileSync(envPath, 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const expected: Record<string, string[]> = {
  profiles: ['id', 'email', 'phone_e164', 'phone_verified', 'display_name', 'locale', 'virtual_balance', 'created_at'],
  match_fixtures: ['id', 'card_type', 'match_label', 'starts_at', 'ends_at', 'status', 'created_at'],
  cards: ['id', 'user_id', 'device_id', 'match_id', 'card_type', 'board_seed', 'cells', 'score', 'won', 'win_pattern', 'claimed_at', 'created_at'],
  events: ['id', 'match_id', 'event_key', 'payload', 'resolved_at'],
  shares: ['id', 'source_card_id', 'sharer_user_id', 'channel', 'created_at', 'opened_at', 'attributed_card_id'],
  analytics_events: ['id', 'event_type', 'user_id', 'device_id', 'card_id', 'payload', 'created_at'],
}

let failures = 0

async function checkTable(table: string, cols: string[]) {
  // Trick: select all expected columns with limit 0. If any column is
  // missing, PostgREST returns 400 with a specific error.
  const { error } = await admin.from(table).select(cols.join(',')).limit(0)
  if (error) {
    console.error(`  ❌ ${table}: ${error.message}`)
    failures++
    return
  }
  console.log(`  ✅ ${table}  (${cols.length} cols)`)
}

async function main() {
  console.log(`Verifying schema in ${url}\n`)

  for (const [table, cols] of Object.entries(expected)) {
    await checkTable(table, cols)
  }

  console.log('\nChecking seed data:')
  const { count, error } = await admin
    .from('match_fixtures')
    .select('*', { count: 'exact', head: true })
  if (error) {
    console.error(`  ❌ match_fixtures count: ${error.message}`)
    failures++
  } else {
    console.log(`  ✅ match_fixtures has ${count ?? 0} rows`)
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`)
    process.exit(1)
  }
  console.log('\nAll checks passed.')
}

main().catch((err) => {
  console.error('Verifier crashed:', err)
  process.exit(1)
})
