import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, source, picks, entry, willPay, prefMode, why } = body

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json(
        { error: 'Invalid email' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    const audienceId = process.env.RESEND_AUDIENCE_ID
    const notifyTo = process.env.RESEND_NOTIFY_TO
    const notifyFrom = process.env.RESEND_NOTIFY_FROM || 'onboarding@resend.dev'

    // Log /picks submissions to server logs so we can review demand signal
    // (Resend Audiences API only takes email; richer payload is captured here too)
    if (source === 'picks') {
      console.log('[picks-submission]', JSON.stringify({
        ts: new Date().toISOString(),
        email,
        picks,
        entry,
        willPay,
        prefMode,
        why,
      }))

      // Also notify the team by email per submission, so the full payload
      // (which Resend Audiences won't store) lands somewhere queryable.
      if (apiKey && notifyTo) {
        const subj = `[Hula picks] ${email} · pay=${willPay ?? '—'} · mode=${prefMode ?? '—'} · entry=₱${entry ?? '—'}`
        const pickLines = Array.isArray(picks)
          ? picks
              .map((p: { player?: string; stat?: string; line?: number; side?: string }) =>
                `  - ${p.side ?? '?'} · ${p.player ?? '?'} · ${p.stat ?? ''} ${p.line ?? ''}`
              )
              .join('\n')
          : '(none)'
        const text = [
          `New /picks submission`,
          ``,
          `Email:    ${email}`,
          `WillPay:  ${willPay ?? '(unanswered)'}`,
          `PrefMode: ${prefMode ?? '(unanswered)'}`,
          `Entry:    ₱${entry ?? '(unanswered)'}`,
          `Why:      ${why ?? '(blank)'}`,
          ``,
          `Picks:`,
          pickLines,
          ``,
          `Timestamp: ${new Date().toISOString()}`,
        ].join('\n')

        // Fire and don't block the user response on this — but await briefly
        // so Vercel edge runtime doesn't kill the request before it sends.
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: notifyFrom,
              to: notifyTo,
              subject: subj,
              text,
            }),
          })
        } catch (err) {
          console.error('Resend notify error:', err)
        }
      }
    }

    if (apiKey && audienceId) {
      const res = await fetch('https://api.resend.com/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          audience_id: audienceId,
          // Tag source via first_name field so we can filter in Resend dashboard
          ...(source ? { first_name: `[${source}]` } : {}),
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        // 422 = contact already exists — treat as success
        if (res.status !== 422) {
          console.error('Resend error:', res.status, errBody)
          return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Waitlist error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
