import type { Metadata } from 'next'
import { Fraunces, Space_Mono } from 'next/font/google'
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
const TITLE = 'Hula — The market for what happens next.'
const DESCRIPTION =
  "The Philippines' prediction market. Trade real odds on PBA, boxing, MMFF, weather, World Cup — pesos in, pesos out."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Hula',
  keywords: [
    'Hula',
    'Hulaan',
    'prediction market',
    'Philippines',
    'PBA',
    'PAGCOR',
    'sports betting',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${spaceMono.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
