import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use — Hula',
  description: 'Terms of use for the Hula pre-launch site and demos.',
}

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="legal-updated">Last updated: July 6, 2026</p>

      <p>
        Hula (hulaan.ph) is operated by Hula Pilipinas, Inc. By using this site
        you agree to these terms.
      </p>

      <h2>Pre-launch product</h2>
      <p>
        Hula is pre-launch. Nothing on this site is a real-money wager, an
        offer to wager, or financial advice. Demo experiences (including Hula
        Hits and Hula Picks) use virtual tokens with <strong>no cash value</strong>;
        they cannot be bought, sold, or redeemed for money.
      </p>

      <h2>Odds and market data</h2>
      <p>
        Probabilities shown are indicative. Where marked, live odds are sourced
        from third-party markets (Polymarket) for informational display only.
        Unmarked figures are editorial estimates, not tradeable prices.
      </p>

      <h2>Eligibility</h2>
      <p>
        Hula is intended for Philippine residents aged 21 and above. At launch,
        real-money markets will operate under PAGCOR oversight and exclude
        government employees, AFP/PNP personnel, and persons in the national
        database of restricted persons.
      </p>

      <h2>Changes</h2>
      <p>
        We may change or discontinue any part of the site at any time, and may
        update these terms; continued use means you accept the updated terms.
      </p>

      <h2>Liability</h2>
      <p>
        The site is provided &quot;as is&quot; without warranties. To the extent
        permitted by Philippine law, Hula Pilipinas, Inc. is not liable for any
        loss arising from use of this pre-launch site.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:hello@hulaan.ph">hello@hulaan.ph</a>
      </p>
    </>
  )
}
