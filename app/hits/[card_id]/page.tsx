import type { Metadata } from 'next'
import { HitsCardClient } from './card-client'

/* ────────────────────────────────────────────────────────────────────────
 * /hits/[card_id] — server shell.
 *
 * Exists so shared card links unfurl with the CARD'S match, not the site
 * default: link scrapers (WhatsApp/FB/Twitter) never run client JS, and the
 * card view is a client component, so per-card OG tags must be produced
 * here via generateMetadata. The interactive card itself is card-client.tsx.
 * ──────────────────────────────────────────────────────────────────────── */

export const dynamic = 'force-dynamic'

type Props = {
  params: { card_id: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const cardId = params.card_id
  const type = first(searchParams.type) === 'daily' ? 'daily' : 'sports'
  // Same default the client + /api/cards use when no match is pinned.
  const matchId =
    first(searchParams.match) || (type === 'sports' ? 'demo-pba-perpetual' : 'daily-2026-07-20')

  // Best-effort match label — a scraper must always get valid tags, so any
  // DB hiccup degrades to the generic label rather than erroring the page.
  let label = type === 'daily' ? 'the Manila daily card' : 'the live game'
  try {
    const { createAdminClient } = await import('../../../lib/supabase/admin')
    const { data } = await createAdminClient()
      .from('match_fixtures')
      .select('match_label')
      .eq('id', matchId)
      .maybeSingle()
    if (data?.match_label) label = data.match_label as string
  } catch {
    /* generic label */
  }

  const title = `Hula Hits card ${cardId} — ${label}`
  const description =
    '25 cells of live game moments. Watch the card light up as it happens — 5 in a row wins, full card hits the jackpot.'
  const path = `/hits/${cardId}`

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: 'Hula',
      type: 'website',
      locale: 'en_PH',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default function HitsCardPage({ params }: Props) {
  return <HitsCardClient params={params} />
}
