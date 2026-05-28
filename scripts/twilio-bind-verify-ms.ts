/**
 * Bind the Hrtech Messaging Service to the Verify service for PH country
 * routing. Twilio Verify uses per-country MessagingConfigurations as a
 * sub-resource — NOT a field on the service itself.
 *
 * Run: npx tsx scripts/twilio-bind-verify-ms.ts
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

const COUNTRY = 'PH'

async function main() {
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID!
  const messagingServiceSid = process.env.TWILIO_VERIFY_MESSAGING_SERVICE_SID!

  console.log(`Verify service: ${verifyServiceSid}`)
  console.log(`Messaging Service to bind: ${messagingServiceSid}`)
  console.log(`Country: ${COUNTRY}\n`)

  let result
  try {
    console.log(`Attempting create for country=${COUNTRY}...`)
    result = await client.verify.v2
      .services(verifyServiceSid)
      .messagingConfigurations.create({ country: COUNTRY, messagingServiceSid })
  } catch (createErr: any) {
    console.log(`Create failed (${createErr.code} ${createErr.message}), trying update...`)
    result = await client.verify.v2
      .services(verifyServiceSid)
      .messagingConfigurations(COUNTRY)
      .update({ messagingServiceSid })
  }

  console.log('\nResult:')
  console.log(`  Country: ${result.country}`)
  console.log(`  Messaging Service SID: ${result.messagingServiceSid}`)
  console.log(`  Updated: ${result.dateUpdated?.toISOString()}`)
  console.log('\nDone. Next OTP send to a PH number will route through this Messaging Service.')
}

main().catch((err) => {
  console.error('Failed:', err.message)
  console.error('Code:', err.code)
  process.exit(1)
})
