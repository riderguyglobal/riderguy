import { defaultCache } from '@serwist/next/worker';
import {
  Serwist,
  NetworkFirst,
  StaleWhileRevalidate,
  ExpirationPlugin,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// ── Custom runtime caching for API & map tiles ──────────────

const apiCaching: RuntimeCaching[] = [
  // Cache GET /api/v1/* with NetworkFirst — app stays usable briefly offline
  {
    matcher: /\/api\/v1\/(orders|riders|wallets|gamification|community)/,
    handler: new NetworkFirst({
      cacheName: 'api-data',
      plugins: [
        new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 5 * 60 }),
      ],
      networkTimeoutSeconds: 10,
    }),
    method: 'GET',
  },
  // Cache Mapbox tiles with StaleWhileRevalidate
  {
    matcher: /^https:\/\/api\.mapbox\.com\//,
    handler: new StaleWhileRevalidate({
      cacheName: 'mapbox-tiles',
      plugins: [
        new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...defaultCache, ...apiCaching],
  fallbacks: {
    entries: [{ url: '/~offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();
