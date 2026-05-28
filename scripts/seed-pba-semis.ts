/**
 * Seed match_fixtures with the May 24 PBA semis games so /ops can
 * write events against real match_ids.
 *
 * Run: npx tsx scripts/seed-pba-semis.ts
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

const FIXTURES = [
  {
    id: 'pba-gin-ros-2026-05-24',
    card_type: 'sports' as const,
    match_label: 'Ginebra vs Rain or Shine — Comm’s Cup Semis',
    starts_at: '2026-05-24 11:00:00+00', // 7 PM PHT = 11 AM UTC
    status: 'scheduled' as const,
  },
  {
    id: 'pba-tnt-mer-2026-05-24',
    card_type: 'sports' as const,
    match_label: 'TNT vs Meralco — Comm’s Cup Semis',
    starts_at: '2026-05-24 09:00:00+00', // 5 PM PHT = 9 AM UTC (typical opener)
    status: 'scheduled' as const,
  },
]

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  for (const f of FIXTURES) {
    const { error } = await admin.from('match_fixtures').upsert(f, { onConflict: 'id' })
    if (error) console.log(`  ❌ ${f.id}: ${error.message}`)
    else console.log(`  ✅ ${f.id}  (${f.match_label})`)
  }
}

main()
