/**
 * Catalog read adapters (server-only).
 *
 * Both helpers return `[]` on ANY error (missing table, RLS, network) so every
 * caller degrades automatically to today's hardcoded data — the catalog is
 * strictly additive. NEVER import this from a client component: it uses the
 * service-role admin client (see lib/supabase/admin.ts).
 */
import { createAdminClient } from '../supabase/admin'
import type {
  CatalogBinaryMarket,
  CatalogEventCell,
  BinaryPayload,
  EventCellPayload,
} from './types'

const LIVE_STATUSES = ['approved', 'live']

type Row = {
  id: string
  kind: string
  category: string | null
  title: string
  fixture_id: string | null
  status: string
  interest_score: number
  source: string | null
  payload: unknown
}

const SELECT = 'id, kind, category, title, fixture_id, status, interest_score, source, payload'

/**
 * All approved/live binary markets, highest interest first. Empty array on any
 * failure → landing page keeps its hardcoded grid.
 */
export async function fetchApprovedBinaryMarkets(): Promise<CatalogBinaryMarket[]> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('markets')
      .select(SELECT)
      .eq('kind', 'binary')
      .in('status', LIVE_STATUSES)
      .order('interest_score', { ascending: false })

    if (error || !data) return []
    return (data as Row[]).map((r) => ({
      id: r.id,
      kind: 'binary',
      category: r.category,
      title: r.title,
      fixtureId: r.fixture_id,
      status: r.status as CatalogBinaryMarket['status'],
      interestScore: r.interest_score,
      source: r.source,
      payload: (r.payload ?? {}) as BinaryPayload,
    }))
  } catch {
    return []
  }
}

/**
 * Approved/live event-cells for a fixture: the generic pool (`fixture_id` null)
 * plus any cells pinned to `fixtureId`. Pass `null` for the generic pool only.
 * Empty array on any failure → /hits keeps its hardcoded pool.
 */
export async function fetchApprovedEventCellsForFixture(
  fixtureId: string | null,
): Promise<CatalogEventCell[]> {
  try {
    const admin = createAdminClient()
    let query = admin
      .from('markets')
      .select(SELECT)
      .eq('kind', 'event_cell')
      .in('status', LIVE_STATUSES)
      .order('interest_score', { ascending: false })

    // Generic tiles (fixture_id null) always apply; pinned tiles only when their
    // fixture matches. `or` keeps both in one round-trip.
    query = fixtureId
      ? query.or(`fixture_id.is.null,fixture_id.eq.${fixtureId}`)
      : query.is('fixture_id', null)

    const { data, error } = await query
    if (error || !data) return []
    return (data as Row[]).map((r) => ({
      id: r.id,
      kind: 'event_cell',
      category: r.category,
      title: r.title,
      fixtureId: r.fixture_id,
      status: r.status as CatalogEventCell['status'],
      interestScore: r.interest_score,
      source: r.source,
      payload: (r.payload ?? {}) as EventCellPayload,
    }))
  } catch {
    return []
  }
}
