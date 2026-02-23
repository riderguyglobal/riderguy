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
    'mapbox-gl',
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

// Wrap with Serwist PWA support if available
let finalConfig = nextConfig;
try {
  const withSerwist = require('@serwist/next').default({
    swSrc: 'src/sw.ts',
    swDest: 'public/sw.js',
    disable: process.env.NODE_ENV === 'development',
  });
  finalConfig = withSerwist(nextConfig);
} catch (e) {
  console.warn('⚠️  @serwist/next not available, building without PWA service worker');
}

module.exports = finalConfig;
