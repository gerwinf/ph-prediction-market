import { describe, it, expect } from 'vitest'
import { computeMatchSettlement, type SettleCardRow } from './settle'
import { mapFifaTimeline, type FifaTimelineEvent, type MatchContext } from './feed-fifa'
import { generateCard } from './card-generator'
import timeline from './__fixtures__/fifa-timeline-mex-eng.json'

/* Shadow-parity test on the REAL captured Mexico–England R16 timeline,
 * remapped onto the registered NOR–ENG QF pairing: only still-alive squads
 * are curated in players-wc (MEX was eliminated), and an unregistered code
 * would fall back to the basketball pool — no key overlap, meaningless test.
 * The timeline data (goals, cards, corners, saves) is untouched real FIFA. */

const NOR_ENG: MatchContext = {
  homeIdTeam: '43911', // real Mexico id, standing in as the NOR side
  awayIdTeam: '43942', // England
  homeCode: 'NOR',
  awayCode: 'ENG',
}
const eventKeys = mapFifaTimeline(timeline.Event as FifaTimelineEvent[], NOR_ENG).map(
  (m) => m.eventKey
)

// A deterministic 40-card cohort, mixed ₱20/₱50 — same generator as prod.
const MATCH = 'wc-nor-eng-2026-07-11'
const cards: SettleCardRow[] = Array.from({ length: 40 }, (_, i) => {
  const id = `SETL${String(i).padStart(2, '0')}`
  const price = i % 3 === 0 ? 50 : 20
  return { id, price_php: price, cells: generateCard(id, price, 'sports', MATCH).cells }
})

describe('computeMatchSettlement — real-timeline shadow parity', () => {
  const a = computeMatchSettlement(cards, eventKeys, 0)

  it('conserves treasury exactly (Σpay + surplus + fee = vT + drawn)', () => {
    const paid = Object.values(a.payouts).reduce((s, p) => s + p, 0)
    expect(paid + a.surplusCentavos + a.feeCentavos).toBe(a.vtCentavos + a.reserveDrawnCentavos)
  })
  it('produces a sane winner distribution on a real 5-goal match', () => {
    // A busy match lights many consolation cells; most cards carry weight.
    expect(a.winners).toBeGreaterThan(0)
    expect(a.winners).toBeLessThanOrEqual(cards.length)
    expect(a.vtCentavos).toBe(cards.reduce((s, c) => s + c.price_php * 100, 0))
  })
  it('is deterministic (same inputs, same allocation)', () => {
    expect(computeMatchSettlement(cards, eventKeys, 0)).toEqual(a)
  })
  it('a healthy reserve lifts u to 1 (seeded-launch fixed-odds feel)', () => {
    const seeded = computeMatchSettlement(cards, eventKeys, 500_000 * 100) // ₱500k seed
    expect(seeded.u).toBe(1)
    for (const [id, pay] of Object.entries(a.payouts)) {
      expect(seeded.payouts[id]).toBeGreaterThanOrEqual(pay) // never worse than unseeded
    }
  })
  it('cancellation refunds every card its stake', () => {
    const r = computeMatchSettlement(cards, eventKeys, 0, { canceled: true })
    expect(r.refund).toBe(true)
    expect(Object.keys(r.payouts)).toHaveLength(cards.length)
    expect(r.payouts.SETL00).toBe(50 * 100)
    expect(r.feeCentavos).toBe(0)
  })
})
