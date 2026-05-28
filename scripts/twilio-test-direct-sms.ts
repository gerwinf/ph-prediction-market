/**
 * Send a test SMS via Twilio Messages API using a specific Messaging
 * Service (Hrtech, US long code +12678022297). Bypasses Verify entirely.
 *
 * If this lands on a Globe handset, we know the sender override works
 * and we can rebuild OTP on top of Messages instead of Verify.
 *
 * Run: npx tsx scripts/twilio-test-direct-sms.ts +639524721336
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

const phone = process.argv[2]
if (!phone) {
  console.error('Usage: npx tsx scripts/twilio-test-direct-sms.ts +639524721336')
  process.exit(1)
}

const client = Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
const messagingServiceSid = process.env.TWILIO_VERIFY_MESSAGING_SERVICE_SID!

async function main() {
  console.log(`Sending test SMS to ${phone} via Messaging Service ${messagingServiceSid}...`)

  const msg = await client.messages.create({
    to: phone,
    messagingServiceSid,
    body: 'Hula test — your verification code is 123456. Reply STOP to opt out.',
  })

  console.log(`\nSent. Message SID: ${msg.sid}`)
  console.log(`Initial status: ${msg.status}`)
  console.log(`From: ${msg.from ?? '(messaging service)'}`)

  console.log('\nPolling for final status (10s)...')
  await new Promise((r) => setTimeout(r, 10000))

  const updated = await client.messages(msg.sid).fetch()
  console.log(`\nFinal status: ${updated.status}`)
  console.log(`Error code: ${updated.errorCode ?? '(none)'}`)
  console.log(`Error message: ${updated.errorMessage ?? '(none)'}`)
  console.log(`From: ${updated.from}`)
  console.log(`Price: ${updated.price} ${updated.priceUnit}`)
}

main().catch((err) => {
  console.error('Failed:', err.message)
  console.error('Code:', err.code)
  process.exit(1)
})
