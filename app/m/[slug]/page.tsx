import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { markets } from '@/lib/bilyonaryo/content'
import { MarketPreview } from './market-preview'

export function generateStaticParams() {
  return markets.map((market) => ({ slug: market.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const market = markets.find((item) => item.slug === params.slug)
  return { title: market ? `${market.question} — Hula concept` : 'Market not found' }
}

export default function MarketPage({ params, searchParams }: { params: { slug: string }; searchParams: { side?: string } }) {
  const market = markets.find((item) => item.slug === params.slug)
  if (!market) notFound()
  return <MarketPreview market={market} initialSide={searchParams.side === 'no' ? 'no' : 'yes'} />
}
