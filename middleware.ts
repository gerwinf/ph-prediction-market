import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'
import { PREVIEW_HOST } from './lib/bilyonaryo/content'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isPreviewHost = request.headers.get('host')?.split(':')[0] === PREVIEW_HOST

  if (isPreviewHost && path === '/robots.txt') {
    return new NextResponse('User-agent: *\nDisallow: /\n', {
      headers: { 'Content-Type': 'text/plain', 'X-Robots-Tag': 'noindex, nofollow, noarchive' },
    })
  }

  // Both the unlisted path and the custom-domain edition work without auth.
  // Only newsroom paths are rewritten; API calls and Hula markets keep their
  // own routes, so links also work on ordinary Vercel and localhost previews.
  if (isPreviewHost || path === '/bilyonaryo' || path.startsWith('/bilyonaryo/') || path.startsWith('/m/') || path.startsWith('/api/bilyonaryo/')) {
    const newsroomPath = path === '/' || path.startsWith('/story/')
    const response = isPreviewHost && newsroomPath
      ? NextResponse.rewrite(new URL(`/bilyonaryo${path === '/' ? '' : path}${request.nextUrl.search}`, request.url))
      : NextResponse.next()
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    return response
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon, og image, etc. (no auth needed)
     * - public assets (svg, png, jpg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon-mark.svg|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
