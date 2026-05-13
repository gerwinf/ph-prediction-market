import type { Metadata } from 'next'

const TITLE = "NumeroHula — by Hula · Hula kada game. Sahod kada oras."
const DESCRIPTION = "Pick a number, ₱20 lang. NIST-beacon draw every 15 minutes. 82 sentimos balik sa player. PAGCOR predictive-skill contest, peso-native."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'NumeroHula',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function NumeroLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
