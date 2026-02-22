/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

module.exports = nextConfig;
