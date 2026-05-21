/**
 * Validate a PH phone number via Twilio Lookup API.
 * Run: npx tsx scripts/twilio-lookup.ts +639524721336
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
  console.error('Usage: npx tsx scripts/twilio-lookup.ts +639524721336')
  process.exit(1)
}

const client = Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)

async function main() {
  try {
    const lookup = await client.lookups.v2.phoneNumbers(phone).fetch({
      fields: 'line_type_intelligence',
    })
    console.log(`Phone: ${lookup.phoneNumber}`)
    console.log(`Valid: ${lookup.valid}`)
    console.log(`Country: ${lookup.countryCode}`)
    console.log(`National format: ${lookup.nationalFormat}`)
    if (lookup.lineTypeIntelligence) {
      console.log(`Line type: ${lookup.lineTypeIntelligence.type}`)
      console.log(`Carrier: ${lookup.lineTypeIntelligence.carrierName ?? '(unknown)'}`)
      console.log(`Mobile country: ${lookup.lineTypeIntelligence.mobileCountryCode ?? '-'}`)
      console.log(`Mobile network: ${lookup.lineTypeIntelligence.mobileNetworkCode ?? '-'}`)
    }
    if (lookup.validationErrors && lookup.validationErrors.length > 0) {
      console.log(`Validation errors: ${JSON.stringify(lookup.validationErrors)}`)
    }
  } catch (err: any) {
    console.error('Lookup failed:', err.message)
    console.error('Twilio code:', err.code)
  }
}

main()
