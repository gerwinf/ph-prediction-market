import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Responsible Gaming — Hula',
  description: 'Hula’s responsible gaming commitments.',
}

export default function ResponsibleGamingPage() {
  return (
    <>
      <h1>Responsible Gaming</h1>
      <p className="legal-updated">Last updated: July 6, 2026</p>

      <p>
        Hula is built for entertainment. Magdiwang nang responsable — when the
        fun stops, stop.
      </p>

      <h2>Today (pre-launch)</h2>
      <p>
        No real money moves on Hula today. Demo experiences use virtual tokens
        with no cash value.
      </p>

      <h2>At launch</h2>
      <ul>
        <li>Markets will operate under PAGCOR oversight.</li>
        <li>Open only to Philippine residents aged 21 and above.</li>
        <li>
          Government employees, AFP/PNP personnel, and persons in the national
          database of restricted persons will not be eligible.
        </li>
        <li>
          Deposit limits, cool-offs, and self-exclusion will be available from
          Day 1.
        </li>
      </ul>

      <h2>If it stops being fun</h2>
      <p>
        If your play — here or anywhere — feels like it&apos;s becoming a
        problem, step away and talk to someone you trust. You can also reach
        us at <a href="mailto:hello@hulaan.ph">hello@hulaan.ph</a> and we will
        exclude you from launch communications on request.
      </p>
    </>
  )
}
