import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { Serwist, NetworkFirst, StaleWhileRevalidate, ExpirationPlugin } from 'serwist';

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
    matcher: /\/api\/v1\/(orders|users|wallets|notifications)/,
    handler: new NetworkFirst({
      cacheName: 'api-data',
      plugins: [
        new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 5 * 60 }),
      ],
      networkTimeoutSeconds: 10,
    }),
    method: 'GET',
  },
  // Cache Google Maps tiles with StaleWhileRevalidate
  {
    matcher: /^https:\/\/maps\.googleapis\.com\//,
    handler: new StaleWhileRevalidate({
      cacheName: 'google-maps-tiles',
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
// Background Sync — keeps order status fresh even when the
// browser tab is backgrounded or the network briefly drops.
//
// When the main thread posts an 'ORDER_STATUS_CHECK' message:
// 1. We queue the order IDs to check
// 2. On next sync event (or immediately if online), GET status
// 3. Notify all client windows of the updated statuses
// ============================================================

const ORDER_SYNC_TAG = 'client-order-sync';
const HEARTBEAT_SYNC_TAG = 'client-heartbeat';

interface QueuedOrderCheck {
  orderIds: string[];
  token: string;
  apiUrl: string;
  timestamp: number;
}

// Simple in-memory queue
let pendingOrderChecks: QueuedOrderCheck[] = [];

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data ?? {};

  if (type === 'ORDER_STATUS_CHECK') {
    pendingOrderChecks.push({
      orderIds: data.orderIds,
      token: data.token,
      apiUrl: data.apiUrl,
      timestamp: Date.now(),
    });

    // Try to sync immediately if online
    if (navigator.onLine) {
      flushOrderChecks();
    } else {
      // Register for background sync when connectivity returns
      self.registration.sync?.register(ORDER_SYNC_TAG).catch(() => {});
    }
  }

  if (type === 'CLIENT_ACTIVE') {
    // Register periodic background sync (if supported)
    registerPeriodicSync();
  }

  if (type === 'HEARTBEAT_TICK') {
    // Periodic heartbeat from main thread — nothing to queue, just keep alive
  }
});

// ── Background Sync event handler ──

self.addEventListener('sync', (event: any) => {
  if (event.tag === ORDER_SYNC_TAG) {
    event.waitUntil(flushOrderChecks());
  }
});

// ── Periodic Background Sync (keeps heartbeat alive) ──

self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === HEARTBEAT_SYNC_TAG) {
    event.waitUntil(sendBackgroundHeartbeat());
  }
});

// ── Push notification handler ──

self.addEventListener('push', (event: any) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, icon, data: notifData } = payload;

    event.waitUntil(
      self.registration.showNotification(title ?? 'RiderGuy', {
        body: body ?? 'You have an update',
        icon: icon ?? '/icons/icon-192.png',
        badge: '/icons/icon-32.png',
        data: notifData,
        tag: notifData?.orderId ? `order-${notifData.orderId}` : 'general',
        actions: notifData?.orderId
          ? [{ action: 'view', title: 'View Order' }]
          : [],
      } as NotificationOptions)
    );
  } catch {
    // If not JSON, show as plain text
    event.waitUntil(
      self.registration.showNotification('RiderGuy', {
        body: event.data.text(),
        icon: '/icons/icon-192.png',
      })
    );
  }
});

// ── Notification click handler ──

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  const orderId = event.notification.data?.orderId;
  const url = orderId ? `/dashboard/orders/${orderId}` : '/dashboard';

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

async function registerPeriodicSync(): Promise<void> {
  try {
    const registration = self.registration as any;
    if (registration.periodicSync) {
      await registration.periodicSync.register(HEARTBEAT_SYNC_TAG, {
        minInterval: 60_000, // Minimum 1 minute
      });
      console.log('[SW] Periodic background sync registered');
    }
  } catch (err) {
    console.warn('[SW] Periodic sync not supported:', err);
  }
}

async function flushOrderChecks(): Promise<void> {
  if (pendingOrderChecks.length === 0) return;

  // Take the most recent check request
  const latest = pendingOrderChecks[pendingOrderChecks.length - 1];
  pendingOrderChecks = [];

  if (!latest) return;

  try {
    // Check status for each order
    for (const orderId of latest.orderIds) {
      const response = await fetch(`${latest.apiUrl}/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${latest.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Notify all clients of the updated order status
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.postMessage({
            type: 'ORDER_STATUS_UPDATE',
            data: { orderId, order: data.data },
          });
        }
      }
    }
    console.log('[SW] Background order status sync successful');
  } catch (err) {
    console.warn('[SW] Background order sync failed:', err);
    // Re-queue for next sync attempt
    pendingOrderChecks.push(latest);
  }
}

async function sendBackgroundHeartbeat(): Promise<void> {
  // Notify all clients to send a heartbeat
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'HEARTBEAT_TICK' });
  }
}
