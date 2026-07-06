/**
 * Seed (or repair) a World Cup match_fixtures row straight from the FIFA
 * calendar, so /hits surfaces it as a real game and the feed auto-fires.
 *
 * Usage:  npx tsx scripts/seed-wc-fixture-from-fifa.ts wc-por-esp-2026-07-06
 *
 * The id encodes <home>-<away>-<date> and MUST match a real FIFA calendar
 * entry (either team orientation) — the same resolution rule the live feed
 * uses (lib/hits/feed-fifa.ts). Kickoff, team names and stadium are taken
 * from FIFA, so a hand-typo'd starts_at can't silently hide the game from
 * the /hits upcoming window again.
 *
 * Once the row exists with status 'scheduled', everything is automatic:
 *   - /hits shows it as NEXT GAME (reserve / pre-buy)
 *   - any open card polls /api/events, which lazily syncs the FIFA timeline
 *   - at kickoff the sync flips status scheduled → live, cells light from
 *     real events, the scoreboard gets the real score, and full time flips
 *     it to final. No /ops hand-firing needed.
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Load .env.local (vercel-pull / hand-edited format: KEY="value" or KEY=value)
const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
}

const FIFA_BASE = 'https://api.fifa.com/api/v3'
const ID_COMPETITION = '17'
const ID_SEASON = '285023'
const UA = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }

type CalendarMatch = {
  IdMatch?: string
  Date?: string
  Home?: { IdCountry?: string; TeamName?: Array<{ Description?: string }> } | null
  Away?: { IdCountry?: string; TeamName?: Array<{ Description?: string }> } | null
  Stadium?: { Name?: Array<{ Description?: string }> } | null
  StageName?: Array<{ Description?: string }>
}

async function main() {
  const matchId = process.argv[2]
  const parsed = matchId?.match(/^wc-([a-z]{3})-([a-z]{3})-(\d{4}-\d{2}-\d{2})$/i)
  if (!parsed) {
    console.error('Usage: npx tsx scripts/seed-wc-fixture-from-fifa.ts wc-<home>-<away>-<yyyy-mm-dd>')
    process.exit(1)
  }
  const [, a, b, date] = parsed
  const [codeA, codeB] = [a.toUpperCase(), b.toUpperCase()]

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const res = await fetch(
    `${FIFA_BASE}/calendar/matches?idCompetition=${ID_COMPETITION}&idSeason=${ID_SEASON}&count=200&language=en`,
    { headers: UA }
  )
  if (!res.ok) {
    console.error(`❌ FIFA calendar ${res.status}`)
    process.exit(1)
  }
  const j = (await res.json()) as { Results?: CalendarMatch[] }

  const hit = (j.Results ?? []).find((m) => {
    const h = m.Home?.IdCountry
    const w = m.Away?.IdCountry
    if (!h || !w || !(m.Date ?? '').startsWith(date)) return false
    return (h === codeA && w === codeB) || (h === codeB && w === codeA)
  })
  if (!hit) {
    console.error(`❌ No FIFA calendar match for ${codeA} vs ${codeB} on ${date}.`)
    console.error('   Check the codes/date against the calendar — the feed resolves by exactly this rule.')
    process.exit(1)
  }

  const homeName = hit.Home?.TeamName?.[0]?.Description ?? codeA
  const awayName = hit.Away?.TeamName?.[0]?.Description ?? codeB
  const stage = hit.StageName?.[0]?.Description
  const venue = hit.Stadium?.Name?.[0]?.Description ?? null
  const fixture = {
    id: matchId.toLowerCase(),
    card_type: 'sports' as const,
    match_label: `${homeName} vs ${awayName} — World Cup 2026${stage ? ` · ${stage}` : ''}`,
    starts_at: hit.Date, // FIFA kickoff, UTC — the /hits upcoming window keys off this
    source: 'manual:wc',
    venue,
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: existing } = await admin
    .from('match_fixtures')
    .select('id, status, starts_at')
    .eq('id', fixture.id)
    .maybeSingle()

  if (existing?.status === 'live') {
    // Game is running — fix metadata only, never yank a live fixture back.
    const { error } = await admin
      .from('match_fixtures')
      .update({ match_label: fixture.match_label, starts_at: fixture.starts_at, venue })
      .eq('id', fixture.id)
    if (error) { console.error(`❌ ${error.message}`); process.exit(1) }
    console.log(`✅ ${fixture.id} is LIVE — refreshed label/kickoff/venue only`)
  } else {
    const { error } = await admin
      .from('match_fixtures')
      .upsert({ ...fixture, status: 'scheduled' as const }, { onConflict: 'id' })
    if (error) { console.error(`❌ ${error.message}`); process.exit(1) }
    console.log(
      existing
        ? `✅ repaired ${fixture.id} (was status=${existing.status}, starts_at=${existing.starts_at})`
        : `✅ seeded ${fixture.id}`
    )
  }
  console.log(`   ${fixture.match_label}`)
  console.log(`   kickoff ${fixture.starts_at}${venue ? ` · ${venue}` : ''}`)
  console.log('\nNext: open /hits — the game shows under NEXT GAME. From kickoff, any open card')
  console.log('auto-syncs the FIFA timeline (status → live, cells light, real score on the board).')
}

main()
