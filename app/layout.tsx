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
  title: 'Tayâ — Predict anything. From PBA to M-Series.',
  description: "The Philippines' first prediction market. Stake your call on the moments that matter — local hoops, esports, pageants, the World Cup.",
  openGraph: {
    title: 'Tayâ — Predict anything. From PBA to M-Series.',
    description: "The Philippines' first prediction market.",
    url: 'https://taya.ph',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${spaceMono.variable}`}>
      <body className="bg-brand-bg text-brand-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
