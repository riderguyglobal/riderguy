/**
 * usePushNotifications — registers for FCM push notifications.
 *
 * On mount (when authenticated), requests notification permission,
 * obtains an FCM token, and posts it to the API. Also listens for
 * foreground push messages and triggers React Query invalidation
 * so the UI stays up to date.
 *
 * Token is re-registered once per session (tracked via ref).
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@riderguy/auth';
import { useQueryClient } from '@tanstack/react-query';
import { requestPushToken, onForegroundMessage, isFirebaseConfigured } from '@/lib/firebase-messaging';

/** Stable device identifier that survives browser updates (unlike User-Agent). */
function getStableDeviceId(): string {
  const KEY = 'riderguy_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `rider-${crypto.randomUUID()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function usePushNotifications() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const registeredRef = useRef(false);

  // ── Register FCM token with the server ──
  useEffect(() => {
    if (!api || registeredRef.current || !isFirebaseConfigured()) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await requestPushToken();
        if (cancelled || !token) return;

        await api.post('/users/push-token', {
          token,
          platform: 'web',
          deviceId: getStableDeviceId(),
        });

        registeredRef.current = true;
        console.log('[Push] FCM token registered');
      } catch (err) {
        console.warn('[Push] Token registration failed:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [api]);

  // ── Handle foreground push messages ──
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubscribe = onForegroundMessage((payload) => {
      console.log('[Push] Foreground message:', payload);

      const data = payload?.data;

      // Invalidate relevant queries based on notification type
      if (data?.orderId) {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['order', data.orderId] });
      }

      // Show a notification even when foregrounded
      // Use ServiceWorkerRegistration.showNotification() for Android Chrome compatibility
      // (new Notification() constructor is blocked on Android)
      if ('Notification' in window && Notification.permission === 'granted') {
        const title = payload?.notification?.title ?? 'RiderGuy';
        const body = payload?.notification?.body ?? 'You have an update';
        const opts = {
          body,
          icon: '/icons/icon-192.png',
          tag: data?.orderId ? `order-${data.orderId}` : 'general',
        };
        if (navigator.serviceWorker) {
          navigator.serviceWorker.ready
            .then(reg => reg.showNotification(title, opts))
            .catch(() => { try { new Notification(title, opts); } catch {} });
        } else {
          try { new Notification(title, opts); } catch {}
        }
      }
    });

    return unsubscribe;
  }, [queryClient]);
}
