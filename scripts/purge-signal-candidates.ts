/**
 * Deletes ALL signal-sourced markets (source LIKE 'signal:%'), in ANY status.
 * Use to reset the catalog's signal rows after changing the ingestion logic,
 * then re-run the ingest endpoint to regenerate them. Human-sourced (seed) and
 * curator-authored markets are never touched.
 *
 *   npx tsx scripts/purge-signal-candidates.ts
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data, error } = await admin
    .from('markets')
    .delete()
    .like('source', 'signal:%')
    .select('id')

  if (error) {
    console.error('purge failed:', error.message)
    process.exit(1)
  }
  console.log(`purged ${data?.length ?? 0} signal market(s)`)
}

main()
