import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { io, type Socket } from 'socket.io-client';
import { getApiClient, tokenStorage } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import Toast from 'react-native-toast-message';
import { ProgressBar } from '@/components/rider-ui';
import { cleanLabel, riderColors, riderShadow } from '@/lib/rider-design';

const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://api.myriderguy.com')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');
const OFFER_TIMEOUT = parseInt(process.env.EXPO_PUBLIC_RIDER_OFFER_COUNTDOWN ?? '30', 10);

function formatOfferAmount(amount: number, currency = 'GHS') {
  const normalized = String(currency).toUpperCase();
  if (normalized === 'GHS') return `GHS ${amount.toFixed(2)}`;
  return formatCurrency(amount, normalized);
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

export default function JobOfferScreen() {
  const { offer: offerStr } = useLocalSearchParams<{ offer: string }>();
  const offer = useMemo(() => {
    if (!offerStr) return null;
    try { return JSON.parse(offerStr); } catch { return null; }
  }, [offerStr]);
  const orderId = offer?.orderId ? String(offer.orderId) : '';
  const [timeLeft, setTimeLeft] = useState(OFFER_TIMEOUT);
  const [responding, setResponding] = useState(false);
  const progressAnim = useRef(new Animated.Value(100)).current;
  const socketRef = useRef<Socket | null>(null);
  const respondedRef = useRef(false);

  useEffect(() => {
    if (!orderId) return undefined;
    let cancelled = false;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Animated.timing(progressAnim, { toValue: 0, duration: OFFER_TIMEOUT * 1000, useNativeDriver: false }).start();
    const interval = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(interval);
          if (!respondedRef.current) router.back();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    const connect = async () => {
      const token = await tokenStorage.getAccessToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      if (cancelled) return;
      const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], auth: { token } });
      socket.on('job:offer:taken', (payload: any) => {
        if (String(payload?.orderId ?? '') === orderId && !respondedRef.current) {
          Toast.show({ type: 'info', text1: 'This job has been taken.' });
          router.back();
        }
      });
      socketRef.current = socket;
    };
    connect().catch((error) => {
      Toast.show({ type: 'error', text1: error?.message ?? 'Could not connect to the job offer.' });
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      socketRef.current?.disconnect();
    };
  }, [orderId, progressAnim]);

  useEffect(() => {
    if (!offer) router.back();
  }, [offer]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const respond = async (response: 'accept' | 'decline') => {
    if (!offer || respondedRef.current || responding) return;
    respondedRef.current = true;
    setResponding(true);
    try {
      const ack = await emitOfferResponse(socketRef.current, offer.orderId, response);
      if (!ack.success && response === 'accept') {
        const api = getApiClient();
        await api.post(`/orders/${offer.orderId}/accept`);
      } else if (!ack.success) {
        throw new Error(ack.error ?? 'Could not respond');
      }

      if (response === 'accept') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'success', text1: 'Job accepted.' });
        router.replace(`/(app)/jobs/${offer.orderId}` as any);
      } else {
        router.back();
      }
    } catch (error: any) {
      respondedRef.current = false;
      setResponding(false);
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? error?.message ?? 'Could not respond.' });
    }
  };

  if (!offer) {
    return null;
  }

  const progress = Math.max(0, (timeLeft / OFFER_TIMEOUT) * 100);
  const amount = formatOfferAmount(Number(offer.riderEarnings ?? 0), offer.currency ?? 'GHS');
  const distance = Number(offer.distanceKm ?? 0);
  const duration = offer.estimatedDurationMinutes ?? '?';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#07110D' }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 18 }}>
        <View style={{ position: 'absolute', left: -60, top: 110, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(64,190,137,0.12)' }} />
        <View style={{ position: 'absolute', right: -80, bottom: 120, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(64,190,137,0.10)' }} />

        <View style={{ borderRadius: 30, backgroundColor: riderColors.white, padding: 16, ...riderShadow }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: riderColors.greenDark, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flash" size={23} color={riderColors.white} />
              </View>
              <View>
                <Text style={{ color: riderColors.greenDark, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>New request</Text>
                <Text style={{ color: riderColors.ink, fontSize: 19, fontWeight: '900', marginTop: 1 }}>Delivery offer</Text>
              </View>
            </View>
            <View style={{ borderRadius: 999, backgroundColor: riderColors.greenSoft, borderWidth: 1, borderColor: '#B9EBD4', paddingHorizontal: 11, paddingVertical: 6 }}>
              <Text style={{ color: riderColors.greenDark, fontSize: 12, fontWeight: '900' }}>{timeLeft}s</Text>
            </View>
          </View>

          <ProgressBar progress={progress} color={progress < 35 ? riderColors.red : riderColors.green} />

          <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 13 }}>
            <Text style={{ color: riderColors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Estimated payout</Text>
            <Text style={{ color: riderColors.ink, fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>
              {amount}
            </Text>
            <Text style={{ color: riderColors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
              {cleanLabel(offer.packageType)}
            </Text>
          </View>

          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: riderColors.line, backgroundColor: riderColors.greenMist, padding: 12, gap: 11 }}>
            <JobOfferRoute color={riderColors.greenDark} label="Pickup" value={offer.pickupAddress ?? 'Pickup location'} />
            <View style={{ height: 1, backgroundColor: riderColors.line, marginLeft: 28 }} />
            <JobOfferRoute color={riderColors.red} label="Dropoff" value={offer.dropoffAddress ?? 'Dropoff location'} square />
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <JobOfferChip icon="navigate" label={distance > 0 ? `${distance.toFixed(1)} km` : 'Nearby'} />
            <JobOfferChip icon="time" label={`${duration} min`} />
            <JobOfferChip icon="cube" label={cleanLabel(offer.packageType)} />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
            <TouchableOpacity activeOpacity={0.86} disabled={responding} onPress={() => respond('decline')} style={{ flex: 1, height: 52, borderRadius: 15, borderWidth: 1, borderColor: riderColors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: riderColors.white }}>
              <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.88} disabled={responding} onPress={() => respond('accept')} style={{ flex: 1.45, height: 52, borderRadius: 15, backgroundColor: riderColors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {responding ? <Ionicons name="ellipsis-horizontal" size={22} color={riderColors.white} /> : <Ionicons name="checkmark-circle" size={21} color={riderColors.white} />}
              <Text style={{ color: riderColors.white, fontSize: 16, fontWeight: '900' }}>{responding ? 'Accepting' : 'Accept'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function JobOfferRoute({
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

function JobOfferChip({
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
