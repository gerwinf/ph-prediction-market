/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async redirects() {
    return [
      {
        source: '/bingo/:path*',
        destination: '/hits/:path*',
        permanent: true,
      },
      {
        source: '/bingo',
        destination: '/hits',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
