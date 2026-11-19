import type { Metadata } from 'next'
import { previewFonts } from './fonts'
import './preview.css'

const title = 'Bilyonaryo × Hula — Concept preview'
const description = 'An editorial prediction concept by Hula. Illustrative odds and play points only. Not a live Bilyonaryo product.'

export const metadata: Metadata = {
  title,
  description,
  applicationName: 'Bilyonaryo × Hula concept',
  robots: { index: false, follow: false, noarchive: true },
  alternates: { canonical: null },
  openGraph: { title, description, images: [] },
  twitter: { card: 'summary', title, description, images: [] },
}

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className={`by-preview by-news ${previewFonts}`}>{children}</div>
}
