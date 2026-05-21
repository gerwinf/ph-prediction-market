/**
 * List Twilio Messaging Services + attached phone numbers.
 * Run: npx tsx scripts/twilio-list-ms.ts
 */
import Twilio from 'twilio'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const env = fs.readFileSync(envPath, 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

const client = Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

async function main() {
  const services = await client.messaging.v1.services.list({ limit: 20 })
  console.log(`Messaging Services (${services.length}):\n`)
  for (const s of services) {
    console.log(`  SID:     ${s.sid}`)
    console.log(`  Name:    ${s.friendlyName}`)
    console.log(`  Created: ${s.dateCreated?.toISOString()}`)
    const numbers = await client.messaging.v1.services(s.sid).phoneNumbers.list()
    console.log(`  Phone numbers (${numbers.length}):`)
    for (const n of numbers) {
      console.log(`    ${n.phoneNumber}  (${n.countryCode})`)
    }
    console.log('')
  }
}

main().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
