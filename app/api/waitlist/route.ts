import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      source,
      picks,
      entry,
      willPay,
      // NumeroHula validation fields
      prefFreq,
      prefBetType,
      // Legacy /picks (PrizePicks-shape) field, still accepted for backward compat
      prefMode,
      why,
    } = body

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

    // Log validation-prototype submissions to server output so we can review
    // demand signal. Resend Audiences API only stores email; we log the
    // structured payload here AND mirror it to a notify email.
    const isValidationSource = source === 'numero' || source === 'picks'
    if (isValidationSource) {
      console.log(`[${source}-submission]`, JSON.stringify({
        ts: new Date().toISOString(),
        email,
        picks,
        entry,
        willPay,
        prefFreq,
        prefBetType,
        prefMode,
        why,
      }))

      // Email the team per submission with the full payload (Resend Audiences
      // doesn't store custom fields). One email per submission, subject is
      // grep-friendly so the team can filter their inbox.
      if (apiKey && notifyTo) {
        const subj = source === 'numero'
          ? `[NumeroHula] ${email} · pay=${willPay ?? '—'} · freq=${prefFreq ?? '—'} · prefer=${prefBetType ?? '—'} · picks=${Array.isArray(picks) ? picks.length : 0} · ${entry != null ? `₱${entry}` : '₱—'}`
          : `[Hula picks] ${email} · pay=${willPay ?? '—'} · mode=${prefMode ?? '—'} · entry=₱${entry ?? '—'}`

        const pickLines = Array.isArray(picks)
          ? picks
              .map((p: {
                // NumeroHula shape
                betType?: string; outcome?: string; stake?: number
                // Legacy /picks shape
                player?: string; stat?: string; line?: number; side?: string
              }) => {
                if (p.betType) return `  - ${p.betType} · ${p.outcome ?? '?'} · ₱${p.stake ?? '—'}`
                return `  - ${p.side ?? '?'} · ${p.player ?? '?'} · ${p.stat ?? ''} ${p.line ?? ''}`
              })
              .join('\n')
          : '(none)'

        const text = source === 'numero'
          ? [
              `New NumeroHula submission`,
              ``,
              `Email:        ${email}`,
              `WillPay:      ${willPay ?? '(unanswered)'}`,
              `PrefFreq:     ${prefFreq ?? '(unanswered)'}`,
              `PrefBetType:  ${prefBetType ?? '(not selected)'}`,
              `Stake total:  ₱${entry ?? '(unanswered)'}`,
              `Why:          ${why ?? '(blank)'}`,
              ``,
              `Picks (${Array.isArray(picks) ? picks.length : 0}):`,
              pickLines,
              ``,
              `Timestamp: ${new Date().toISOString()}`,
            ].join('\n')
          : [
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
