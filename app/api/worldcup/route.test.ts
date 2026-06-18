import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the read adapters so the route is tested without a DB.
vi.mock('../../../lib/catalog/read', () => ({
  fetchApprovedWcFixtures: vi.fn(),
  fetchApprovedWcContenders: vi.fn(),
}))

import { GET } from './route'
import { FIXTURES, CONTENDERS } from '../../../lib/worldcup/fixtures'
import { fetchApprovedWcFixtures, fetchApprovedWcContenders } from '../../../lib/catalog/read'

const mockFixtures = vi.mocked(fetchApprovedWcFixtures)
const mockContenders = vi.mocked(fetchApprovedWcContenders)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/worldcup', () => {
  test('falls back to hardcoded data when both adapters are empty', async () => {
    mockFixtures.mockResolvedValue([])
    mockContenders.mockResolvedValue([])
    const res = await GET()
    const body = await res.json()
    expect(body.fixtures).toEqual(FIXTURES)
    expect(body.contenders).toEqual(CONTENDERS)
  })

  test('returns DB data when present', async () => {
    const dbFixture = { id: 'x', home: { name: 'A', iso: 'aa' }, away: { name: 'B', iso: 'bb' }, group: 'A', kickoffISO: '2026-06-30T19:00:00.000Z', fallback: { home: 50, draw: 25, away: 25 } }
    const dbContender = { name: 'A', iso: 'aa', fallbackPct: 20, vol: '₱1M', delta: 0 }
    mockFixtures.mockResolvedValue([dbFixture] as never)
    mockContenders.mockResolvedValue([dbContender] as never)
    const res = await GET()
    const body = await res.json()
    expect(body.fixtures).toEqual([dbFixture])
    expect(body.contenders).toEqual([dbContender])
  })

  test('falls back per-kind independently', async () => {
    const dbContender = { name: 'A', iso: 'aa', fallbackPct: 20, vol: '₱1M', delta: 0 }
    mockFixtures.mockResolvedValue([]) // empty → fall back
    mockContenders.mockResolvedValue([dbContender] as never) // present → keep
    const res = await GET()
    const body = await res.json()
    expect(body.fixtures).toEqual(FIXTURES)
    expect(body.contenders).toEqual([dbContender])
  })
})
