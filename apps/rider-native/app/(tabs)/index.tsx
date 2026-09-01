import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { io, type Socket } from 'socket.io-client';
import { initApiClient, tokenStorage, useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import Toast from 'react-native-toast-message';
import { BrandHeader, ProgressBar } from '@/components/rider-ui';
import { RiderNavigationMenu } from '@/components/rider-navigation-menu';
import { cleanLabel, riderColors, riderFonts, riderShadow } from '@/lib/rider-design';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

type IncomingOffer = Record<string, any> & {
  orderId?: string;
  id?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  riderEarnings?: number | string;
  currency?: string;
  distanceKm?: number | string;
  estimatedDurationMinutes?: number | string;
  packageType?: string;
};

type LatLng = { latitude: number; longitude: number };

const BACKGROUND_LOCATION_TASK = 'background-location-task';
const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://api.myriderguy.com')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.myriderguy.com/api/v1')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');
const LOCATION_TIMEOUT_MS = 8000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_LAST_KNOWN_ACCURACY_METERS = 250;
const OFFER_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_RIDER_OFFER_COUNTDOWN ?? '30', 10);
const dashboardHero = require('../../assets/images/illustrations/rider-dashboard-hero-v4.png');
const dashboardWallet = require('../../assets/images/illustrations/rider-dashboard-wallet-v1.png');

async function getUsablePosition() {
  const current = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
  ]).catch(() => null);

  if (current && Number.isFinite(current.coords.latitude) && Number.isFinite(current.coords.longitude)) {
    return current;
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: LAST_KNOWN_MAX_AGE_MS,
    requiredAccuracy: MAX_LAST_KNOWN_ACCURACY_METERS,
  }).catch(() => null);

  const lastKnownAge = lastKnown ? Date.now() - lastKnown.timestamp : Number.POSITIVE_INFINITY;
  const lastKnownAccuracy = lastKnown?.coords.accuracy;
  if (
    lastKnown
    && Number.isFinite(lastKnown.coords.latitude)
    && Number.isFinite(lastKnown.coords.longitude)
    && lastKnownAge >= 0
    && lastKnownAge <= LAST_KNOWN_MAX_AGE_MS
    && typeof lastKnownAccuracy === 'number'
    && Number.isFinite(lastKnownAccuracy)
    && lastKnownAccuracy <= MAX_LAST_KNOWN_ACCURACY_METERS
  ) {
    return lastKnown;
  }

  throw new Error('A recent, accurate GPS location is required before you can go online. Move to an open area and try again.');
}

function offerOrderId(offer?: IncomingOffer | null) {
  const id = offer?.orderId ?? offer?.id;
  return id ? String(id) : '';
}

function emitOfferResponse(socket: Socket | null, orderId: string, response: 'accept' | 'decline') {
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    if (!socket) {
      resolve({ success: false, error: 'Socket is not connected' });
      return;
    }

    const timer = setTimeout(() => resolve({ success: false, error: 'Timed out' }), 6000);
    socket.emit('job:offer:respond', { orderId, response }, (ack: { success: boolean; error?: string }) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

function formatOnlineDuration(startedAt: number | null, now: number) {
  if (!startedAt) return 'Unavailable';
  const minutes = Math.max(0, Math.floor((now - startedAt) / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function inferAreaName(profile: any, position: LatLng | null) {
  const direct = profile?.currentZone?.name ?? profile?.currentZoneName ?? profile?.zoneName ?? profile?.city ?? profile?.market;
  if (direct) return cleanLabel(String(direct));

  if (!position) return 'Current area';

  if (position.latitude >= 4.75 && position.latitude <= 5.35 && position.longitude >= -2.25 && position.longitude <= -1.45) {
    return 'Takoradi';
  }
  if (position.latitude >= 5.45 && position.latitude <= 5.75 && position.longitude >= -0.35 && position.longitude <= 0.05) {
    return 'Accra';
  }
  return 'Current area';
}

function formatTodayAmount(wallet: any) {
  const amount = Number(wallet?.todayEarnings ?? wallet?.earningsToday ?? wallet?.todayTotal ?? 0);
  const currency = String(wallet?.currency ?? 'GHS').toUpperCase();
  return formatMoneyAmount(amount, currency);
}

function formatOverviewEarnings(wallet: any) {
  const amount = Number(wallet?.todayEarnings ?? wallet?.earningsToday ?? wallet?.todayTotal ?? 0);
  const currency = String(wallet?.currency ?? 'GHS').toUpperCase();
  if (currency !== 'GHS') return formatCurrency(amount, currency);
  const hasPesewas = Math.abs(amount % 1) > 0.005;
  return `GHS ${amount.toLocaleString('en-GH', {
    minimumFractionDigits: hasPesewas ? 2 : 0,
    maximumFractionDigits: hasPesewas ? 2 : 0,
  })}`;
}

function formatMoneyAmount(amount: number, currency = 'GHS') {
  const normalized = String(currency).toUpperCase();
  if (normalized === 'GHS') return `GHS ${amount.toFixed(2)}`;
  return formatCurrency(amount, normalized);
}

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    if (error || !data?.locations?.length) return;
    const loc = data.locations[data.locations.length - 1];
    try {
      const api = initApiClient(API_URL);
      await api.post('/riders/location', {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {}
  });
}

export default function RiderHomeScreen() {
  const { api, user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const [isOnline, setIsOnline] = useState(false);
  const [showLiveMap, setShowLiveMap] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<IncomingOffer | null>(null);
  const [offerTimeLeft, setOfferTimeLeft] = useState(OFFER_TIMEOUT);
  const [respondingOffer, setRespondingOffer] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [confirmedPosition, setConfirmedPosition] = useState<LatLng | null>(null);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const [requestingBackgroundLocation, setRequestingBackgroundLocation] = useState(false);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [availabilityMenuOpen, setAvailabilityMenuOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const onlineServicesSetupRef = useRef<Promise<void> | null>(null);
  const promptForBackgroundLocationRef = useRef(false);
  const { unreadCount } = useUnreadNotifications();
  const defaultTabBarStyle = useMemo(() => ({
    borderTopWidth: 1,
    borderTopColor: '#EDF2EF',
    backgroundColor: riderColors.white,
    height: 62 + insets.bottom,
    paddingTop: 9,
    paddingBottom: Math.max(insets.bottom, 8),
  }), [insets.bottom]);

  const {
    data: wallet,
    isError: walletError,
    isLoading: walletLoading,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: ['rider-wallet'],
    queryFn: async () => {
      const { data } = await api.get('/wallets');
      return data.data ?? data;
    },
  });

  const {
    data: profile,
    isError: profileError,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['rider-profile'],
    queryFn: async () => {
      const { data } = await api.get('/riders/profile');
      return data.data ?? data;
    },
  });

  const { refetch: refetchAvailableJobs } = useQuery({
    queryKey: ['jobs-available'],
    queryFn: async () => {
      const { data } = await api.get('/orders/available');
      return (data.data ?? data) as any[];
    },
    enabled: isOnline,
    refetchInterval: isOnline ? 9000 : false,
    retry: false,
  });

  const {
    data: recentJobs,
    isError: recentJobsError,
    isLoading: recentJobsLoading,
    refetch: refetchRecentJobs,
  } = useQuery({
    queryKey: ['rider-jobs-recent'],
    queryFn: async () => {
      const { data } = await api.get('/orders?limit=100');
      const jobs = (data.data ?? data) as any[];
      return jobs;
    },
    refetchInterval: 15000,
  });

  const {
    data: gamificationProfile,
    isError: gamificationError,
    isLoading: gamificationLoading,
    refetch: refetchGamification,
  } = useQuery({
    queryKey: ['gamification-profile'],
    queryFn: async () => {
      const { data } = await api.get('/gamification/profile');
      return data.data ?? data;
    },
  });

  useEffect(() => {
    if (!profile?.availability) return;
    setIsOnline(profile.availability === 'ONLINE' || profile.availability === 'ON_DELIVERY');
  }, [profile?.availability]);

  useEffect(() => {
    if (!isOnline) setShowLiveMap(false);
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return undefined;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [isOnline]);

  useEffect(() => {
    if (!incomingOffer) {
      setOfferTimeLeft(OFFER_TIMEOUT);
      setRespondingOffer(false);
      return undefined;
    }

    setOfferTimeLeft(OFFER_TIMEOUT);
    const timer = setInterval(() => {
      setOfferTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setIncomingOffer(null);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingOffer]);

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: isOnline && showLiveMap ? { display: 'none' } : defaultTabBarStyle,
    });

    return () => {
      navigation.setOptions({ tabBarStyle: defaultTabBarStyle });
    };
  }, [defaultTabBarStyle, isOnline, navigation, showLiveMap]);

  const connectSocket = useCallback(async () => {
    const token = await tokenStorage.getAccessToken();
    if (!token) throw new Error('Your session has expired. Please sign in again.');

    if (socketRef.current) {
      socketRef.current.auth = { token };
      if (!socketRef.current.connected) socketRef.current.connect();
      else await qc.invalidateQueries({ queryKey: ['rider-profile'] });
      return;
    }

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], auth: { token } });
    socket.on('connect', () => {
      // Presence persists the authoritative sessionStartedAt during the
      // handshake. Refresh the active profile after every reconnect.
      void qc.invalidateQueries({ queryKey: ['rider-profile'] });
    });
    socket.on('job:offer', (offer: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setIncomingOffer(offer);
    });
    socket.on('job:offer:taken', (payload: any) => {
      setIncomingOffer((current) => (offerOrderId(current) === payload?.orderId ? null : current));
      qc.invalidateQueries({ queryKey: ['jobs-available'] });
    });
    socketRef.current = socket;
  }, [qc]);

  const respondToOffer = useCallback(async (response: 'accept' | 'decline') => {
    const offer = incomingOffer;
    const orderId = offerOrderId(offer);
    if (!offer || !orderId || respondingOffer) return;

    setRespondingOffer(true);
    try {
      const ack = await emitOfferResponse(socketRef.current, orderId, response);
      if (!ack.success && response === 'accept') {
        await api.post(`/orders/${orderId}/accept`);
      } else if (!ack.success) {
        throw new Error(ack.error ?? 'Could not respond');
      }

      setIncomingOffer(null);
      await qc.invalidateQueries({ queryKey: ['jobs-available'] });

      if (response === 'accept') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Toast.show({ type: 'success', text1: 'Request accepted.' });
        router.push(`/(app)/jobs/${orderId}` as any);
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? error?.message ?? 'Could not respond.' });
    } finally {
      setRespondingOffer(false);
    }
  }, [api, incomingOffer, qc, respondingOffer]);

  const startBackgroundLocationUpdates = useCallback(async () => {
    const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
    if (running) return;
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000,
      distanceInterval: 30,
      foregroundService: {
        notificationTitle: 'RiderGuy is online',
        notificationBody: 'Your location is shared while you receive and complete jobs.',
        notificationColor: riderColors.green,
      },
      pausesUpdatesAutomatically: false,
    });
  }, []);

  const confirmBackgroundLocation = useCallback(async () => {
    setRequestingBackgroundLocation(true);
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        await startBackgroundLocationUpdates();
      } else {
        Toast.show({ type: 'info', text1: 'Background location not granted.', text2: 'You can still receive jobs while the app is open.' });
      }
    } finally {
      setRequestingBackgroundLocation(false);
      setShowLocationDisclosure(false);
    }
  }, [startBackgroundLocationUpdates]);

  const declineBackgroundLocation = useCallback(() => {
    setShowLocationDisclosure(false);
  }, []);

  const setupOnlineServices = useCallback(async (promptForBackgroundLocation: boolean) => {
    if (onlineServicesSetupRef.current) return onlineServicesSetupRef.current;

    const setup = (async () => {
      if (!locationWatchRef.current) {
        locationWatchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 9000, distanceInterval: 25 },
          (loc) => {
            setConfirmedPosition({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            socketRef.current?.emit('rider:updateLocation', {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading,
              speed: loc.coords.speed,
            });
          },
        );
      }

      await activateKeepAwakeAsync();
      await connectSocket();

      // Background location requires a prominent in-app disclosure (Play policy)
      // shown before the OS "Allow all the time" prompt.
      const { status: existingBackground } = await Location.getBackgroundPermissionsAsync();
      if (existingBackground === 'granted') {
        await startBackgroundLocationUpdates();
      } else if (promptForBackgroundLocation) {
        setShowLocationDisclosure(true);
      }
    })();

    onlineServicesSetupRef.current = setup;
    try {
      await setup;
    } finally {
      onlineServicesSetupRef.current = null;
    }
  }, [connectSocket, startBackgroundLocationUpdates]);

  const goOnline = async () => {
    setTogglingOnline(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Location permission is required.' });
        return;
      }
      const current = await getUsablePosition();
      const startingPosition = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      const { data } = await api.patch('/riders/availability', {
        availability: 'ONLINE',
        latitude: startingPosition.latitude,
        longitude: startingPosition.longitude,
      });
      const updatedProfile = data.data ?? data;
      qc.setQueryData(['rider-profile'], (existing: any) => ({ ...(existing ?? {}), ...updatedProfile }));
      setConfirmedPosition(startingPosition);
      promptForBackgroundLocationRef.current = true;
      setIsOnline(true);
      Toast.show({ type: 'success', text1: 'You are online.' });

      await Promise.allSettled([
        refetchProfile(),
        refetchAvailableJobs(),
        qc.invalidateQueries({ queryKey: ['jobs-available'] }),
      ]);
    } catch (error: any) {
      setIsOnline(false);
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.error?.message ?? error?.message ?? 'Could not go online.',
      });
    } finally {
      setTogglingOnline(false);
    }
  };

  const goOffline = async () => {
    setTogglingOnline(true);
    try {
      await api.patch('/riders/availability', { availability: 'OFFLINE' });
      locationWatchRef.current?.remove();
      locationWatchRef.current = null;
      const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
      if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      socketRef.current?.disconnect();
      socketRef.current = null;
      onlineServicesSetupRef.current = null;
      promptForBackgroundLocationRef.current = false;
      deactivateKeepAwake();
      setIsOnline(false);
      setShowLiveMap(false);
      setConfirmedPosition(null);
      await refetchProfile();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not go offline.' });
    } finally {
      setTogglingOnline(false);
    }
  };

  useEffect(() => {
    if (!isOnline) return;

    const shouldPrompt = promptForBackgroundLocationRef.current;
    promptForBackgroundLocationRef.current = false;
    setupOnlineServices(shouldPrompt).catch(() => {
      Toast.show({
        type: 'info',
        text1: 'Online. Live tracking will retry shortly.',
        text2: 'Keep the app open while the phone warms up GPS.',
      });
    });
  }, [isOnline, setupOnlineServices]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && isOnline) connectSocket();
    });
    return () => sub.remove();
  }, [isOnline, connectSocket]);

  useEffect(() => {
    return () => {
      locationWatchRef.current?.remove();
      socketRef.current?.disconnect();
      onlineServicesSetupRef.current = null;
      deactivateKeepAwake();
    };
  }, []);

  const onRefresh = async () => {
    await Promise.all([
      refetchWallet(),
      refetchProfile(),
      refetchAvailableJobs(),
      refetchRecentJobs(),
      refetchGamification(),
    ]);
  };

  const riderPosition = useMemo<LatLng | null>(() => {
    if (confirmedPosition) return confirmedPosition;
    const latitude = Number(profile?.currentLatitude);
    const longitude = Number(profile?.currentLongitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
    return null;
  }, [confirmedPosition, profile?.currentLatitude, profile?.currentLongitude]);
  const areaName = useMemo(() => inferAreaName(profile, riderPosition), [profile, riderPosition]);
  const walletUnavailable = !wallet && !walletLoading;
  const profileUnavailable = !profile && !profileLoading;
  const recentJobsUnavailable = !recentJobs && !recentJobsLoading;
  const gamificationUnavailable = !gamificationProfile && !gamificationLoading;
  const todayAmount = walletUnavailable
    ? 'Unavailable'
    : walletLoading && !wallet
      ? 'Loading'
      : formatTodayAmount(wallet);
  const todayDeliveries = (recentJobs ?? []).filter((job: any) => {
    const completedAt = job.deliveredAt ?? job.completedAt ?? job.updatedAt ?? job.createdAt;
    if (job.status !== 'DELIVERED' || !completedAt) return false;
    const delivered = new Date(completedAt);
    const now = new Date();
    return delivered.getFullYear() === now.getFullYear()
      && delivered.getMonth() === now.getMonth()
      && delivered.getDate() === now.getDate();
  }).length;
  const parsedSessionStartedAt = profile?.sessionStartedAt
    ? Date.parse(String(profile.sessionStartedAt))
    : Number.NaN;
  const onlineFor = formatOnlineDuration(
    Number.isFinite(parsedSessionStartedAt) ? parsedSessionStartedAt : null,
    clock,
  );
  const retryDashboardData = async () => {
    await Promise.allSettled([refetchWallet(), refetchProfile(), refetchRecentJobs(), refetchGamification()]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.white }} edges={['top']}>
      {isOnline && showLiveMap ? (
        <OnlineDashboard
          areaName={areaName}
          bottomInset={insets.bottom}
          onGoOffline={goOffline}
          onBack={() => setShowLiveMap(false)}
          onNotifications={() => router.push('/(app)/notifications')}
          onAvailability={() => setAvailabilityMenuOpen(true)}
          onlineFor={onlineFor}
          riderPosition={riderPosition}
          todayAmount={todayAmount}
          toggling={togglingOnline}
          unread={unreadCount > 0}
        />
      ) : (
        <>
          <BrandHeader
            onMenu={() => setMainMenuOpen(true)}
            onNotifications={() => router.push('/(app)/notifications')}
            unread={unreadCount > 0}
          />
          <ScrollView
            refreshControl={<RefreshControl refreshing={walletLoading} onRefresh={onRefresh} tintColor={riderColors.green} />}
            showsVerticalScrollIndicator={false}
            style={{ backgroundColor: riderColors.white }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 22 }}
          >
            <HomeDashboard
              dataError={walletError || profileError || recentJobsError || gamificationError || walletUnavailable || profileUnavailable || recentJobsUnavailable || gamificationUnavailable}
              gamification={gamificationProfile}
              gamificationLoading={gamificationLoading}
              gamificationUnavailable={gamificationUnavailable}
              isOnline={isOnline}
              onGoOffline={goOffline}
              onGoOnline={goOnline}
              onAvailabilityPress={() => setAvailabilityMenuOpen(true)}
              onOpenLiveMap={() => setShowLiveMap(true)}
              onRetryData={() => void retryDashboardData()}
              profile={profile}
              profileLoading={profileLoading}
              profileUnavailable={profileUnavailable}
              recentJobsLoading={recentJobsLoading}
              recentJobsUnavailable={recentJobsUnavailable}
              todayDeliveries={todayDeliveries}
              toggling={togglingOnline}
              user={user}
              wallet={wallet}
              walletUnavailable={walletUnavailable}
              walletLoading={walletLoading}
            />
          </ScrollView>
        </>
      )}
      <IncomingRequestModal
        offer={incomingOffer}
        onDecline={() => respondToOffer('decline')}
        onAccept={() => respondToOffer('accept')}
        responding={respondingOffer}
        timeLeft={offerTimeLeft}
      />
      <LocationDisclosureModal
        visible={showLocationDisclosure}
        loading={requestingBackgroundLocation}
        onDecline={declineBackgroundLocation}
        onContinue={confirmBackgroundLocation}
      />
      <RiderNavigationMenu
        visible={mainMenuOpen}
        onClose={() => setMainMenuOpen(false)}
      />
      <AvailabilityMenuModal
        visible={availabilityMenuOpen}
        isOnline={isOnline}
        loading={togglingOnline}
        onClose={() => setAvailabilityMenuOpen(false)}
        onGoOnline={() => {
          setAvailabilityMenuOpen(false);
          void goOnline();
        }}
        onGoOffline={() => {
          setAvailabilityMenuOpen(false);
          void goOffline();
        }}
        onOpenMap={() => {
          setAvailabilityMenuOpen(false);
          setShowLiveMap(true);
        }}
      />
    </SafeAreaView>
  );
}

function HomeDashboard({
  dataError,
  gamification,
  gamificationLoading,
  gamificationUnavailable,
  isOnline,
  onGoOffline,
  onGoOnline,
  onAvailabilityPress,
  onOpenLiveMap,
  onRetryData,
  profile,
  profileLoading,
  profileUnavailable,
  recentJobsLoading,
  recentJobsUnavailable,
  todayDeliveries,
  toggling,
  user,
  wallet,
  walletLoading,
  walletUnavailable,
}: {
  dataError: boolean;
  gamification: any;
  gamificationLoading: boolean;
  gamificationUnavailable: boolean;
  isOnline: boolean;
  onGoOffline: () => void;
  onGoOnline: () => void;
  onAvailabilityPress: () => void;
  onOpenLiveMap: () => void;
  onRetryData: () => void;
  profile: any;
  profileLoading: boolean;
  profileUnavailable: boolean;
  recentJobsLoading: boolean;
  recentJobsUnavailable: boolean;
  todayDeliveries: number;
  toggling: boolean;
  user: any;
  wallet: any;
  walletLoading: boolean;
  walletUnavailable: boolean;
}) {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const currency = String(wallet?.currency ?? 'GHS').toUpperCase();
  const balance = walletUnavailable ? 'Unavailable' : formatMoneyAmount(Number(wallet?.balance ?? 0), currency);
  const todayEarnings = walletUnavailable
    ? '—'
    : walletLoading && !wallet
      ? '…'
      : formatOverviewEarnings(wallet);
  const rating = Number(profile?.averageRating ?? 0);
  const availabilityLoading = profileLoading && !profile;
  const availabilityState = profileUnavailable
    ? 'unavailable'
    : availabilityLoading
      ? 'loading'
      : isOnline
        ? 'online'
        : 'offline';
  const availabilityLabel = availabilityState === 'unavailable'
    ? 'Unavailable'
    : availabilityState === 'loading'
      ? 'Checking'
      : availabilityState === 'online'
        ? 'Online'
        : 'Offline';
  const deliveriesValue = recentJobsUnavailable
    ? '—'
    : recentJobsLoading
      ? '…'
      : String(todayDeliveries);
  const ratingValue = profileUnavailable
    ? '—'
    : availabilityLoading
      ? '…'
      : rating > 0
        ? rating.toFixed(1)
        : 'New';
  const firstName = String(user?.firstName ?? 'Rider').trim() || 'Rider';
  const levelName = gamificationUnavailable
    ? 'Unavailable'
    : gamificationLoading && !gamification
      ? 'Checking…'
      : String(gamification?.levelName ?? 'Rookie');
  const totalXp = gamificationUnavailable
    ? '—'
    : gamificationLoading && !gamification
      ? '…'
      : String(gamification?.totalXp ?? gamification?.xp ?? 0);
  const levelProgress = Math.max(0, Math.min(100, Number(gamification?.progressPercent ?? 0)));
  return (
    <View style={homeStyles.dashboard}>
      <View style={homeStyles.greetingArea}>
        <View style={homeStyles.greetingCopy}>
          <Text style={homeStyles.greeting}>{greeting}</Text>
          <Text style={homeStyles.riderName} numberOfLines={1}>
            {firstName} <Text style={homeStyles.wave}>👋</Text>
          </Text>
          <Text style={homeStyles.readyText}>Ready to deliver?</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.84}
          disabled={toggling || availabilityLoading || profileUnavailable}
          onPress={onAvailabilityPress}
          style={homeStyles.availabilityPill}
          accessibilityRole="button"
          accessibilityLabel={`Change availability. Currently ${availabilityLabel.toLowerCase()}`}
        >
          <View style={[homeStyles.availabilityDot, availabilityState !== 'online' ? homeStyles.availabilityDotOffline : null]} />
          <Text style={homeStyles.availabilityText}>{availabilityLabel}</Text>
          <Ionicons name="chevron-down" size={13} color="#717875" />
        </TouchableOpacity>

        <Image source={dashboardHero} resizeMode="contain" style={homeStyles.heroArt} />
      </View>

      {dataError ? <DashboardDataNotice onRetry={onRetryData} /> : null}

      <HomeWalletCard
        balance={balance}
        balanceVisible={balanceVisible}
        loading={walletLoading}
        unavailable={walletUnavailable}
        onAddMoney={() => router.push('/(app)/wallet/add-funds' as any)}
        onCashOut={() => router.push({ pathname: '/(tabs)/earnings', params: { action: 'cash-out' } })}
        onHistory={() => router.push('/(tabs)/earnings')}
        onToggleBalance={() => setBalanceVisible((current) => !current)}
      />

      <View style={homeStyles.overviewSpacing}>
        <HomeOverviewCard
          deliveries={deliveriesValue}
          earnings={todayEarnings}
          rating={ratingValue}
          ratingStarred={!profileUnavailable && !availabilityLoading && rating > 0}
          onViewAll={() => router.push('/(tabs)/earnings')}
        />
      </View>

      <View style={[homeStyles.section, homeStyles.sectionSpacing]}>
        <Text style={homeStyles.sectionTitle}>Go Online &amp; Deliver</Text>
        <HomeOnlineCard
          availabilityState={availabilityState}
          loading={toggling || availabilityLoading}
          onToggle={profileUnavailable ? onRetryData : isOnline ? onGoOffline : onGoOnline}
        />
        {isOnline ? <HomeLiveMapButton onPress={onOpenLiveMap} /> : null}
      </View>

      <View style={[homeStyles.section, homeStyles.sectionSpacing]}>
        <Text style={homeStyles.sectionTitle}>Recommended for You</Text>
        <View style={homeStyles.recommendationRow}>
          <HomeRecommendationTile
            icon="school-outline"
            title="Training"
            body="Train, certify, and build your rider career."
            iconColor="#277AE7"
            iconBackground="#EAF2FF"
            onPress={() => router.push('/(app)/training')}
          />
          <HomeRecommendationTile
            icon="shield-checkmark-outline"
            title="Safety Center"
            body="Safety tools, guidance, and emergency help."
            iconColor="#08A86B"
            iconBackground="#E7F7F0"
            onPress={() => router.push('/(app)/safety')}
          />
          <HomeRecommendationTile
            icon="people-outline"
            title="Community"
            body="Connect with other riders in your city."
            iconColor="#D99A13"
            iconBackground="#FFF4D8"
            onPress={() => router.push('/(tabs)/community')}
          />
          <HomeRecommendationTile
            icon="bicycle-outline"
            title="Asset Financing"
            body="Explore a 12-month bike or EV lease."
            iconColor="#7C3AED"
            iconBackground="#F0EBFF"
            onPress={() => router.push('/(app)/asset-financing')}
          />
        </View>
      </View>

      <HomeLevelProgress
        levelName={levelName}
        progress={levelProgress}
        totalXp={totalXp}
        unavailable={gamificationUnavailable}
        onPress={() => router.push('/(app)/gamification')}
      />
    </View>
  );
}

function DashboardDataNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={homeStyles.dataNotice} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color="#8A5706" />
      <Text style={homeStyles.dataNoticeText}>Some live dashboard data is unavailable.</Text>
      <TouchableOpacity
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Retry dashboard data"
        onPress={onRetry}
        style={homeStyles.dataNoticeButton}
      >
        <Text style={homeStyles.dataNoticeButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function HomeWalletCard({
  balance,
  balanceVisible,
  loading,
  onAddMoney,
  onCashOut,
  onHistory,
  onToggleBalance,
  unavailable,
}: {
  balance: string;
  balanceVisible: boolean;
  loading: boolean;
  onAddMoney: () => void;
  onCashOut: () => void;
  onHistory: () => void;
  onToggleBalance: () => void;
  unavailable: boolean;
}) {
  return (
    <View style={homeStyles.walletCard}>
      <View style={homeStyles.walletGlowLarge} />
      <View style={homeStyles.walletGlowSmall} />
      <Image source={dashboardWallet} resizeMode="contain" style={homeStyles.walletArtwork} />

      <View style={homeStyles.walletHeading}>
        <Text style={homeStyles.walletLabel}>Wallet Balance</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={unavailable ? 'Wallet balance unavailable' : balanceVisible ? 'Hide wallet balance' : 'Show wallet balance'}
          disabled={unavailable}
          hitSlop={8}
          onPress={onToggleBalance}
        >
          <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <Text style={homeStyles.walletBalance} numberOfLines={1}>
        {loading ? '...' : unavailable ? 'Unavailable' : balanceVisible ? balance : '••••••'}
      </Text>

      <View style={homeStyles.walletDivider} />
      <View style={homeStyles.walletActions}>
        <HomeWalletAction flex={0.95} icon="cash-outline" label="Add Money" onPress={onAddMoney} />
        <HomeWalletAction flex={0.95} icon="share-outline" label="Cash Out" onPress={onCashOut} divided />
        <HomeWalletAction flex={1.3} icon="receipt-outline" label="Transaction History" onPress={onHistory} divided />
      </View>
    </View>
  );
}

function HomeWalletAction({
  divided,
  flex,
  icon,
  label,
  onPress,
}: {
  divided?: boolean;
  flex: number;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[homeStyles.walletAction, { flex }, divided ? homeStyles.walletActionDivided : null]}
    >
      <Ionicons name={icon} size={17} color="#FFFFFF" />
      <Text style={homeStyles.walletActionText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function HomeOverviewCard({
  deliveries,
  earnings,
  onViewAll,
  rating,
  ratingStarred,
}: {
  deliveries: string;
  earnings: string;
  onViewAll: () => void;
  rating: string;
  ratingStarred: boolean;
}) {
  return (
    <View style={homeStyles.overviewCard}>
      <View style={homeStyles.overviewHeader}>
        <Text style={homeStyles.overviewTitle}>Today’s Overview</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={onViewAll}>
          <Text style={homeStyles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>
      <View style={homeStyles.metricRow}>
        <HomeMetric icon="bag-handle" label="Deliveries" value={deliveries} />
        <View style={homeStyles.metricDivider} />
        <HomeMetric icon="wallet" label="Earnings" value={earnings} />
        <View style={homeStyles.metricDivider} />
        <HomeMetric icon="star" label="Rating" value={rating} starred={ratingStarred} />
      </View>
    </View>
  );
}

function HomeMetric({
  icon,
  label,
  starred,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  starred?: boolean;
  value: string;
}) {
  return (
    <View style={homeStyles.metric}>
      <View style={homeStyles.metricIcon}>
        <Ionicons name={icon} size={18} color="#08A568" />
      </View>
      <Text style={homeStyles.metricLabel}>{label}</Text>
      <View style={homeStyles.metricValueRow}>
        {starred ? <Ionicons name="star" size={15} color="#08A568" /> : null}
        <Text style={[homeStyles.metricValue, value.length > 12 ? homeStyles.metricValueCompact : null]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function HomeOnlineCard({
  availabilityState,
  loading,
  onToggle,
}: {
  availabilityState: 'loading' | 'unavailable' | 'online' | 'offline';
  loading: boolean;
  onToggle: () => void;
}) {
  const isOnline = availabilityState === 'online';
  const unavailable = availabilityState === 'unavailable';
  const title = unavailable
    ? 'Availability unavailable'
    : availabilityState === 'loading'
      ? 'Checking availability'
      : isOnline
        ? 'You are Online'
        : 'You are Offline';
  const body = unavailable
    ? 'Reconnect and retry before changing your status.'
    : availabilityState === 'loading'
      ? 'Confirming your current Rider status.'
      : isOnline
        ? 'You’re all set to receive delivery requests.'
        : 'Go online when you’re ready to receive requests.';

  return (
    <View style={homeStyles.onlineCard}>
      <View style={homeStyles.onlinePulseOuter}>
        <View style={homeStyles.onlinePulseInner}>
          <Ionicons name="radio" size={25} color="#FFFFFF" />
        </View>
      </View>
      <View style={homeStyles.onlineCopy}>
        <View style={homeStyles.onlineTitleRow}>
          <Text style={homeStyles.onlineTitle}>{title}</Text>
          <View style={[homeStyles.onlineTitleDot, !isOnline ? homeStyles.availabilityDotOffline : null]} />
        </View>
        <Text style={homeStyles.onlineBody} numberOfLines={2}>
          {body}
        </Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.86}
        disabled={loading}
        onPress={onToggle}
        style={[homeStyles.onlineButton, loading ? homeStyles.disabledButton : null]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={homeStyles.onlineButtonText}>{unavailable ? 'Retry' : isOnline ? 'Go Offline' : 'Go Online'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function HomeRecommendationTile({
  body,
  icon,
  iconBackground,
  iconColor,
  onPress,
  title,
}: {
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBackground: string;
  iconColor: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={homeStyles.recommendationTile}
    >
      <View style={[homeStyles.recommendationIcon, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={21} color={iconColor} />
      </View>
      <Text style={homeStyles.recommendationTitle}>{title}</Text>
      <Text style={homeStyles.recommendationBody}>{body}</Text>
      <Ionicons name="chevron-forward" size={17} color="#777F7B" style={homeStyles.recommendationArrow} />
    </TouchableOpacity>
  );
}

function HomeLiveMapButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      accessibilityRole="button"
      accessibilityLabel="Open live delivery map"
      onPress={onPress}
      style={homeStyles.liveMapButton}
    >
      <Ionicons name="map" size={21} color={riderColors.greenDark} />
      <Text style={homeStyles.liveMapButtonText}>Open live delivery map</Text>
    </TouchableOpacity>
  );
}

function HomeLevelProgress({
  levelName,
  onPress,
  progress,
  totalXp,
  unavailable,
}: {
  levelName: string;
  onPress: () => void;
  progress: number;
  totalXp: string;
  unavailable: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      accessibilityRole="button"
      accessibilityLabel={unavailable ? 'Level progress unavailable. Open progress hub.' : `${levelName}. ${totalXp} XP. Open progress hub.`}
      onPress={onPress}
      style={homeStyles.levelCard}
    >
      <View style={homeStyles.levelHeader}>
        <View style={{ flex: 1 }}>
          <Text style={homeStyles.levelTitle}>Level progress</Text>
          <Text style={homeStyles.levelName}>{levelName}</Text>
        </View>
        <View style={[homeStyles.levelXpPill, unavailable ? homeStyles.levelXpPillUnavailable : null]}>
          <Text style={[homeStyles.levelXpText, unavailable ? homeStyles.levelXpTextUnavailable : null]}>
            {totalXp} XP
          </Text>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>
        <ProgressBar progress={progress} color={riderColors.greenDark} />
      </View>
    </TouchableOpacity>
  );
}

function AvailabilityMenuModal({
  isOnline,
  loading,
  onClose,
  onGoOffline,
  onGoOnline,
  onOpenMap,
  visible,
}: {
  isOnline: boolean;
  loading: boolean;
  onClose: () => void;
  onGoOffline: () => void;
  onGoOnline: () => void;
  onOpenMap: () => void;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,15,10,0.48)' }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close availability menu" activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={{ backgroundColor: riderColors.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 18, paddingBottom: Math.max(insets.bottom, 18) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>Availability</Text>
              <Text style={{ color: riderColors.muted, fontSize: 12, marginTop: 3 }}>
                You are currently {isOnline ? 'online and receiving offers' : 'offline'}.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: riderColors.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={21} color={riderColors.ink} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 10, marginTop: 18 }}>
            {isOnline ? (
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={loading}
                onPress={onOpenMap}
                style={{ minHeight: 56, borderRadius: 16, backgroundColor: riderColors.greenDark, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Ionicons name="map-outline" size={23} color={riderColors.white} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.white, fontSize: 14, fontWeight: '900' }}>Open live map</Text>
                  <Text style={{ color: '#DDF6EA', fontSize: 11, marginTop: 2 }}>View your position while waiting for offers</Text>
                </View>
                <Ionicons name="chevron-forward" size={19} color={riderColors.white} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={loading}
                onPress={onGoOnline}
                style={{ minHeight: 56, borderRadius: 16, backgroundColor: riderColors.greenDark, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                {loading ? <ActivityIndicator color={riderColors.white} /> : <Ionicons name="radio-outline" size={23} color={riderColors.white} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.white, fontSize: 14, fontWeight: '900' }}>Go online</Text>
                  <Text style={{ color: '#DDF6EA', fontSize: 11, marginTop: 2 }}>Start receiving nearby delivery offers</Text>
                </View>
              </TouchableOpacity>
            )}

            {isOnline ? (
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={loading}
                onPress={onGoOffline}
                style={{ minHeight: 54, borderRadius: 16, backgroundColor: riderColors.white, borderWidth: 1, borderColor: riderColors.line, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                {loading ? <ActivityIndicator color={riderColors.ink} /> : <Ionicons name="power-outline" size={22} color={riderColors.ink} />}
                <Text style={{ flex: 1, color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>Go offline</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const homeStyles = StyleSheet.create({
  dashboard: {
    paddingTop: 0,
    gap: 0,
  },
  greetingArea: {
    height: 128,
    position: 'relative',
    overflow: 'hidden',
  },
  greetingCopy: {
    position: 'absolute',
    top: 10,
    left: 0,
    zIndex: 2,
    maxWidth: '56%',
  },
  greeting: {
    color: '#3E4541',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: riderFonts.medium,
    fontWeight: '500',
  },
  riderName: {
    color: '#080A09',
    fontSize: 29,
    lineHeight: 35,
    fontFamily: riderFonts.extrabold,
    fontWeight: '900',
    marginTop: 3,
  },
  wave: {
    fontSize: 23,
  },
  readyText: {
    color: '#777E7A',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: riderFonts.regular,
    fontWeight: '500',
    marginTop: 5,
  },
  availabilityPill: {
    position: 'absolute',
    zIndex: 3,
    top: 2,
    right: 2,
    minWidth: 78,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6ECE9',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    shadowColor: '#0C1812',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0AB36C',
  },
  availabilityDotOffline: {
    backgroundColor: '#9AA19D',
  },
  availabilityText: {
    color: '#313633',
    fontSize: 11,
    fontFamily: riderFonts.semibold,
    fontWeight: '700',
  },
  heroArt: {
    position: 'absolute',
    right: -8,
    bottom: -4,
    width: '82%',
    height: 126,
  },
  dataNotice: {
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#F1D59B',
    backgroundColor: '#FFF8E8',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dataNoticeText: {
    flex: 1,
    color: '#68430A',
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
  },
  dataNoticeButton: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataNoticeButtonText: {
    color: '#68430A',
    fontSize: 10.5,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  walletCard: {
    height: 125,
    borderRadius: 11,
    backgroundColor: '#06A65F',
    overflow: 'hidden',
    paddingTop: 12,
    paddingHorizontal: 15,
    shadowColor: '#057647',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  walletGlowLarge: {
    position: 'absolute',
    width: 145,
    height: 145,
    borderRadius: 73,
    right: -42,
    top: -31,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  walletGlowSmall: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    right: 23,
    top: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  walletArtwork: {
    position: 'absolute',
    right: 14,
    top: 15,
    width: 68,
    height: 68,
    opacity: 0.5,
  },
  walletHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  walletLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: riderFonts.medium,
    fontWeight: '500',
  },
  walletBalance: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 31,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
    marginTop: 2,
    maxWidth: '72%',
  },
  walletDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.23)',
    marginTop: 7,
  },
  walletActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletAction: {
    flex: 1,
    height: 31,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 3,
  },
  walletActionDivided: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.22)',
  },
  walletActionText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
  },
  overviewCard: {
    height: 123,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F3F1',
    paddingTop: 12,
    paddingHorizontal: 13,
    paddingBottom: 10,
    shadowColor: '#15231C',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 13,
    elevation: 3,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  overviewTitle: {
    color: '#171A18',
    fontSize: 13,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  viewAll: {
    color: '#08A568',
    fontSize: 11,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
  },
  metricRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  metricDivider: {
    width: 1,
    height: 58,
    backgroundColor: '#EDF1EF',
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F8F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    color: '#737A76',
    fontSize: 10.5,
    fontFamily: riderFonts.regular,
    fontWeight: '500',
    marginTop: 4,
  },
  metricValueRow: {
    minHeight: 20,
    maxWidth: '96%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 1,
  },
  metricValue: {
    color: '#111412',
    fontSize: 15,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  metricValueCompact: {
    fontSize: 11.5,
  },
  section: {
    gap: 7,
  },
  overviewSpacing: {
    marginTop: 14,
  },
  sectionSpacing: {
    marginTop: 14,
  },
  sectionTitle: {
    color: '#151817',
    fontSize: 15,
    lineHeight: 20,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  onlineCard: {
    minHeight: 70,
    borderRadius: 11,
    backgroundColor: '#F1FBF6',
    borderWidth: 1,
    borderColor: '#E6F5ED',
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlinePulseOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#D9F4E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  onlinePulseInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#08A866',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 7,
  },
  onlineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  onlineTitle: {
    color: '#171A18',
    fontSize: 12.5,
    fontFamily: riderFonts.bold,
    fontWeight: '800',
  },
  onlineTitleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#08AE68',
  },
  onlineBody: {
    color: '#717975',
    fontSize: 9.8,
    lineHeight: 14,
    fontFamily: riderFonts.regular,
    marginTop: 3,
    maxWidth: 145,
  },
  onlineButton: {
    minWidth: 91,
    height: 39,
    borderRadius: 8,
    backgroundColor: '#07A562',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.62,
  },
  onlineButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '700',
  },
  liveMapButton: {
    minHeight: 54,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E2EAE6',
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: '#17241E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  liveMapButtonText: {
    color: '#07975F',
    fontSize: 12.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
  },
  recommendationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recommendationTile: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 0,
    minHeight: 132,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F0',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 26,
    alignItems: 'center',
    shadowColor: '#17241E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  recommendationIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationTitle: {
    color: '#171A18',
    fontSize: 11,
    lineHeight: 14,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
  },
  recommendationBody: {
    color: '#737A76',
    fontSize: 10.5,
    lineHeight: 14,
    fontFamily: riderFonts.regular,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 3,
    paddingHorizontal: 1,
  },
  recommendationArrow: {
    position: 'absolute',
    right: 6,
    bottom: 8,
  },
  levelCard: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EEEB',
    padding: 15,
    marginTop: 16,
    marginBottom: 2,
    shadowColor: '#17241E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  levelTitle: {
    color: '#171A18',
    fontSize: 14,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  levelName: {
    color: '#737A76',
    fontSize: 11,
    fontFamily: riderFonts.regular,
    marginTop: 3,
  },
  levelXpPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#B9EBD4',
    backgroundColor: '#EAF8F1',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelXpPillUnavailable: {
    borderColor: '#D8DEDB',
    backgroundColor: '#F3F5F4',
  },
  levelXpText: {
    color: '#07975F',
    fontSize: 10.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
  levelXpTextUnavailable: {
    color: '#737A76',
  },
});

function OnlineDashboard({
  areaName,
  bottomInset,
  onBack,
  onAvailability,
  onGoOffline,
  onNotifications,
  onlineFor,
  riderPosition,
  todayAmount,
  toggling,
  unread,
}: {
  areaName: string;
  bottomInset: number;
  onBack: () => void;
  onAvailability: () => void;
  onGoOffline: () => void;
  onNotifications: () => void;
  onlineFor: string;
  riderPosition: LatLng | null;
  todayAmount: string;
  toggling: boolean;
  unread: boolean;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: riderColors.white }}>
      <OnlineTopBar onAvailability={onAvailability} onBack={onBack} onNotifications={onNotifications} unread={unread} />

      <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#EAF1EF' }}>
        <LiveLocationCanvas areaName={areaName} position={riderPosition} />

        <OnlineReadySheet
          areaName={areaName}
          bottomInset={bottomInset}
          onStayOnline={() => Toast.show({
            type: 'success',
            text1: 'You are online',
            text2: 'Live location sharing is active for new requests.',
          })}
          onGoOffline={onGoOffline}
          onlineFor={onlineFor}
          todayAmount={todayAmount}
          toggling={toggling}
        />
      </View>
    </View>
  );
}

function LiveLocationCanvas({
  areaName,
  position,
}: {
  areaName: string;
  position: LatLng | null;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`Live location sharing ${position ? 'active' : 'starting'} in ${areaName}`}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', backgroundColor: '#EFF8F3' }}
    >
      <View style={{ position: 'absolute', width: '150%', height: 36, top: 70, left: '-25%', backgroundColor: '#FFFFFF', transform: [{ rotate: '-12deg' }] }} />
      <View style={{ position: 'absolute', width: '150%', height: 22, top: 175, left: '-20%', backgroundColor: '#DCEDE5', transform: [{ rotate: '22deg' }] }} />
      <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, top: 58, right: -70, backgroundColor: 'rgba(64,190,137,0.08)' }} />
      <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, top: 120, left: -58, backgroundColor: 'rgba(64,190,137,0.10)' }} />

      <View style={{ alignSelf: 'center', marginTop: 24, borderRadius: 999, borderWidth: 1, borderColor: '#CDE8DB', backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7, ...riderShadow }}>
        <Ionicons name="location" size={15} color={riderColors.greenDark} />
        <Text style={{ color: riderColors.ink, fontSize: 12, fontWeight: '900' }} numberOfLines={1}>{areaName}</Text>
      </View>

      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <RiderPulseMarker />
        <View style={{ marginTop: -8, borderRadius: 14, backgroundColor: riderColors.white, borderWidth: 1, borderColor: riderColors.line, paddingHorizontal: 13, paddingVertical: 8, alignItems: 'center', ...riderShadow }}>
          <Text style={{ color: riderColors.greenDark, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>
            {position ? 'Location active' : 'Finding location'}
          </Text>
          <Text style={{ color: riderColors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 }}>
            {position
              ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
              : 'Keep location services turned on'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function OnlineTopBar({
  onAvailability,
  onBack,
  onNotifications,
  unread,
}: {
  onAvailability: () => void;
  onBack: () => void;
  onNotifications: () => void;
  unread: boolean;
}) {
  return (
    <View style={{ height: 72, backgroundColor: riderColors.white, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.82} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="arrow-back" size={27} color={riderColors.ink} />
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Change availability. Currently online" activeOpacity={0.86} onPress={onAvailability} style={{ minWidth: 142, height: 44, borderRadius: 22, borderWidth: 1, borderColor: riderColors.line, backgroundColor: riderColors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, ...riderShadow }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B66B' }} />
        <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '700' }}>Online</Text>
        <Ionicons name="chevron-down" size={20} color={riderColors.soft} />
      </TouchableOpacity>

      <TouchableOpacity onPress={onNotifications} activeOpacity={0.82} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="notifications-outline" size={28} color={riderColors.ink} />
        {unread ? <View style={{ position: 'absolute', top: 8, right: 7, width: 14, height: 14, borderRadius: 7, backgroundColor: riderColors.red, borderWidth: 2, borderColor: riderColors.white }} /> : null}
      </TouchableOpacity>
    </View>
  );
}

function RiderPulseMarker() {
  return (
    <View style={{ width: 138, height: 150, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 136, height: 136, borderRadius: 68, backgroundColor: 'rgba(64,190,137,0.15)' }} />
      <View style={{ position: 'absolute', width: 102, height: 102, borderRadius: 51, backgroundColor: 'rgba(64,190,137,0.20)' }} />
      <View style={{ position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(64,190,137,0.28)' }} />
      <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: riderColors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DCEBE4', ...riderShadow }}>
        <MaterialCommunityIcons name="motorbike" size={31} color={riderColors.ink} />
      </View>
      <View style={{ width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: riderColors.greenDark, marginTop: -4 }} />
    </View>
  );
}

function OnlineReadySheet({
  areaName,
  bottomInset,
  onStayOnline,
  onGoOffline,
  onlineFor,
  todayAmount,
  toggling,
}: {
  areaName: string;
  bottomInset: number;
  onStayOnline: () => void;
  onGoOffline: () => void;
  onlineFor: string;
  todayAmount: string;
  toggling: boolean;
}) {
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom: 0, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: riderColors.white, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(bottomInset, 18), ...riderShadow }}>
      <View style={{ alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#C8D0CC', marginBottom: 16 }} />

      <View style={{ alignItems: 'center', paddingHorizontal: 8 }}>
        <Text style={{ color: riderColors.ink, fontSize: 22, lineHeight: 27, fontWeight: '900', textAlign: 'center' }} numberOfLines={1}>
          You are live
        </Text>
        <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
          Waiting for your next request
        </Text>
      </View>

      <View style={{ height: 1, backgroundColor: riderColors.line, marginTop: 15, marginBottom: 14 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 17 }}>
        <ReadyStat icon="wallet" label="Today" value={todayAmount} />
        <View style={{ width: 1, height: 52, backgroundColor: riderColors.line }} />
        <ReadyStat icon="time" label="Online" value={onlineFor} />
        <View style={{ width: 1, height: 52, backgroundColor: riderColors.line }} />
        <ReadyStat icon="location" label="Area" value={areaName} />
      </View>

      <TouchableOpacity activeOpacity={0.88} onPress={onStayOnline} style={{ height: 50, borderRadius: 15, backgroundColor: riderColors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
        <Ionicons name="radio" size={20} color={riderColors.greenDark} />
        <Text style={{ color: riderColors.white, fontSize: 16, fontWeight: '900' }}>Stay Online</Text>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.86} disabled={toggling} onPress={onGoOffline} style={{ height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#B8E9D1', backgroundColor: riderColors.white, alignItems: 'center', justifyContent: 'center' }}>
        {toggling ? <ActivityIndicator color={riderColors.greenDark} /> : <Text style={{ color: riderColors.greenDark, fontSize: 16, fontWeight: '900' }}>Go Offline</Text>}
      </TouchableOpacity>
    </View>
  );
}

function ReadyStat({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 5 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={riderColors.greenDark} />
      </View>
      <View style={{ minWidth: 0 }}>
        <Text style={{ color: riderColors.muted, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
        <Text style={{ color: riderColors.ink, fontSize: value.length > 9 ? 11 : 13, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function LocationDisclosureModal({
  visible,
  loading,
  onDecline,
  onContinue,
}: {
  visible: boolean;
  loading: boolean;
  onDecline: () => void;
  onContinue: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={{ flex: 1, backgroundColor: 'rgba(5,5,5,0.58)', paddingHorizontal: 18, justifyContent: 'center' }}>
        <View style={{ borderRadius: 28, backgroundColor: riderColors.white, padding: 20, ...riderShadow }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Ionicons name="location" size={24} color={riderColors.greenDark} />
          </View>
          <Text style={{ color: riderColors.ink, fontSize: 19, fontWeight: '900', marginBottom: 8 }}>
            Background location
          </Text>
          <Text style={{ color: riderColors.muted, fontSize: 14, lineHeight: 20, marginBottom: 18 }}>
            RiderGuy Rider collects location in the background — when the app is closed or not in
            use — to share your live location with customers and support during active deliveries
            and to match you with nearby jobs while you are online. Tracking stops when you go
            offline.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity activeOpacity={0.86} disabled={loading} onPress={onDecline} style={{ flex: 1, height: 52, borderRadius: 15, borderWidth: 1, borderColor: riderColors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: riderColors.white }}>
              <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.88} disabled={loading} onPress={onContinue} style={{ flex: 1.3, height: 52, borderRadius: 15, backgroundColor: riderColors.greenDark, alignItems: 'center', justifyContent: 'center' }}>
              {loading ? <ActivityIndicator color={riderColors.white} /> : <Text style={{ color: riderColors.white, fontSize: 15, fontWeight: '900' }}>Allow location</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function IncomingRequestModal({
  offer,
  onAccept,
  onDecline,
  responding,
  timeLeft,
}: {
  offer: IncomingOffer | null;
  onAccept: () => void;
  onDecline: () => void;
  responding: boolean;
  timeLeft: number;
}) {
  const progress = Math.max(0, (timeLeft / OFFER_TIMEOUT) * 100);
  const amount = formatMoneyAmount(Number(offer?.riderEarnings ?? offer?.earnings ?? 0), offer?.currency ?? 'GHS');
  const distance = Number(offer?.distanceKm ?? 0);
  const duration = offer?.estimatedDurationMinutes ?? offer?.durationMinutes ?? '?';

  return (
    <Modal visible={Boolean(offer)} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={{ flex: 1, backgroundColor: 'rgba(5,5,5,0.58)', paddingHorizontal: 18, justifyContent: 'center' }}>
        <View style={{ borderRadius: 28, backgroundColor: riderColors.white, padding: 16, ...riderShadow }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: riderColors.greenDark, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flash" size={22} color={riderColors.white} />
              </View>
              <View>
                <Text style={{ color: riderColors.greenDark, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>New request</Text>
                <Text style={{ color: riderColors.ink, fontSize: 19, fontWeight: '900', marginTop: 1 }}>Delivery offer</Text>
              </View>
            </View>
            <View style={{ borderRadius: 999, backgroundColor: riderColors.greenSoft, borderWidth: 1, borderColor: '#B9EBD4', paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: riderColors.greenDark, fontSize: 12, fontWeight: '900' }}>{timeLeft}s</Text>
            </View>
          </View>

          <ProgressBar progress={progress} color={progress < 35 ? riderColors.red : riderColors.greenDark} />

          <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 13 }}>
            <Text style={{ color: riderColors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Estimated payout</Text>
            <Text style={{ color: riderColors.ink, fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>{amount}</Text>
          </View>

          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: riderColors.line, backgroundColor: riderColors.greenMist, padding: 12, gap: 11 }}>
            <RequestRoute color={riderColors.greenDark} label="Pickup" value={offer?.pickupAddress ?? 'Pickup location'} />
            <View style={{ height: 1, backgroundColor: riderColors.line, marginLeft: 28 }} />
            <RequestRoute color={riderColors.red} label="Dropoff" value={offer?.dropoffAddress ?? 'Dropoff location'} square />
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <OfferChip icon="navigate" label={distance > 0 ? `${distance.toFixed(1)} km` : 'Nearby'} />
            <OfferChip icon="time" label={`${duration} min`} />
            <OfferChip icon="cube" label={cleanLabel(offer?.packageType)} />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
            <TouchableOpacity activeOpacity={0.86} disabled={responding} onPress={onDecline} style={{ flex: 1, height: 52, borderRadius: 15, borderWidth: 1, borderColor: riderColors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: riderColors.white }}>
              <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.88} disabled={responding} onPress={onAccept} style={{ flex: 1.45, height: 52, borderRadius: 15, backgroundColor: riderColors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {responding ? <ActivityIndicator color={riderColors.white} /> : <Ionicons name="checkmark-circle" size={21} color={riderColors.white} />}
              <Text style={{ color: riderColors.white, fontSize: 16, fontWeight: '900' }}>{responding ? 'Accepting' : 'Accept'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RequestRoute({
  color,
  label,
  square,
  value,
}: {
  color: string;
  label: string;
  square?: boolean;
  value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 18, height: 18, borderRadius: square ? 5 : 9, backgroundColor: color, borderWidth: 3, borderColor: riderColors.white }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: riderColors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{label}</Text>
        <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function OfferChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, borderRadius: 13, backgroundColor: riderColors.panelAlt, borderWidth: 1, borderColor: riderColors.line, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }}>
      <Ionicons name={icon} size={14} color={riderColors.greenDark} />
      <Text style={{ color: riderColors.ink, fontSize: 11, fontWeight: '900' }} numberOfLines={1}>{label}</Text>
    </View>
  );
}
