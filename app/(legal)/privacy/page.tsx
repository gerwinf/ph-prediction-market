import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Hula',
  description: 'How Hula collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: July 6, 2026</p>

      <p>
        Hula (hulaan.ph) is a pre-launch product of Hula Pilipinas, Inc. This
        policy describes what we collect today and how we use it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Email address</strong> — when you join the waitlist, reserve a
          handle, or sign in to Hula Hits.
        </li>
        <li>
          <strong>Feedback you submit</strong> — for example your picks and
          answers in the pre-launch feedback forms.
        </li>
        <li>
          <strong>Local demo state</strong> — the Hula Hits demo stores your
          virtual token balance and cards in your browser&apos;s local storage.
          It stays on your device unless you sign in.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        We use your email to send product updates and your Day-1 invite, and
        feedback to decide what to build. We do not sell your data. We do not
        share it with advertisers.
      </p>

      <h2>Where it lives</h2>
      <p>
        Data is stored with our infrastructure providers: Vercel (hosting),
        Supabase (database), and Resend (email delivery).
      </p>

      <h2>Your choices</h2>
      <p>
        Every email we send includes an unsubscribe link. To have your data
        deleted, email us and we will remove it.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy: <a href="mailto:hello@hulaan.ph">hello@hulaan.ph</a>
      </p>
    </>
  )
}
