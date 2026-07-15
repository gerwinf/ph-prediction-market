import { describe, test, expect } from 'vitest'
import {
  STALE_LIVE_MS,
  isStaleLive,
  isSettleableId,
  selectStaleLiveToFinalize,
  type LiveWindowFixture,
} from './fixture-window'

const NOW = Date.parse('2026-07-15T20:00:00.000Z')

function live(id: string, overrides: Partial<LiveWindowFixture> = {}): LiveWindowFixture {
  return {
    id,
    status: 'live',
    starts_at: new Date(NOW - 60 * 60 * 1000).toISOString(), // 1h ago (fresh)
    ends_at: null,
    ...overrides,
  }
}

describe('isStaleLive', () => {
  test('a freshly-started live game is not stale', () => {
    expect(isStaleLive(live('wc-eng-arg-2026-07-15'), NOW)).toBe(false)
  })

  test('a live game started well past the window is stale', () => {
    const fx = live('wc-eng-arg-2026-07-15', {
      starts_at: new Date(NOW - STALE_LIVE_MS - 60_000).toISOString(),
    })
    expect(isStaleLive(fx, NOW)).toBe(true)
  })

  test('just inside the window is still live', () => {
    const fx = live('pba-gin-tnt-2026-07-15', {
      starts_at: new Date(NOW - STALE_LIVE_MS + 60_000).toISOString(),
    })
    expect(isStaleLive(fx, NOW)).toBe(false)
  })

  test('the perpetual demo filler is never stale, even from 1970', () => {
    const fx = live('demo-pba-perpetual', { starts_at: '1970-01-01T00:00:00.000Z' })
    expect(isStaleLive(fx, NOW)).toBe(false)
  })

  test('non-live rows are never stale-live', () => {
    expect(isStaleLive(live('wc-eng-arg-2026-07-15', { status: 'final' }), NOW)).toBe(false)
    expect(isStaleLive(live('wc-eng-arg-2026-07-15', { status: 'scheduled' }), NOW)).toBe(false)
  })

  test('ends_at in the past marks it stale even inside the starts_at window', () => {
    const fx = live('wc-eng-arg-2026-07-15', {
      starts_at: new Date(NOW - 30 * 60 * 1000).toISOString(),
      ends_at: new Date(NOW - 60_000).toISOString(),
    })
    expect(isStaleLive(fx, NOW)).toBe(true)
  })

  test('unparseable starts_at is treated as not-stale (never hide on bad data)', () => {
    const fx = live('wc-broken', { starts_at: 'not-a-date' })
    expect(isStaleLive(fx, NOW)).toBe(false)
  })
})

describe('isSettleableId', () => {
  test('wc- and pba- are settleable; demo/other are not', () => {
    expect(isSettleableId('wc-eng-arg-2026-07-15')).toBe(true)
    expect(isSettleableId('pba-gin-tnt-2026-07-15')).toBe(true)
    expect(isSettleableId('demo-pba-perpetual')).toBe(false)
    expect(isSettleableId('nba-lal-bos')).toBe(false)
  })
})

describe('selectStaleLiveToFinalize', () => {
  test('returns only stale-live settleable ids', () => {
    const stale = new Date(NOW - STALE_LIVE_MS - 60_000).toISOString()
    const fixtures: LiveWindowFixture[] = [
      live('wc-eng-arg-2026-07-15', { starts_at: stale }), // stale + settleable ✓
      live('pba-gin-tnt-2026-07-15'), // fresh — excluded
      live('demo-pba-perpetual', { starts_at: '1970-01-01T00:00:00.000Z' }), // demo — excluded
      live('nba-lal-bos', { starts_at: stale }), // stale but not settleable — excluded
      live('pba-old-2026-07-14', { starts_at: stale }), // stale + settleable ✓
    ]
    expect(selectStaleLiveToFinalize(fixtures, NOW)).toEqual([
      'wc-eng-arg-2026-07-15',
      'pba-old-2026-07-14',
    ])
  })
})
