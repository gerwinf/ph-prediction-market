import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json(
        { error: 'Invalid email' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    const audienceId = process.env.RESEND_AUDIENCE_ID

    if (apiKey && audienceId) {
      const res = await fetch('https://api.resend.com/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, audience_id: audienceId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // 422 = contact already exists — treat as success
        if (res.status !== 422) {
          console.error('Resend error:', res.status, body)
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
