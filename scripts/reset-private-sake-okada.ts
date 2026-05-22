/**
 * Reset the Sake/Okada private game back to a fresh "game hasn't
 * started" state. Safe to re-run as many times as needed.
 *
 * Actions:
 *   1. Delete all rows in public.events where match_id = the game id
 *   2. Reset each player's prediction_answers back to default 'yes'
 *      for every predictive square on their card
 *
 * Cards row itself (cells, won, score, claimed_at) is untouched —
 * if you've completed a row in testing, run with --hard to also
 * reset won/score/claimed_at/win_pattern.
 *
 * Run: npx tsx scripts/reset-private-sake-okada.ts [--hard]
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

import { SAKE_OKADA_2026_05_22 } from '../lib/private-games/sake-okada-2026-05-22'

const HARD = process.argv.includes('--hard')

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 1) Delete all events for this match.
  const { count: deletedCount, error: delErr } = await admin
    .from('events')
    .delete({ count: 'exact' })
    .eq('match_id', SAKE_OKADA_2026_05_22.id)
  if (delErr) {
    console.error('Failed to delete events:', delErr.message)
    process.exit(1)
  }
  console.log(`  ✅ deleted ${deletedCount ?? 0} event row(s)`)

  // 2) Reset each player's prediction_answers to default 'yes'.
  for (const player of SAKE_OKADA_2026_05_22.players) {
    const cardId = `priv-sake-okada-${player.slug}`
    const defaults: Record<string, 'yes'> = {}
    for (const id of player.cardSquareIds) {
      const sq = SAKE_OKADA_2026_05_22.squarePool.find((s) => s.id === id)
      if (sq?.type === 'predictive') defaults[id] = 'yes'
    }

    const update: Record<string, unknown> = { prediction_answers: defaults }
    if (HARD) {
      update.won = false
      update.score = 0
      update.win_pattern = null
      update.claimed_at = null
    }

    const { error } = await admin.from('cards').update(update).eq('id', cardId)
    if (error) {
      console.error(`  ❌ ${cardId}:`, error.message)
      continue
    }
    console.log(`  ✅ ${cardId}: predictions reset (${Object.keys(defaults).length} squares → 'yes')${HARD ? ', score cleared' : ''}`)
  }

  console.log('\nReady to test. Pre-game state restored.')
}

main()
