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
          deviceId: `rider-${navigator.userAgent.slice(0, 50)}`,
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

      // Show a native notification even when foregrounded
      if ('Notification' in window && Notification.permission === 'granted') {
        const title = payload?.notification?.title ?? 'RiderGuy';
        const body = payload?.notification?.body ?? 'You have an update';
        new Notification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          tag: data?.orderId ? `order-${data.orderId}` : 'general',
        });
      }
    });

    return unsubscribe;
  }, [queryClient]);
}
