import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { io, type Socket } from 'socket.io-client';
import { tokenStorage, useAuth } from '@riderguy/auth-native';
import { colors, shadow } from '@/design/client';
import { getOrderStatus } from '@/lib/client-design';

const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://api.myriderguy.com')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');
const FALLBACK_PICKUP = { latitude: 5.6037, longitude: -0.1870 };

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

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const mapRef = useRef<MapView>(null);
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
  const pickup = useMemo(() => (
    coord(order?.pickupLatitude, order?.pickupLongitude) ??
    coord(order?.pickupLat, order?.pickupLng) ??
    FALLBACK_PICKUP
  ), [order]);
  const dropoff = useMemo(() => (
    coord(order?.dropoffLatitude, order?.dropoffLongitude) ??
    coord(order?.dropoffLat, order?.dropoffLng) ??
    { latitude: pickup.latitude + 0.018, longitude: pickup.longitude - 0.016 }
  ), [order, pickup]);
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
        mapRef.current?.animateCamera({ center: next, zoom: 15 }, { duration: 550 });
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

  useEffect(() => {
    if (!mapRef.current || !pickup || !dropoff) return;
    const coordinates = [pickup, dropoff, riderLocation].filter(Boolean) as LatLng[];
    if (coordinates.length < 2) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 150, right: 60, bottom: 260, left: 60 },
        animated: true,
      });
    }, 450);
  }, [pickup, dropoff, riderLocation]);

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
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{ ...pickup, latitudeDelta: 0.055, longitudeDelta: 0.055 }}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        <Marker coordinate={pickup} title="Pickup">
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.brand }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand }} />
          </View>
        </Marker>
        <Marker coordinate={dropoff} title="Dropoff">
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' }}>
            <Ionicons name="flag" size={13} color="#fff" />
          </View>
        </Marker>
        {visibleRider && (
          <Marker coordinate={visibleRider} title="Rider">
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff' }}>
              <Ionicons name="bicycle" size={18} color="#fff" />
            </View>
          </Marker>
        )}
        <Polyline coordinates={[pickup, dropoff]} strokeColor="#111827" strokeWidth={4} />
        {visibleRider && <Polyline coordinates={[visibleRider, dropoff]} strokeColor={colors.brand} strokeWidth={4} lineDashPattern={[8, 5]} />}
      </MapView>

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
