/** @type {import('next').NextConfig} */
const monorepoTraceIgnores = [
  '**/.git/**',
  '**/.turbo/**',
  '**/.expo/**',
  '**/.next/cache/**',
  '**/.codex-temp/**',
  '**/.claude/**',
  '**/archive/**',
  '**/assets/**',
  '**/docs/**',
  '**/HOT_data/**',
  '**/scripts/**',
  '**/server-config/**',
  '**/svg files/**',
  '**/artifacts-*',
  '**/apps/admin/**',
  '**/apps/api/**',
  '**/apps/client-native/**',
  '**/apps/rider-native/**',
];

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    outputFileTracingRoot: __dirname,
    outputFileTracingIncludes: {
      '/*': [
        '../../packages/config/**/*',
        '../../packages/types/**/*',
        '../../packages/ui/**/*',
        '../../packages/utils/**/*',
      ],
    },
    outputFileTracingIgnores: monorepoTraceIgnores,
    outputFileTracingExcludes: {
      '*': [
        '../../archive/**',
        '../../assets/**',
        '../../docs/**',
        '../../HOT_data/**',
        '../../scripts/**',
        '../../server-config/**',
        '../../svg files/**',
        '../../artifacts-*',
        '../admin/**',
        '../api/**',
        '../client-native/**',
        '../rider-native/**',
      ],
    },
  },
  transpilePackages: [
    '@riderguy/ui',
    '@riderguy/types',
    '@riderguy/utils',
    '@riderguy/config',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudflare.com' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '0' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};

module.exports = nextConfig;
