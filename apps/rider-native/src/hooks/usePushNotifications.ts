import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { useAuth } from '@riderguy/auth-native';
import { resolveRiderNotificationRoute } from '@/lib/notification-route';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function openFromNotificationData(data?: Record<string, unknown> | null) {
  const target = resolveRiderNotificationRoute(data);
  router.push((target ?? '/(app)/notifications') as any);
}

export function usePushNotifications() {
  const { api, isAuthenticated } = useAuth();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let registeredToken: string | null = null;
    let unsubscribeForeground: (() => void) | undefined;
    let unsubscribeOpened: (() => void) | undefined;
    let unsubscribeTokenRefresh: (() => void) | undefined;

    const setup = async () => {
      const granted = await requestPermissionAndChannels();
      if (!granted || cancelled) return;

      // Register the FCM device token — the API delivers via firebase-admin,
      // so it must be a raw FCM token (an Expo push token would never receive anything).
      try {
        const token = await messaging().getToken();
        if (cancelled) return;
        await api.post('/users/push-token', {
          token,
          platform: Platform.OS,
          appProject: 'RIDER',
        });
        registeredToken = token;
      } catch (e) {
        console.warn('[Push] token registration failed:', e);
      }

      if (cancelled) return;

      unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
        try {
          const previousToken = registeredToken;
          await api.post('/users/push-token', {
            token,
            platform: Platform.OS,
            appProject: 'RIDER',
          });
          registeredToken = token;
          if (previousToken && previousToken !== token) {
            await api.post('/users/push-token/remove', { token: previousToken }).catch(() => {});
          }
        } catch {}
      });

      // FCM notification messages are silent in the foreground —
      // mirror them as local notifications so the rider still sees them.
      unsubscribeForeground = messaging().onMessage(
        async (message: FirebaseMessagingTypes.RemoteMessage) => {
          const title = message.notification?.title ?? 'RiderGuy';
          const body = message.notification?.body ?? '';
          if (!title && !body) return;
          await Notifications.scheduleNotificationAsync({
            content: { title, body, data: message.data ?? {}, sound: true },
            trigger: null,
          }).catch(() => {});
        },
      );

      // Tap on an FCM-displayed notification while app was in background
      unsubscribeOpened = messaging().onNotificationOpenedApp((message) => {
        openFromNotificationData(message.data);
      });

      // App launched from a quit state by tapping a notification
      const initial = await messaging()
        .getInitialNotification()
        .catch(() => null);
      if (initial) openFromNotificationData(initial.data);
    };

    void setup().catch((error) => {
      if (!cancelled) console.warn('[Push] setup failed:', error);
    });

    // Tap on a locally-mirrored (foreground) notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotificationData(
        response.notification.request.content.data as Record<string, unknown>,
      );
    });

    return () => {
      cancelled = true;
      responseListener.current?.remove();
      unsubscribeForeground?.();
      unsubscribeOpened?.();
      unsubscribeTokenRefresh?.();
    };
  }, [api, isAuthenticated]);
}

async function requestPermissionAndChannels(): Promise<boolean> {
  // Android 13+ requires a channel before requesting notification permission
  // or obtaining a device push token.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('job-offers', {
      name: 'Job Offers',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#22c55e',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return false;

  return true;
}
