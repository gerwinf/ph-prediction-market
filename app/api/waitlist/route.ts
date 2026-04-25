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

    // For v1, simply accept and return success
    // In production, you would:
    // 1. Send to Formspree: POST to https://formspree.io/f/{FORM_ID}
    // 2. Send to ConvertKit: Use their API
    // 3. Store in a database
    // 4. Send to a CRM

    // Example Formspree integration (uncomment and add your FORM_ID):
    // const res = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email }),
    // })
    // return NextResponse.json({ success: res.ok }, { status: res.ok ? 200 : 500 })

    return NextResponse.json(
      { success: true, message: 'Added to waitlist' },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
