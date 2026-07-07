import { describe, it, expect } from 'vitest'
import { mapApiFootballEvents, type AfEvent } from './feed-apifootball'
import payload from './__fixtures__/apifootball-events-usa-bel-2026.json'

/* Real captured payload: WC 2026 R16, USA 1–4 Belgium (2026-07-07).
 * 17 events: goals, cards, subs — deliberately NO VAR or missed pens, so it
 * proves the mapper stays silent on everything FIFA already covers. */
const real = (payload as { response: AfEvent[] }).response

describe('mapApiFootballEvents — real USA vs Belgium payload', () => {
  it('maps nothing FIFA already covers (goals/cards/subs stay single-sourced)', () => {
    expect(mapApiFootballEvents(real)).toEqual([])
  })
})

describe('mapApiFootballEvents — blind-spot events (documented shapes)', () => {
  const ev = (over: Partial<AfEvent>): AfEvent => ({
    time: { elapsed: 55, extra: null },
    team: { id: 1, name: 'Argentina' },
    player: { id: 2, name: 'L. Messi' },
    comments: null,
    ...over,
  })

  it('maps VAR events to var-review, overturns to var-overturn too', () => {
    const out = mapApiFootballEvents([
      ev({ type: 'Var', detail: 'Goal cancelled' }),
      ev({ type: 'Var', detail: 'Penalty confirmed', time: { elapsed: 70 } }),
    ])
    const keys = out.map((m) => m.eventKey)
    expect(keys).toContain('var-review')
    expect(keys).toContain('var-overturn')
    const overturn = out.find((m) => m.eventKey === 'var-overturn')!
    expect(overturn.minute).toBe("55'")
    expect(overturn.description).toContain('Goal cancelled')
  })

  it('does not fire var-overturn for a confirmed call', () => {
    const out = mapApiFootballEvents([ev({ type: 'Var', detail: 'Penalty confirmed' })])
    expect(out.map((m) => m.eventKey)).toEqual(['var-review'])
  })

  it('maps a missed penalty', () => {
    const out = mapApiFootballEvents([
      ev({ type: 'Goal', detail: 'Missed Penalty', time: { elapsed: 90, extra: 3 } }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].eventKey).toBe('penalty-missed')
    expect(out[0].minute).toBe("90+3'")
    expect(out[0].description).toContain('L. Messi')
  })

  it('emits each key at most once', () => {
    const out = mapApiFootballEvents([
      ev({ type: 'Var', detail: 'Goal cancelled' }),
      ev({ type: 'Var', detail: 'Goal cancelled', time: { elapsed: 80 } }),
    ])
    expect(out.filter((m) => m.eventKey === 'var-review')).toHaveLength(1)
    expect(out.filter((m) => m.eventKey === 'var-overturn')).toHaveLength(1)
  })
})
