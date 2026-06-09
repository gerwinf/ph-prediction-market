/**
 * Catalog ops layer (server-only) — admin-client reads/writes that span ALL
 * statuses, for the /ops/markets curation console. Unlike lib/catalog/read.ts
 * (public, approved/live only), this uses the service-role client which bypasses
 * RLS, so it can list candidates and retired rows too.
 */
import { createAdminClient } from '../supabase/admin'
import type { MarketStatus } from './types'

export type AdminMarket = {
  id: string
  kind: string
  category: string | null
  title: string
  fixtureId: string | null
  status: string
  interestScore: number
  source: string | null
  suggestedBy: string | null
  reviewedBy: string | null
  createdAt: string
  updatedAt: string
  payload: Record<string, unknown>
}

const COLS =
  'id, kind, category, title, fixture_id, status, interest_score, source, suggested_by, reviewed_by, created_at, updated_at, payload'

type Row = {
  id: string
  kind: string
  category: string | null
  title: string
  fixture_id: string | null
  status: string
  interest_score: number
  source: string | null
  suggested_by: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
  payload: unknown
}

function mapRow(r: Row): AdminMarket {
  return {
    id: r.id,
    kind: r.kind,
    category: r.category,
    title: r.title,
    fixtureId: r.fixture_id,
    status: r.status,
    interestScore: r.interest_score,
    source: r.source,
    suggestedBy: r.suggested_by,
    reviewedBy: r.reviewed_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }
}

/** List markets, optionally filtered by status, highest interest first. */
export async function listMarkets(status?: string): Promise<AdminMarket[]> {
  const admin = createAdminClient()
  let q = admin.from('markets').select(COLS).order('interest_score', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapRow(r as Row))
}

/** Fields a curator may PATCH. `status` to 'candidate' is rejected by the route. */
export type MarketPatch = {
  title?: string
  category?: string | null
  interest_score?: number
  status?: MarketStatus
  payload?: Record<string, unknown>
}

/** Apply a partial update and return the updated row. */
export async function updateMarket(id: string, patch: MarketPatch): Promise<AdminMarket | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('markets')
    .update(patch)
    .eq('id', id)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}

/** Move a market to a terminal review status, stamping the review metadata. */
export async function reviewMarket(
  id: string,
  status: 'approved' | 'retired',
  reviewedBy = 'ops',
): Promise<AdminMarket | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('markets')
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLS)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as Row) : null
}
