import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Hula — The market for what happens next.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const interTightSemibold = await fetch(
    'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600&display=swap'
  )
    .then((r) => r.text())
    .then((css) => {
      const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)?.[1]
      return url ? fetch(url).then((r) => r.arrayBuffer()) : null
    })

  const interTightMedium = await fetch(
    'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500&display=swap'
  )
    .then((r) => r.text())
    .then((css) => {
      const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)?.[1]
      return url ? fetch(url).then((r) => r.arrayBuffer()) : null
    })

  const fonts = []
  if (interTightSemibold) fonts.push({ name: 'Inter Tight', data: interTightSemibold, weight: 600 as const, style: 'normal' as const })
  if (interTightMedium) fonts.push({ name: 'Inter Tight', data: interTightMedium, weight: 500 as const, style: 'normal' as const })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f1e3',
          fontFamily: 'Inter Tight, system-ui, sans-serif',
          padding: '80px',
          position: 'relative',
        }}
      >
        {/* H monogram badge */}
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: '50%',
            background: '#0f2419',
            color: '#f5f1e3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 84,
            fontWeight: 700,
            letterSpacing: '-3px',
            marginBottom: 56,
          }}
        >
          H
        </div>

        {/* Hula. wordmark */}
        <div
          style={{
            fontSize: 168,
            fontWeight: 600,
            letterSpacing: '-7px',
            color: '#0f2419',
            display: 'flex',
            lineHeight: 1,
            marginBottom: 32,
          }}
        >
          Hula<span style={{ color: '#e87a1e' }}>.</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 500,
            color: '#5a6a60',
            letterSpacing: '-0.5px',
            textAlign: 'center',
          }}
        >
          The market for what happens next.
        </div>

        {/* Bottom-right meta strip */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 18,
            fontWeight: 500,
            color: '#5a6a60',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e87a1e' }} />
          hulaan.ph · Philippines
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length ? fonts : undefined,
    }
  )
}
