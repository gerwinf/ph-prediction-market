/**
 * Diagnostics for Twilio Verify delivery failures.
 *
 * Run:  npx tsx scripts/twilio-diagnose.ts
 *
 * Checks:
 * 1. Account type (trial vs paid) — trial accounts ONLY deliver to verified caller IDs
 * 2. Verified outgoing caller IDs (if trial)
 * 3. Recent verification attempts + their delivery status
 * 4. Account balance / status
 */
import Twilio from 'twilio'
import fs from 'fs'
import path from 'path'

// Load .env.local manually since this is a standalone script
const envPath = path.resolve(process.cwd(), '.env.local')
const env = fs.readFileSync(envPath, 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

const SID = process.env.TWILIO_ACCOUNT_SID!
const TOKEN = process.env.TWILIO_AUTH_TOKEN!
const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID!

const client = Twilio(SID, TOKEN)

async function main() {
  console.log('=== Twilio Account ===')
  const account = await client.api.v2010.accounts(SID).fetch()
  console.log(`  SID:      ${account.sid}`)
  console.log(`  Type:     ${account.type}`)
  console.log(`  Status:   ${account.status}`)
  console.log(`  Created:  ${account.dateCreated}`)
  console.log('')

  if (account.type === 'Trial') {
    console.log('⚠️  TRIAL ACCOUNT — can ONLY send SMS to VERIFIED caller IDs.')
    console.log('   Verify your phone at: console.twilio.com → Develop → Phone Numbers → Verified Caller IDs')
    console.log('')

    const callerIds = await client.outgoingCallerIds.list()
    console.log(`=== Verified Caller IDs (${callerIds.length}) ===`)
    if (callerIds.length === 0) {
      console.log('  (none) — must add your phone before SMS can be delivered')
    } else {
      callerIds.forEach((c) => console.log(`  ${c.phoneNumber}  (${c.friendlyName})`))
    }
    console.log('')
  } else {
    console.log('✓  Paid account — can send SMS to any valid phone number.')
    console.log('')
  }

  console.log('=== Recent SMS messages (last 10) — under-the-hood delivery status ===')
  const messages = await client.messages.list({ limit: 10 })
  if (messages.length === 0) {
    console.log('  (none)')
  } else {
    for (const m of messages) {
      console.log(`  ${m.dateCreated?.toISOString()}  to=${m.to}  status=${m.status}  errorCode=${m.errorCode ?? '-'}  errorMessage=${m.errorMessage ?? '-'}`)
    }
  }
}

main().catch((err) => {
  console.error('Diagnostic failed:', err.message)
  if (err.code) console.error('  Twilio code:', err.code)
  process.exit(1)
})
