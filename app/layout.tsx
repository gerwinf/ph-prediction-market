import type { Metadata, Viewport } from 'next'
import { Fraunces, Space_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-fraunces',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-geist-mono',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hulaan.ph'
const TITLE = 'Hula — The first Filipino prediction market'
const DESCRIPTION =
  "Hula is the first Filipino prediction market. Trade real odds on PBA, boxing, MMFF, weather, and the World Cup — the prediction market built for the Philippines. Pesos in, pesos out."

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Hula',
  keywords: [
    'first Filipino prediction market',
    'prediction market Philippines',
    'Filipino prediction market',
    'Philippine prediction market',
    'prediction market',
    'prediction markets',
    'Hula',
    'Hulaan',
    'Polymarket Philippines',
    'trade odds Philippines',
    'PBA odds',
    'PBA prediction market',
    'boxing odds Philippines',
    'MMFF predictions',
    'World Cup odds Philippines',
    'PAGCOR',
    'sports betting Philippines',
    'GCash',
    'pesos',
  ],
  authors: [{ name: 'Hula Pilipinas, Inc.' }],
  alternates: { canonical: SITE_URL },
  icons: {
    icon: [{ url: '/favicon-mark.svg', type: 'image/svg+xml' }],
    apple: '/favicon-mark.svg',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Hula',
    type: 'website',
    locale: 'en_PH',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  other: {
    // WhatsApp specifically reads og:image:type — declaring PNG helps preview render
    'og:image:type': 'image/png',
  },
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Hula',
      legalName: 'Hula Pilipinas, Inc.',
      url: SITE_URL,
      logo: `${SITE_URL}/favicon-mark.svg`,
      description:
        'Hula is the first Filipino prediction market — trade real odds on PBA, boxing, MMFF, weather, and the World Cup.',
      areaServed: { '@type': 'Country', name: 'Philippines' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: 'en-PH',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${spaceMono.variable}`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
