import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Please send a valid name and email.' }, { status: 400 })
  }

  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (name.length < 2 || name.length > 64 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a name between 2 and 64 characters and a valid email address.' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!apiKey || !audienceId) {
    return NextResponse.json({ error: 'Reservations aren’t open in this preview yet. Please try again later.' }, { status: 503 })
  }

  try {
    // Use the existing waitlist audience. Persist only the submitted name and
    // email; no predictions, phone numbers, accounts, or notification emails.
    const response = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience_id: audienceId, email, first_name: name }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      return NextResponse.json({ error: 'We couldn’t save your spot. Please try again shortly.' }, { status: 502 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Couldn’t connect to the waitlist. Please try again shortly.' }, { status: 502 })
  }
}
