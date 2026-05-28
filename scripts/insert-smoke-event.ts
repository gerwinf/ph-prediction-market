import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('/Users/gerwf/conductor/workspaces/ph-prediction-market/athens/.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data, error } = await admin
    .from('events')
    .insert({ match_id: 'wc-opening-2026', event_key: 'brownlee-25', payload: { source: 'smoke-test' } })
    .select()
    .single()
  if (error) console.log('ERR:', error.message)
  else console.log('INSERTED event id=' + data.id)
}
main()
