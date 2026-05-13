/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async redirects() {
    return [
      // /picks renamed to /numero (NumeroHula sub-brand). 307 temporary —
      // /picks may be repurposed for a Phase 1B player-prop product later.
      { source: '/picks', destination: '/numero', permanent: false },
    ]
  },
}

module.exports = nextConfig
