/**
 * Firebase Cloud Messaging — client-side integration for Rider PWA.
 *
 * Lazily initialises the Firebase app & Messaging SDK, requests
 * notification permission, and obtains an FCM registration token
 * which the server uses to send push notifications when the rider
 * is backgrounded (e.g. incoming job offers, order updates).
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

// ── Firebase config from environment ──

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let app: FirebaseApp | undefined = undefined;
let messaging: Messaging | null = null;

/**
 * Returns true if all required Firebase env vars are set.
 */
export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.messagingSenderId && firebaseConfig.appId && VAPID_KEY);
}

/**
 * Lazily initialise Firebase app + Messaging.
 */
function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseConfigured()) return null;

  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch {
      return null;
    }
  }
  return messaging;
}

/**
 * Request notification permission and obtain an FCM registration token.
 * Returns the token string, or null if permission was denied / unavailable.
 */
export async function requestPushToken(): Promise<string | null> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

  // iOS only supports push in standalone (home screen installed) mode
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isStandalone) return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const msg = getFirebaseMessaging();
  if (!msg) return null;

  try {
    // Get the active service worker registration (Serwist-managed)
    const swReg = await navigator.serviceWorker.ready;

    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    return token || null;
  } catch (err) {
    console.warn('[Firebase] Failed to get FCM token:', err);
    return null;
  }
}

/**
 * Listen for foreground push messages.
 * The callback receives the payload when the app is focused.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  const msg = getFirebaseMessaging();
  if (!msg) return () => {};
  return onMessage(msg, callback);
}
