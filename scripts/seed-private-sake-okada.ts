/**
 * Seed the Sake Manila + Okada private dry-run game into Supabase.
 * Creates the match_fixture (status='scheduled') + 4 player cards.
 * Idempotent via upsert on the fixture and ON CONFLICT for cards.
 *
 * Run: npx tsx scripts/seed-private-sake-okada.ts
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) process.env[m[1]] = m[2]
}

import { SAKE_OKADA_2026_05_22 } from '../lib/private-games/sake-okada-2026-05-22'
import { resolvePlayerCells } from '../lib/private-games/registry'

const game = SAKE_OKADA_2026_05_22

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 1) Upsert the fixture.
  const { error: fxErr } = await admin.from('match_fixtures').upsert(
    {
      id: game.id,
      card_type: 'sports', // treat as sports so existing ops UI works
      match_label: game.title,
      starts_at: game.startsAt,
      ends_at: game.endsAt,
      status: 'scheduled',
    },
    { onConflict: 'id' }
  )
  if (fxErr) {
    console.error('Fixture upsert failed:', fxErr.message)
    process.exit(1)
  }
  console.log(`  ✅ fixture: ${game.id}`)

  // 2) For each player, create or update their card with the resolved
  //    cells + prefilled prediction answers (default 'yes' for every
  //    predictive square on their card).
  for (const player of game.players) {
    const cardId = `priv-sake-okada-${player.slug}`
    const cells = resolvePlayerCells(game, player)

    const predictionAnswers: Record<string, 'yes' | 'no'> = {}
    for (const cell of cells) {
      if (cell.type === 'predictive') {
        predictionAnswers[cell.id] = 'yes'
      }
    }

    // Hash the player slug + game id into a deterministic seed so the
    // board_seed column gets a unique non-null value per card.
    const seed = hashSeed(`${game.id}:${player.slug}`)

    const { error } = await admin.from('cards').upsert(
      {
        id: cardId,
        device_id: null,
        match_id: game.id,
        card_type: 'sports',
        board_seed: seed,
        cells: cells as unknown as object,
        score: 0,
        won: false,
        prediction_answers: predictionAnswers,
      },
      { onConflict: 'id' }
    )
    if (error) {
      console.error(`  ❌ card ${cardId}:`, error.message)
      process.exit(1)
    }
    const predicCount = Object.keys(predictionAnswers).length
    console.log(`  ✅ card: ${cardId} (${cells.length} cells, ${predicCount} predictions prefilled)`)
  }

  console.log(`\nDone. Open:`)
  for (const player of game.players) {
    console.log(`  /private/${game.id}/${player.slug}`)
  }
}

function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

main()
