import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { useAuth } from '@riderguy/auth-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function openFromNotificationData(data?: Record<string, unknown> | null) {
  const orderId = data?.orderId ? String(data.orderId) : '';
  if (orderId) {
    router.push(`/(app)/orders/${orderId}` as any);
    return;
  }
  router.push('/(app)/notifications' as any);
}

export function usePushNotifications() {
  const { api, isAuthenticated } = useAuth();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (!isAuthenticated) return;

    let unsubscribeForeground: (() => void) | undefined;
    let unsubscribeOpened: (() => void) | undefined;
    let unsubscribeTokenRefresh: (() => void) | undefined;

    const setup = async () => {
      const granted = await requestPermissionAndChannels();
      if (!granted) return;

      // Register the FCM device token — the API delivers via firebase-admin,
      // so it must be a raw FCM token (an Expo push token would never receive anything).
      try {
        const token = await messaging().getToken();
        await api.post('/users/push-token', { token, platform: Platform.OS });
      } catch (e) {
        console.warn('[Push] token registration failed:', e);
      }

      unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
        try {
          await api.post('/users/push-token', { token, platform: Platform.OS });
        } catch {}
      });

      // FCM notification messages are silent in the foreground —
      // mirror them as local notifications so the client still sees them.
      unsubscribeForeground = messaging().onMessage(async (message: FirebaseMessagingTypes.RemoteMessage) => {
        const title = message.notification?.title ?? 'RiderGuy';
        const body = message.notification?.body ?? '';
        if (!title && !body) return;
        await Notifications.scheduleNotificationAsync({
          content: { title, body, data: message.data ?? {}, sound: true },
          trigger: null,
        }).catch(() => {});
      });

      // Tap on an FCM-displayed notification while app was in background
      unsubscribeOpened = messaging().onNotificationOpenedApp((message) => {
        openFromNotificationData(message.data);
      });

      // App launched from a quit state by tapping a notification
      const initial = await messaging().getInitialNotification().catch(() => null);
      if (initial) openFromNotificationData(initial.data);
    };

    setup();

    // Tap on a locally-mirrored (foreground) notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotificationData(response.notification.request.content.data as Record<string, unknown>);
    });

    return () => {
      responseListener.current?.remove();
      unsubscribeForeground?.();
      unsubscribeOpened?.();
      unsubscribeTokenRefresh?.();
    };
  }, [isAuthenticated]);
}

async function requestPermissionAndChannels(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22c55e',
    });
  }

  return true;
}
