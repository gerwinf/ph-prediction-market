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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://hulaan.ph'),
  title: 'Hula — Predict anything. From PBA to M-Series.',
  description: "The Philippines' first prediction market. Stake your call on the moments that matter — local hoops, esports, pageants, the World Cup.",
  icons: {
    icon: '/favicon-mark.svg',
  },
  openGraph: {
    title: 'Hula — Predict anything. From PBA to M-Series.',
    description: "The Philippines' first prediction market.",
    url: 'https://hulaan.ph',
    type: 'website',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Hula — Predict anything',
      },
    ],
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
