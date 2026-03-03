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

// ============================================================
// Background Sync — keeps rider location fresh even when the
// browser tab is backgrounded or the network briefly drops.
//
// When the main thread posts a 'SYNC_LOCATION' message:
// 1. We store it in an IDB-like queue
// 2. On next sync event (or immediately if online), POST to API
// 3. The periodic sync keeps heartbeat alive in background
// ============================================================

// ── Background Sync: Location Queue ──

const LOCATION_SYNC_TAG = 'rider-location-sync';
const HEARTBEAT_SYNC_TAG = 'rider-heartbeat';

interface QueuedLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  token: string;
  apiUrl: string;
}

// Simple in-memory queue (persists across SW lifecycle via global scope)
let pendingLocations: QueuedLocation[] = [];

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data ?? {};

  if (type === 'SYNC_LOCATION') {
    pendingLocations.push({
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: Date.now(),
      token: data.token,
      apiUrl: data.apiUrl,
    });

    // Try to sync immediately if online
    if (navigator.onLine) {
      flushLocationQueue();
    } else {
      // Register for background sync when connectivity returns
      self.registration.sync?.register(LOCATION_SYNC_TAG).catch(() => {});
    }
  }

  if (type === 'RIDER_ONLINE') {
    // Register periodic background sync (if supported)
    registerPeriodicSync();
  }

  if (type === 'RIDER_OFFLINE') {
    // Flush any remaining locations
    flushLocationQueue();
    pendingLocations = [];
  }
});

// ── Background Sync event handler ──

self.addEventListener('sync', (event: any) => {
  if (event.tag === LOCATION_SYNC_TAG) {
    event.waitUntil(flushLocationQueue());
  }
});

// ── Periodic Background Sync (keeps heartbeat alive) ──

self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === HEARTBEAT_SYNC_TAG) {
    event.waitUntil(sendBackgroundHeartbeat());
  }
});

async function registerPeriodicSync(): Promise<void> {
  try {
    const registration = self.registration as any;
    if (registration.periodicSync) {
      await registration.periodicSync.register(HEARTBEAT_SYNC_TAG, {
        minInterval: 60_000, // Minimum 1 minute (browser may throttle further)
      });
      console.log('[SW] Periodic background sync registered');
    }
  } catch (err) {
    console.warn('[SW] Periodic sync not supported:', err);
  }
}

async function flushLocationQueue(): Promise<void> {
  if (pendingLocations.length === 0) return;

  // Take the most recent location (no need to send stale ones)
  const latest = pendingLocations[pendingLocations.length - 1];
  pendingLocations = [];

  if (!latest) return;

  try {
    await fetch(`${latest.apiUrl}/riders/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${latest.token}`,
      },
      body: JSON.stringify({
        latitude: latest.latitude,
        longitude: latest.longitude,
      }),
    });
    console.log('[SW] Background location sync successful');
  } catch (err) {
    console.warn('[SW] Background location sync failed:', err);
    // Re-queue for next sync attempt
    pendingLocations.push(latest);
  }
}

async function sendBackgroundHeartbeat(): Promise<void> {
  // Notify all clients to send a heartbeat
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'HEARTBEAT_TICK' });
  }
}
