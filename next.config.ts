import type { NextConfig } from 'next'

const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' }, // private links never leak via Referer
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/adapter-pg', 'pg'],
  turbopack: { rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } } },
  async headers() {
    return [
      { source: '/:path*', headers: security },
      { source: '/s/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }, { key: 'Cache-Control', value: 'private, no-store' }] },
    ]
  },
}

export default nextConfig
