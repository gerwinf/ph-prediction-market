import { describe, it, expect } from 'vitest'
import { CONTENDERS, FIXTURES } from './fixtures'

describe('CONTENDERS', () => {
  it('is non-empty and every contender has a 2-letter ISO and a fallback pct', () => {
    expect(CONTENDERS.length).toBeGreaterThan(0)
    for (const c of CONTENDERS) {
      expect(c.iso).toMatch(/^[a-z]{2}$/)
      expect(c.fallbackPct).toBeGreaterThanOrEqual(0)
      expect(c.fallbackPct).toBeLessThanOrEqual(100)
    }
  })
})

describe('FIXTURES', () => {
  it('is non-empty and every fixture has valid teams, ISO codes and fallback odds', () => {
    expect(FIXTURES.length).toBeGreaterThan(0)
    for (const f of FIXTURES) {
      expect(f.home.iso).toMatch(/^[a-z]{2}$/)
      expect(f.away.iso).toMatch(/^[a-z]{2}$/)
      expect(Number.isNaN(Date.parse(f.kickoffISO))).toBe(false)
      const sum = f.fallback.home + f.fallback.draw + f.fallback.away
      expect(sum).toBeGreaterThan(90)
      expect(sum).toBeLessThan(110)
    }
  })
  it('has unique fixture ids', () => {
    const ids = FIXTURES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
