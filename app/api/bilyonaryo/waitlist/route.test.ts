import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/bilyonaryo/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('RESEND_AUDIENCE_ID', 'test-audience')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('preview waitlist', () => {
  it('stores only the normalized name and email in the existing audience', async () => {
    const response = await POST(request({ name: '  Juan  ', email: '  JUAN@example.com ', side: 'yes', phone: 'discard' }))
    expect(response.status).toBe(200)
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://api.resend.com/contacts')
    expect(JSON.parse(options?.body as string)).toEqual({ audience_id: 'test-audience', email: 'juan@example.com', first_name: 'Juan' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([null, {}, { name: 'J', email: 'juan@example.com' }, { name: 'Juan', email: 'invalid' }, { name: 'Juan', email: 42 }])('rejects invalid input without contacting the provider', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/bilyonaryo/waitlist', { method: 'POST', body: '{' })
    expect((await POST(req)).status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not claim to save a reservation when the service is unconfigured', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    expect((await POST(request({ name: 'Juan', email: 'juan@example.com' }))).status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports provider failures without a false success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 422 }))
    expect((await POST(request({ name: 'Juan', email: 'juan@example.com' }))).status).toBe(502)
  })

  it('reports connection failures without logging personal details', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    expect((await POST(request({ name: 'Juan', email: 'juan@example.com' }))).status).toBe(502)
  })
})
