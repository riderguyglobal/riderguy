import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Image,
  ImageBackground,
  type ImageSourcePropType,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { io, type Socket } from 'socket.io-client';
import { tokenStorage, useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import Toast from 'react-native-toast-message';
import {
  BrandHeader,
  ProgressBar,
  RiderCard,
  StatusPill,
} from '@/components/rider-ui';
import { cleanLabel, riderColors, riderShadow } from '@/lib/rider-design';

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

const BACKGROUND_LOCATION_TASK = 'background-location-task';
const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://api.myriderguy.com')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.myriderguy.com/api/v1')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');
const ACTIVE_STATUSES = new Set(['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF']);
const LOCATION_TIMEOUT_MS = 8000;
const OFFER_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_RIDER_OFFER_COUNTDOWN ?? '30', 10);
const ACCRA_CENTER = { latitude: 5.6037, longitude: -0.1870 };
const DEFAULT_TAB_BAR_STYLE = {
  borderTopWidth: 1,
  borderTopColor: '#EDF2EF',
  backgroundColor: riderColors.white,
  height: 78,
  paddingTop: 9,
  paddingBottom: 12,
};

const heroReady = require('../../assets/images/illustrations/rider-fleet.png');
const referImage = require('../../assets/images/illustrations/rider-workplace.png');
const academyImage = require('../../assets/images/illustrations/rider-academy.png');
const payoutsImage = require('../../assets/images/illustrations/rider-earnings.png');
const supportImage = require('../../assets/images/illustrations/rider-support.png');

const RIDER_MAP_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#F3F6F5' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#D8E0E5' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#CBD7E5' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8E9894' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F8FAF9' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#E8F6EC' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D8EEF8' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#7B8580' }] },
];

async function getUsablePosition() {
  const current = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
  ]).catch(() => null);

  if (current) return current;

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 5 * 60 * 1000,
    requiredAccuracy: 1000,
  }).catch(() => null);

  if (lastKnown) return lastKnown;

  throw new Error('Could not get your location. Please check location services and try again.');
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

function waitingRegion(position: LatLng) {
  return {
    latitude: position.latitude - 0.01,
    longitude: position.longitude,
    latitudeDelta: 0.058,
    longitudeDelta: 0.058,
  };
}

function formatOnlineDuration(startedAt: number | null, now: number) {
  if (!startedAt) return 'Ready';
  const minutes = Math.max(0, Math.floor((now - startedAt) / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function inferAreaName(profile: any, position: LatLng) {
  const direct = profile?.currentZone?.name ?? profile?.currentZoneName ?? profile?.zoneName ?? profile?.city ?? profile?.market;
  if (direct) return cleanLabel(String(direct));

  if (position.latitude >= 4.75 && position.latitude <= 5.35 && position.longitude >= -2.25 && position.longitude <= -1.45) {
    return 'Takoradi';
  }
  if (position.latitude >= 5.45 && position.latitude <= 5.75 && position.longitude >= -0.35 && position.longitude <= 0.05) {
    return 'Accra';
  }
  return 'Takoradi';
}

function formatTodayAmount(wallet: any) {
  const amount = Number(wallet?.todayEarnings ?? wallet?.earningsToday ?? wallet?.todayTotal ?? 0);
  const currency = String(wallet?.currency ?? 'GHS').toUpperCase();
  return formatMoneyAmount(amount, currency);
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
      const token = await tokenStorage.getAccessToken();
      if (!token) return;
      await fetch(`${API_URL}/riders/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
      });
    } catch {}
  });
}

export default function RiderHomeScreen() {
  const { api } = useAuth();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<IncomingOffer | null>(null);
  const [offerTimeLeft, setOfferTimeLeft] = useState(OFFER_TIMEOUT);
  const [respondingOffer, setRespondingOffer] = useState(false);
  const [onlineStartedAt, setOnlineStartedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const [requestingBackgroundLocation, setRequestingBackgroundLocation] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);

  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = useQuery({
    queryKey: ['rider-wallet'],
    queryFn: async () => {
      const { data } = await api.get('/wallets');
      return data.data ?? data;
    },
  });

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['rider-profile'],
    queryFn: async () => {
      const { data } = await api.get('/riders/profile');
      return data.data ?? data;
    },
  });

  const { data: availableJobs, refetch: refetchAvailableJobs } = useQuery({
    queryKey: ['jobs-available'],
    queryFn: async () => {
      const { data } = await api.get('/orders/available');
      return (data.data ?? data) as any[];
    },
    enabled: isOnline,
    refetchInterval: isOnline ? 9000 : false,
    retry: false,
  });

  const { data: activeJobs } = useQuery({
    queryKey: ['jobs-active'],
    queryFn: async () => {
      const { data } = await api.get('/orders?limit=40');
      const jobs = (data.data ?? data) as any[];
      return jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).slice(0, 10);
    },
    refetchInterval: 6000,
  });

  const { data: gamification } = useQuery({
    queryKey: ['gamification-profile'],
    queryFn: async () => {
      const { data } = await api.get('/gamification/profile');
      return data.data ?? data;
    },
  });

  useEffect(() => {
    setIsOnline(profile?.availability === 'ONLINE' || profile?.availability === 'ON_DELIVERY');
  }, [profile?.availability]);

  useEffect(() => {
    setOnlineStartedAt((current) => (isOnline ? current ?? Date.now() : null));
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return undefined;
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
      tabBarStyle: isOnline ? { display: 'none' } : DEFAULT_TAB_BAR_STYLE,
    });

    return () => {
      navigation.setOptions({ tabBarStyle: DEFAULT_TAB_BAR_STYLE });
    };
  }, [isOnline, navigation]);

  const connectSocket = useCallback(async () => {
    if (socketRef.current?.connected) return;
    const token = await tokenStorage.getAccessToken();
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], auth: { token } });
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

  const goOnline = async () => {
    setTogglingOnline(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Location permission is required.' });
        return;
      }
      const profileLatitude = Number(profile?.currentLatitude);
      const profileLongitude = Number(profile?.currentLongitude);
      const fallbackPosition = Number.isFinite(profileLatitude) && Number.isFinite(profileLongitude)
        ? { latitude: profileLatitude, longitude: profileLongitude }
        : ACCRA_CENTER;
      const current = await getUsablePosition().catch(() => null);
      const startingPosition = current?.coords
        ? { latitude: current.coords.latitude, longitude: current.coords.longitude }
        : fallbackPosition;

      await api.patch('/riders/availability', {
        availability: 'ONLINE',
        latitude: startingPosition.latitude,
        longitude: startingPosition.longitude,
      });
      setIsOnline(true);
      Toast.show({ type: 'success', text1: 'You are online.' });

      const setupOnlineServices = async () => {
        locationWatchRef.current?.remove();
        locationWatchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 9000, distanceInterval: 25 },
          (loc) => {
            socketRef.current?.emit('rider:updateLocation', {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading,
              speed: loc.coords.speed,
            });
          },
        );

        await activateKeepAwakeAsync();
        await connectSocket();

        // Background location requires a prominent in-app disclosure (Play policy)
        // shown before the OS "Allow all the time" prompt — see LocationDisclosureModal.
        const { status: existingBackground } = await Location.getBackgroundPermissionsAsync();
        if (existingBackground === 'granted') {
          await startBackgroundLocationUpdates();
        } else {
          setShowLocationDisclosure(true);
        }
      };

      setupOnlineServices().catch(() => {
        Toast.show({
          type: 'info',
          text1: 'Online. Live tracking will retry shortly.',
          text2: 'Keep the app open while the phone warms up GPS.',
        });
      });

      await Promise.allSettled([
        refetchProfile(),
        refetchAvailableJobs(),
        qc.invalidateQueries({ queryKey: ['jobs-available'] }),
      ]);
    } catch (error: any) {
      setIsOnline(false);
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not go online.' });
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
      deactivateKeepAwake();
      setIsOnline(false);
      await refetchProfile();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not go offline.' });
    } finally {
      setTogglingOnline(false);
    }
  };

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
      deactivateKeepAwake();
    };
  }, []);

  const onRefresh = async () => {
    await Promise.all([
      refetchWallet(),
      refetchProfile(),
      refetchAvailableJobs(),
      qc.invalidateQueries({ queryKey: ['jobs-active'] }),
    ]);
  };

  const levelProgress = gamification?.progressPercent ?? (
    gamification?.nextLevelXp ? ((gamification.currentLevelXp ?? 0) / gamification.nextLevelXp) * 100 : 0
  );
  const riderPosition = useMemo<LatLng>(() => {
    const latitude = Number(profile?.currentLatitude);
    const longitude = Number(profile?.currentLongitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
    return ACCRA_CENTER;
  }, [profile?.currentLatitude, profile?.currentLongitude]);
  const areaName = useMemo(() => inferAreaName(profile, riderPosition), [profile, riderPosition]);
  const todayAmount = formatTodayAmount(wallet);
  const onlineFor = formatOnlineDuration(onlineStartedAt, clock);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isOnline ? riderColors.white : riderColors.surface }} edges={['top']}>
      {isOnline ? (
        <OnlineDashboard
          areaName={areaName}
          onGoOffline={goOffline}
          onMenu={() => router.push('/(tabs)/account')}
          onNotifications={() => router.push('/(app)/notifications')}
          onlineFor={onlineFor}
          riderPosition={riderPosition}
          todayAmount={todayAmount}
          toggling={togglingOnline}
        />
      ) : (
        <>
          <BrandHeader
            onMenu={() => router.push('/(tabs)/account')}
            onNotifications={() => router.push('/(app)/notifications')}
            unread
          />
          <ScrollView
            refreshControl={<RefreshControl refreshing={walletLoading} onRefresh={onRefresh} tintColor={riderColors.green} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 28 }}
          >
            <OfflineDashboard
              gamification={gamification}
              levelProgress={levelProgress}
              onGoOnline={goOnline}
              profile={profile}
              toggling={togglingOnline}
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
    </SafeAreaView>
  );
}

function OfflineDashboard({
  gamification,
  levelProgress,
  onGoOnline,
  profile,
  toggling,
}: {
  gamification: any;
  levelProgress: number;
  onGoOnline: () => void;
  profile: any;
  toggling: boolean;
}) {
  return (
    <View style={{ paddingTop: 4, gap: 10 }}>
      <View style={{ marginBottom: 48 }}>
        <ImageBackground
          source={heroReady}
          resizeMode="cover"
          imageStyle={{ borderRadius: 22 }}
          style={{ height: 268, overflow: 'hidden', borderRadius: 22, backgroundColor: riderColors.ink }}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
        </ImageBackground>

        <PowerCircle
          loading={toggling}
          onPress={onGoOnline}
        />
      </View>

      <RecommendedStrip compact />

      <RiderCard style={{ padding: 14, borderRadius: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View>
            <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>Level progress</Text>
            <Text style={{ color: riderColors.muted, fontSize: 11, marginTop: 2 }}>{gamification?.levelName ?? cleanLabel(profile?.onboardingStatus)}</Text>
          </View>
          <StatusPill status="ONLINE" label={`${gamification?.totalXp ?? profile?.totalXp ?? 0} XP`} />
        </View>
        <ProgressBar progress={levelProgress} color={riderColors.greenDark} />
      </RiderCard>
    </View>
  );
}

function OnlineDashboard({
  areaName,
  onGoOffline,
  onMenu,
  onNotifications,
  onlineFor,
  riderPosition,
  todayAmount,
  toggling,
}: {
  areaName: string;
  onGoOffline: () => void;
  onMenu: () => void;
  onNotifications: () => void;
  onlineFor: string;
  riderPosition: LatLng;
  todayAmount: string;
  toggling: boolean;
}) {
  const mapRef = useRef<MapView | null>(null);
  const initialRegion = useMemo(() => waitingRegion(riderPosition), [riderPosition]);
  const regionRef = useRef(initialRegion);

  const animateMap = (nextRegion: typeof initialRegion) => {
    regionRef.current = nextRegion;
    mapRef.current?.animateToRegion(nextRegion, 320);
  };

  return (
    <View style={{ flex: 1, backgroundColor: riderColors.white }}>
      <OnlineTopBar onMenu={onMenu} onNotifications={onNotifications} />

      <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#EAF1EF' }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          initialRegion={initialRegion}
          customMapStyle={RIDER_MAP_STYLE}
          onRegionChangeComplete={(region) => {
            regionRef.current = region;
          }}
          showsCompass={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          <Marker coordinate={riderPosition} anchor={{ x: 0.5, y: 0.58 }} title="You">
            <RiderPulseMarker />
          </Marker>
        </MapView>

        <OnlineReadySheet
          areaName={areaName}
          onCenterMap={() => animateMap(waitingRegion(riderPosition))}
          onGoOffline={onGoOffline}
          onlineFor={onlineFor}
          todayAmount={todayAmount}
          toggling={toggling}
        />
      </View>
    </View>
  );
}

function OnlineTopBar({
  onMenu,
  onNotifications,
}: {
  onMenu: () => void;
  onNotifications: () => void;
}) {
  return (
    <View style={{ height: 72, backgroundColor: riderColors.white, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <TouchableOpacity onPress={onMenu} activeOpacity={0.82} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="menu" size={30} color={riderColors.ink} />
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.86} onPress={() => router.push('/(tabs)/jobs')} style={{ minWidth: 142, height: 44, borderRadius: 22, borderWidth: 1, borderColor: riderColors.line, backgroundColor: riderColors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, ...riderShadow }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B66B' }} />
        <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '700' }}>Online</Text>
        <Ionicons name="chevron-down" size={20} color={riderColors.soft} />
      </TouchableOpacity>

      <TouchableOpacity onPress={onNotifications} activeOpacity={0.82} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="notifications-outline" size={28} color={riderColors.ink} />
        <View style={{ position: 'absolute', top: 8, right: 7, width: 14, height: 14, borderRadius: 7, backgroundColor: riderColors.red }} />
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
  onCenterMap,
  onGoOffline,
  onlineFor,
  todayAmount,
  toggling,
}: {
  areaName: string;
  onCenterMap: () => void;
  onGoOffline: () => void;
  onlineFor: string;
  todayAmount: string;
  toggling: boolean;
}) {
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom: 0, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: riderColors.white, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18, ...riderShadow }}>
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

      <TouchableOpacity activeOpacity={0.88} onPress={onCenterMap} style={{ height: 50, borderRadius: 15, backgroundColor: riderColors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
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

function PowerCircle({
  loading,
  onPress,
}: {
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={loading}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go online"
      style={{ position: 'absolute', alignSelf: 'center', bottom: -48, width: 112, height: 112, borderRadius: 56, backgroundColor: riderColors.green, alignItems: 'center', justifyContent: 'center', ...riderShadow }}
    >
      <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: riderColors.ink, alignItems: 'center', justifyContent: 'center' }}>
        {loading ? <ActivityIndicator color={riderColors.white} /> : <Ionicons name="power" size={30} color={riderColors.white} />}
      </View>
    </TouchableOpacity>
  );
}

function RecommendedStrip({ compact }: { compact?: boolean }) {
  const items = [
    { title: 'Refer', body: 'Invite crew', image: referImage, route: '/(tabs)/community' },
    { title: 'Center', body: 'Train faster', image: academyImage, route: '/(app)/training' },
    { title: 'Payouts', body: 'Cash out', image: payoutsImage, route: '/(tabs)/earnings' },
    { title: 'Safety', body: 'Support line', image: supportImage, route: '/(app)/settings/about' },
  ];

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <Text style={{ color: riderColors.ink, fontSize: 16, fontWeight: '900' }}>Recommended for you</Text>
        <Text style={{ color: riderColors.greenDark, fontSize: 11, fontWeight: '900' }}>Rider tools</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {items.map((item) => (
          <ImageTile
            key={item.title}
            title={item.title}
            body={item.body}
            image={item.image}
            compact={compact}
            onPress={() => router.push(item.route as any)}
          />
        ))}
      </View>
    </View>
  );
}

function ImageTile({
  body,
  compact,
  image,
  onPress,
  title,
}: {
  body: string;
  compact?: boolean;
  image: ImageSourcePropType;
  onPress: () => void;
  title: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={{ flex: 1, borderRadius: 15, backgroundColor: riderColors.white, borderWidth: 1, borderColor: riderColors.line, overflow: 'hidden' }}
    >
      <Image source={image} resizeMode="cover" style={{ height: compact ? 58 : 68, width: '100%' }} />
      <View style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
        <Text style={{ color: riderColors.ink, fontSize: 11, fontWeight: '900' }} numberOfLines={1}>{title}</Text>
        <Text style={{ color: riderColors.muted, fontSize: 9, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>{body}</Text>
      </View>
    </TouchableOpacity>
  );
}
