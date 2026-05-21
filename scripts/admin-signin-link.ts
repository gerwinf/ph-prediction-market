/**
 * Generate a magic-link URL using the admin API — does NOT send an
 * email. Bypasses Supabase's built-in SMTP rate limit. Open the URL
 * in your browser to sign in.
 *
 * Run: npx tsx scripts/admin-signin-link.ts gerwin.fricke@gmail.com [redirectTo]
 *
 * Defaults redirectTo to http://localhost:3000/ops so you land on the
 * ops console signed in.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

const email = process.argv[2]
const redirectTo = process.argv[3] || 'http://localhost:3000/ops'

if (!email || !email.includes('@')) {
  console.error('Usage: npx tsx scripts/admin-signin-link.ts <email> [redirectTo]')
  process.exit(1)
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })

  if (error) {
    console.error('Failed:', error.message)
    process.exit(1)
  }

  console.log('\nOpen this URL in your browser to sign in:\n')
  console.log(data.properties.action_link)
  console.log('\nThis link is single-use and expires in ~1 hour.')
}

main()
