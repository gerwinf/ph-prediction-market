import type { Metadata } from 'next'
import { previewFonts } from '../bilyonaryo/fonts'
import '../bilyonaryo/preview.css'

export const metadata: Metadata = {
  title: 'Hula — Bilyonaryo market concept',
  description: 'Illustrative prediction markets, via Bilyonaryo. Play points only. Trading opens later.',
  robots: { index: false, follow: false, noarchive: true },
  alternates: { canonical: null },
  openGraph: { title: 'Hula — Market concept', description: 'Illustrative odds and play points only. Trading opens later.', images: [] },
  twitter: { card: 'summary', title: 'Hula — Market concept', description: 'Illustrative odds and play points only.', images: [] },
}

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <div className={`by-preview by-market-preview ${previewFonts}`}>{children}</div>
}
