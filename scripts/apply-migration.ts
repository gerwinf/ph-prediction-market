/**
 * Apply a single migration SQL file using the Supabase admin client.
 * Wraps the SQL in an exec via postgres-meta REST endpoint. Idempotent
 * SQL files should be safe to re-run.
 *
 * Run: npx tsx scripts/apply-migration.ts 003_prediction_answers
 */
import fs from 'fs'
import path from 'path'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

const name = process.argv[2]
if (!name) {
  console.error('Usage: npx tsx scripts/apply-migration.ts <migration-name>')
  process.exit(1)
}

const file = path.resolve(`supabase/migrations/${name}.sql`)
if (!fs.existsSync(file)) {
  console.error(`Migration file not found: ${file}`)
  process.exit(1)
}

const sql = fs.readFileSync(file, 'utf-8')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
  // postgres-meta endpoint isn't exposed on hosted Supabase; use the
  // raw SQL endpoint that ships with the Studio UI: it lives behind
  // /pg/query when a service role key is presented.
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`Failed (${res.status}):`, body)
    console.error('\nFallback: paste this SQL into Supabase Dashboard → SQL Editor:\n')
    console.error(sql)
    process.exit(1)
  }
  console.log(`Applied ${name}.sql successfully.`)
}

main()
