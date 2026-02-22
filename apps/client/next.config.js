const withSerwist = require('@serwist/next').default({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: [
    '@riderguy/ui',
    '@riderguy/types',
    '@riderguy/utils',
    '@riderguy/validators',
    '@riderguy/config',
    '@riderguy/auth',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudflare.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },
  headers: async () => [
    {
      source: '/manifest.json',
      headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
    },
  ],
};

module.exports = withSerwist(nextConfig);
