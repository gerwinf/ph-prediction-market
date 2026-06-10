import { describe, test, expect } from 'vitest'
import { planFixtureIngest } from './maintain'
import type { FixtureCandidate } from './types'

function candidate(id: string): FixtureCandidate {
  return {
    id,
    card_type: 'sports',
    match_label: 'A vs B',
    starts_at: '2026-06-12T11:30:00.000Z',
    status: 'scheduled',
    source: 'feed:pba',
    venue: 'Arena',
  }
}

describe('planFixtureIngest', () => {
  test('inserts brand-new fixtures', () => {
    const plan = planFixtureIngest([candidate('pba-gin-tnt-2026-06-12')], [])
    expect(plan.toInsert).toHaveLength(1)
    expect(plan.toUpdate).toHaveLength(0)
    expect(plan.skipped).toHaveLength(0)
  })

  test('updates an existing still-scheduled fixture', () => {
    const plan = planFixtureIngest(
      [candidate('pba-gin-tnt-2026-06-12')],
      [{ id: 'pba-gin-tnt-2026-06-12', status: 'scheduled' }]
    )
    expect(plan.toUpdate).toHaveLength(1)
    expect(plan.toInsert).toHaveLength(0)
  })

  test('never clobbers a row ops has taken over (live/final/canceled)', () => {
    for (const status of ['live', 'final', 'canceled']) {
      const plan = planFixtureIngest(
        [candidate('pba-gin-tnt-2026-06-12')],
        [{ id: 'pba-gin-tnt-2026-06-12', status }]
      )
      expect(plan.skipped, status).toHaveLength(1)
      expect(plan.toUpdate, status).toHaveLength(0)
      expect(plan.toInsert, status).toHaveLength(0)
    }
  })

  test('partitions a mixed batch correctly', () => {
    const plan = planFixtureIngest(
      [candidate('new'), candidate('sched'), candidate('live')],
      [
        { id: 'sched', status: 'scheduled' },
        { id: 'live', status: 'live' },
      ]
    )
    expect(plan.toInsert.map((c) => c.id)).toEqual(['new'])
    expect(plan.toUpdate.map((c) => c.id)).toEqual(['sched'])
    expect(plan.skipped.map((c) => c.id)).toEqual(['live'])
  })
})
