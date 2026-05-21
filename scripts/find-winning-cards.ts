/**
 * Brute-force find demo-worthy card_ids for /hits.
 *
 * Generates N random card_ids, runs each through the type's sample timeline,
 * and reports the most interesting ones: fastest wins, diagonals, full cards,
 * and dry no-wins. Output is a markdown table of shareable demo URLs.
 *
 * Run:  npx tsx scripts/find-winning-cards.ts            # sports (default)
 * Or:   npx tsx scripts/find-winning-cards.ts --type=daily
 */

import { generateCard, newCardId } from '../lib/hits/card-generator'
import { detectWins } from '../lib/hits/payouts'
import { CARD_TYPES, resolveCardType, type CardType } from '../lib/hits/card-types'
import type { WinPattern } from '../lib/hits/types'

const N = 2000
const BASE_URL = 'https://hulaan.ph'

// Parse --type=sports|daily from argv. Default sports.
const typeArg = process.argv.find((a) => a.startsWith('--type='))?.split('=')[1]
const CARD_TYPE: CardType = resolveCardType(typeArg)
const SAMPLE = CARD_TYPES[CARD_TYPE].sample

type Result = {
  cardId: string
  firstWinAtMs: number | null
  firstWinClock: string | null
  firstWinPattern: WinPattern | null
  bestPattern: WinPattern | null
  bestMultiplier: number
}

function simulate(cardId: string): Result {
  const card = generateCard(cardId, 20, CARD_TYPE)
  const hits = new Set<number>([12]) // free cell
  let firstWinAtMs: number | null = null
  let firstWinClock: string | null = null
  let firstWinPattern: WinPattern | null = null
  let bestPattern: WinPattern | null = null
  let bestMultiplier = 0

  for (const te of SAMPLE.timeline) {
    // Mark cells matching this event
    card.cells.forEach((cell, idx) => {
      if (cell.id === te.eventId) hits.add(idx)
    })
    const wins = detectWins(hits)
    if (wins.length > 0) {
      const topMult = wins.reduce((m, w) => Math.max(m, w.multiplier), 0)
      const top = wins.find((w) => w.multiplier === topMult)!
      if (firstWinAtMs === null) {
        firstWinAtMs = te.atMs
        firstWinClock = te.gameClock
        firstWinPattern = top
      }
      if (topMult > bestMultiplier) {
        bestMultiplier = topMult
        bestPattern = top
      }
    }
  }

  return { cardId, firstWinAtMs, firstWinClock, firstWinPattern, bestPattern, bestMultiplier }
}

function row(r: Result, bet = 20): string {
  const firstWin = r.firstWinAtMs === null ? '—' : `${r.firstWinClock} (t+${(r.firstWinAtMs / 1000).toFixed(0)}s)`
  const pat = r.firstWinPattern?.label ?? '—'
  const best = r.bestPattern ? `${r.bestPattern.label} (${r.bestMultiplier}×)` : '—'
  const payout = r.bestMultiplier > 0 ? `₱${(bet * r.bestMultiplier).toLocaleString()}` : '₱0'
  const demoUrl = `${BASE_URL}/hits/${r.cardId}?bet=${bet}&type=${CARD_TYPE}&speed=10`
  return `| \`${r.cardId}\` | ${firstWin} | ${pat} | ${best} | ${payout} | ${demoUrl} |`
}

function header() {
  return `| card_id | first win | first pattern | best pattern | payout (₱20) | demo URL |\n|---|---|---|---|---|---|`
}

function main() {
  console.log(`Simulating ${N} random card_ids against ${CARD_TYPE.toUpperCase()} timeline...\n`)
  const results: Result[] = []
  for (let i = 0; i < N; i++) {
    results.push(simulate(newCardId()))
  }

  const wins = results.filter((r) => r.firstWinAtMs !== null)
  const dry = results.filter((r) => r.firstWinAtMs === null)

  const winRate = (wins.length / N) * 100
  const avgFirstWin = wins.reduce((s, r) => s + (r.firstWinAtMs || 0), 0) / wins.length / 1000

  console.log(`Overall stats:`)
  console.log(`  Win rate:               ${winRate.toFixed(1)}% (${wins.length}/${N} cards win something)`)
  console.log(`  Avg first-win time:     ${avgFirstWin.toFixed(1)}s into the 90s match`)
  console.log(`  Diagonal wins:          ${results.filter((r) => r.bestPattern?.kind === 'diag').length}`)
  console.log(`  Full-card wins:         ${results.filter((r) => r.bestPattern?.kind === 'full').length}`)
  console.log(``)

  // FAST_WIN: cards that win earliest
  const fastWins = wins.slice().sort((a, b) => (a.firstWinAtMs || Infinity) - (b.firstWinAtMs || Infinity)).slice(0, 5)
  console.log(`## FAST_WIN (lines that hit earliest — best for short attention span demos)\n`)
  console.log(header())
  for (const r of fastWins) console.log(row(r))
  console.log(``)

  // DIAGONAL_WIN: 10× payout tier
  const diagWins = wins.filter((r) => r.bestPattern?.kind === 'diag').slice().sort((a, b) => (a.firstWinAtMs || 0) - (b.firstWinAtMs || 0)).slice(0, 5)
  console.log(`## DIAGONAL_WIN (10× payout — the "satisfying" tier)\n`)
  if (diagWins.length === 0) {
    console.log(`_None at N=${N}. Diagonals require 4 specific cells to hit; rare with the current event pool._`)
  } else {
    console.log(header())
    for (const r of diagWins) console.log(row(r))
  }
  console.log(``)

  // FULL_CARD: jackpot
  const fullWins = wins.filter((r) => r.bestPattern?.kind === 'full').slice(0, 5)
  console.log(`## FULL_CARD (jackpot — 250× payout)\n`)
  if (fullWins.length === 0) {
    console.log(`_None at N=${N}. Full card requires all 24 non-free cells to hit; needs many more trials._`)
  } else {
    console.log(header())
    for (const r of fullWins) console.log(row(r))
  }
  console.log(``)

  // DRY: zero wins (for testing the no-win state)
  console.log(`## DRY (no win — for testing the "watched 90s, won nothing" UX)\n`)
  console.log(header())
  for (const r of dry.slice(0, 3)) console.log(row(r))
  console.log(``)

  console.log(`Tip: append \`?speed=10\` to any URL to compress playback from 90s to 9s.`)
}

main()
