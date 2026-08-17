'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * useNavigationNotification — shows a persistent "Return to RiderGuy"
 * notification via the service worker when the rider opens Google Maps.
 *
 * The notification stays visible until the rider taps it (or returns to the
 * app on their own). Tapping it focuses the existing app window and navigates
 * back to the active delivery page, preserving all in-memory state.
 *
 * Auto-dismisses the notification when the page becomes visible again.
 */
export function useNavigationNotification(orderId: string | undefined) {
  const hasPermission = useRef(false);

  // Check/request notification permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      hasPermission.current = true;
    }
  }, []);

  const requestPermissionIfNeeded = useCallback(async (): Promise<boolean> => {
    if (hasPermission.current) return true;
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      hasPermission.current = true;
      return true;
    }
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    hasPermission.current = result === 'granted';
    return hasPermission.current;
  }, []);

  /** Show the persistent navigation notification via the service worker */
  const showNotification = useCallback(async (phase: 'pickup' | 'delivery') => {
    if (!orderId) return;
    const granted = await requestPermissionIfNeeded();
    if (!granted) return;
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;

    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NAVIGATION_NOTIFICATION',
      data: { orderId, phase },
    });
  }, [orderId, requestPermissionIfNeeded]);

  /** Dismiss the navigation notification */
  const dismissNotification = useCallback(() => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({
      type: 'DISMISS_NAVIGATION_NOTIFICATION',
    });
  }, []);

  // Auto-dismiss when the rider returns to the app (tab becomes visible)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        dismissNotification();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [dismissNotification]);

  // Clean up notification if the component unmounts (delivery completed, page left)
  useEffect(() => {
    return () => { dismissNotification(); };
  }, [dismissNotification]);

  return { showNotification, dismissNotification };
}
