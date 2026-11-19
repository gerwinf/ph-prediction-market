import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '../../middleware'
import { updateSession } from '../supabase/middleware'
import { PREVIEW_HOST } from './content'

vi.mock('../supabase/middleware', () => ({ updateSession: vi.fn(() => NextResponse.next()) }))
afterEach(() => vi.clearAllMocks())

function request(path: string, host = 'hulaan.ph') {
  return new NextRequest(`https://${host}${path}`, { headers: { host } })
}

describe('Bilyonaryo hostname routing', () => {
  it.each([
    ['/', '/bilyonaryo'],
    ['/story/alex-eala-australian-open?from=brief', '/bilyonaryo/story/alex-eala-australian-open?from=brief'],
  ])('rewrites newsroom paths and preserves queries', async (path, destination) => {
    const response = await middleware(request(path, PREVIEW_HOST))
    expect(response.headers.get('x-middleware-rewrite')).toBe(`https://${PREVIEW_HOST}${destination}`)
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
    expect(updateSession).not.toHaveBeenCalled()
  })

  it.each(['/bilyonaryo', '/bilyonaryo/story/example', '/m/example?side=no', '/api/bilyonaryo/waitlist'])('keeps unlisted preview routes out of search and auth', async (path) => {
    const response = await middleware(request(path))
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
    expect(updateSession).not.toHaveBeenCalled()
  })

  it('disallows crawling the whole newsroom subdomain', async () => {
    const response = await middleware(request('/robots.txt', PREVIEW_HOST))
    expect(await response.text()).toBe('User-agent: *\nDisallow: /\n')
  })

  it('preserves session handling for the main Hula site', async () => {
    const req = request('/')
    await middleware(req)
    expect(updateSession).toHaveBeenCalledWith(req)
  })
})
