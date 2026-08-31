import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { io, type Socket } from 'socket.io-client';
import { tokenStorage, useAuth } from '@riderguy/auth-native';
import { colors, shadow } from '@/design/client';
import { getOrderStatus } from '@/lib/client-design';

const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://api.myriderguy.com')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');
type LatLng = { latitude: number; longitude: number };

function coord(lat?: number, lng?: number): LatLng | null {
  if (typeof lat === 'number' && typeof lng === 'number') return { latitude: lat, longitude: lng };
  return null;
}

function normalizeRider(raw: any) {
  if (!raw) return null;
  const user = raw.user ?? raw;
  const firstName = user.firstName ?? raw.firstName ?? '';
  const lastName = user.lastName ?? raw.lastName ?? '';
  const phone = typeof user.phone === 'string' ? user.phone.trim() : typeof raw.phone === 'string' ? raw.phone.trim() : '';
  return {
    firstName,
    lastName,
    phone,
    currentLatitude: raw.currentLatitude,
    currentLongitude: raw.currentLongitude,
  };
}

function StepRail({ step }: { step: number }) {
  const labels = ['Placed', 'Rider', 'Pickup', 'Transit', 'Done'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {labels.map((label, index) => {
        const active = step >= index;
        return (
          <View key={label} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ height: 4, alignSelf: 'stretch', borderRadius: 999, backgroundColor: active ? colors.brand : '#E5E7EB' }} />
            <Text style={{ color: active ? colors.brandDark : colors.subtle, fontSize: 9, fontWeight: '900', marginTop: 6 }}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TrackingRouteCanvas({
  pickupAddress,
  dropoffAddress,
  riderConnected,
}: {
  pickupAddress: string;
  dropoffAddress: string;
  riderConnected: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`Delivery tracking from ${pickupAddress} to ${dropoffAddress}. ${riderConnected ? 'Rider location is active.' : 'Waiting for rider location.'}`}
      style={{ flex: 1, overflow: 'hidden', backgroundColor: '#ECF8F2', paddingHorizontal: 22, paddingTop: 122, paddingBottom: 288 }}
    >
      <View style={{ position: 'absolute', width: '150%', height: 34, top: 98, left: '-24%', backgroundColor: 'rgba(255,255,255,0.76)', transform: [{ rotate: '-13deg' }] }} />
      <View style={{ position: 'absolute', width: '145%', height: 24, top: 266, left: '-18%', backgroundColor: 'rgba(64,190,137,0.12)', transform: [{ rotate: '19deg' }] }} />

      <View style={{ flex: 1, minHeight: 240, borderRadius: 30, borderWidth: 1, borderColor: '#CDE8DB', backgroundColor: 'rgba(255,255,255,0.96)', padding: 20, justifyContent: 'center', ...shadow.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 }}>
          <View style={{ width: 44, height: 44, borderRadius: 17, backgroundColor: riderConnected ? colors.brandSoft : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={riderConnected ? 'bicycle' : 'time-outline'} size={22} color={riderConnected ? colors.brandDark : colors.subtle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900' }}>Live delivery route</Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              {riderConnected ? 'Your rider position is updating live.' : 'Waiting for your rider location signal.'}
            </Text>
          </View>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: riderConnected ? colors.brand : colors.amber }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <View style={{ width: 34, alignItems: 'center' }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.brand, borderWidth: 4, borderColor: '#fff' }} />
            <View style={{ width: 3, flex: 1, minHeight: 58, marginVertical: 5, borderRadius: 2, backgroundColor: '#B8DCCA' }} />
            <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: colors.ink, borderWidth: 4, borderColor: '#fff' }} />
          </View>
          <View style={{ flex: 1, gap: 20 }}>
            <View>
              <Text style={{ color: colors.brandDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Pickup</Text>
              <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 3 }} numberOfLines={2}>{pickupAddress}</Text>
            </View>
            <View>
              <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Dropoff</Text>
              <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 3 }} numberOfLines={2}>{dropoffAddress}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [riderLocation, setRiderLocation] = useState<LatLng | null>(null);

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data ?? data;
    },
    refetchInterval: 8000,
  });

  const order = orderQuery.data;
  const status = getOrderStatus(order?.status);
  const rider = normalizeRider(order?.rider ?? order?.assignedRider);
  const riderName = rider ? `${rider.firstName} ${rider.lastName}`.trim() || 'Your rider' : '';
  const deliveryPin = typeof order?.deliveryPinCode === 'string' ? order.deliveryPinCode : '';
  const showDeliveryPin = deliveryPin.length > 0 && order?.status !== 'DELIVERED' && order?.status !== 'CANCELLED';

  useEffect(() => {
    let disposed = false;
    async function connect() {
      const token = await tokenStorage.getAccessToken();
      if (disposed) return;
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        auth: { token },
      });
      socket.on('connect', () => {
        socket.emit('order:subscribe', { orderId: id });
      });
      const handleLocation = (payload: any) => {
        const latitude = payload?.latitude ?? payload?.lat;
        const longitude = payload?.longitude ?? payload?.lng;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
        const next = { latitude, longitude };
        setRiderLocation(next);
      };
      socket.on('rider:location', handleLocation);
      socket.on('rider:location:update', handleLocation);
      socket.on('order:location', handleLocation);
      socketRef.current = socket;
    }
    connect();
    return () => {
      disposed = true;
      socketRef.current?.disconnect();
    };
  }, [id]);

  if (!order && orderQuery.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const visibleRider = riderLocation
    ?? coord(order?.riderLatitude, order?.riderLongitude)
    ?? coord(rider?.currentLatitude, rider?.currentLongitude);

  const callRider = async () => {
    if (!rider?.phone) return;
    await Linking.openURL(`tel:${rider.phone}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#E5E7EB' }}>
      <TrackingRouteCanvas
        pickupAddress={order?.pickupAddress ?? 'Pickup location'}
        dropoffAddress={order?.dropoffAddress ?? 'Dropoff location'}
        riderConnected={Boolean(visibleRider)}
      />

      <SafeAreaView style={{ position: 'absolute', left: 0, right: 0, top: 0 }} pointerEvents="box-none">
        <View style={{ marginHorizontal: 16, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, ...shadow.card }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '900' }}>{status.label}</Text>
            <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{order?.dropoffAddress}</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14, borderRadius: 28, backgroundColor: '#fff', padding: 18, ...shadow.float }}>
        <StepRail step={Math.max(0, Math.min(status.step, 4))} />

        <View style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <View style={{ width: 54, height: 54, borderRadius: 22, backgroundColor: rider ? colors.brandSoft : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
            {rider ? (
              <Text style={{ color: colors.brandDark, fontSize: 18, fontWeight: '900' }}>{rider.firstName?.[0] ?? 'R'}</Text>
            ) : (
              <ActivityIndicator color={colors.brand} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900' }}>
              {rider ? riderName : 'Finding your rider'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              {rider ? 'Your RiderGuy partner is connected.' : 'We are matching you with a nearby rider.'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push(`/(app)/chat/${id}` as any)} style={{ width: 44, height: 44, borderRadius: 17, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={callRider}
            disabled={!rider?.phone}
            style={{ width: 44, height: 44, borderRadius: 17, backgroundColor: rider?.phone ? colors.ink : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="call-outline" size={20} color={rider?.phone ? '#fff' : colors.subtle} />
          </TouchableOpacity>
        </View>

        {showDeliveryPin && (
          <View style={{ marginTop: 16, borderRadius: 18, backgroundColor: colors.brandSoft, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="keypad-outline" size={19} color={colors.brandDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.brandDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Delivery PIN</Text>
              <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 1 }}>{deliveryPin}</Text>
            </View>
          </View>
        )}

        <View style={{ marginTop: 16, borderRadius: 18, backgroundColor: colors.ink, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Live link</Text>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 2 }}>{visibleRider ? 'Rider position active' : 'Waiting for rider signal'}</Text>
          </View>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: visibleRider ? colors.brand : colors.amber }} />
        </View>
      </View>
    </View>
  );
}
