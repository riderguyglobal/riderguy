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

// ── IndexedDB-backed queue (survives SW restarts) ───────────

const IDB_NAME = 'riderguy-sw';
const IDB_STORE = 'location-queue';
const IDB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPush(item: QueuedLocation): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).add(item);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch {
    // Fallback: silently fail (location will be sent on next heartbeat anyway)
  }
}

async function idbGetAll(): Promise<QueuedLocation[]> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const items: QueuedLocation[] = await new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return items;
  } catch {
    return [];
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  } catch {
    // Silently fail
  }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data ?? {};

  if (type === 'SYNC_LOCATION') {
    const item: QueuedLocation = {
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: Date.now(),
      token: data.token,
      apiUrl: data.apiUrl,
    };

    // Store in IndexedDB (persistent across SW restarts)
    idbPush(item);

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
  const pending = await idbGetAll();
  if (pending.length === 0) return;

  // Take the most recent location (no need to send stale ones)
  const latest = pending[pending.length - 1];
  // Clear the queue before sending (prevents duplicates)
  await idbClear();

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
    await idbPush(latest);
  }
}

async function sendBackgroundHeartbeat(): Promise<void> {
  // Notify all clients to send a heartbeat
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'HEARTBEAT_TICK' });
  }
}

// ── Push notification handler ──

self.addEventListener('push', (event: any) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, icon, data: notifData } = payload;

    event.waitUntil(
      self.registration.showNotification(title ?? 'RiderGuy', {
        body: body ?? 'You have an update',
        icon: icon ?? '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: notifData,
        tag: notifData?.orderId ? `order-${notifData.orderId}` : 'general',
        requireInteraction: notifData?.type === 'job:offer', // Job offers stay until interacted
        actions: notifData?.orderId
          ? [{ action: 'view', title: 'View Details' }]
          : [],
      } as NotificationOptions)
    );
  } catch {
    // If not JSON, show as plain text
    event.waitUntil(
      self.registration.showNotification('RiderGuy', {
        body: event.data.text(),
        icon: '/icons/icon-192x192.png',
      })
    );
  }
});

// ── Notification click handler ──

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  const notifData = event.notification.data;
  let url = '/dashboard';

  if (notifData?.orderId) {
    url = `/dashboard/jobs/${notifData.orderId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
