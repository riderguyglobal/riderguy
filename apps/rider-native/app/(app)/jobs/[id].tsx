import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { io, type Socket } from 'socket.io-client';
import { tokenStorage, useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import Toast from 'react-native-toast-message';
import { RiderButton, RouteSummary, StatusPill } from '@/components/rider-ui';
import { cleanLabel, riderColors, riderShadow } from '@/lib/rider-design';

const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://api.myriderguy.com')
  .replace('api.riderguy.com', 'api.myriderguy.com')
  .replace(/\/+$/, '');

const STATUS_ACTIONS: Record<string, { label: string; nextStatus?: string; nav: 'pickup' | 'dropoff' | 'none' }> = {
  ASSIGNED: { label: 'Navigate to pickup', nextStatus: 'PICKUP_EN_ROUTE', nav: 'pickup' },
  PICKUP_EN_ROUTE: { label: 'Confirm pickup arrival', nextStatus: 'AT_PICKUP', nav: 'none' },
  AT_PICKUP: { label: 'Package collected', nextStatus: 'PICKED_UP', nav: 'none' },
  PICKED_UP: { label: 'Start dropoff route', nextStatus: 'IN_TRANSIT', nav: 'dropoff' },
  IN_TRANSIT: { label: 'Confirm dropoff arrival', nextStatus: 'AT_DROPOFF', nav: 'none' },
  AT_DROPOFF: { label: 'Complete proof', nav: 'none' },
};

const PRE_PICKUP_CANCEL_STATUSES = new Set(['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP']);
const POST_PICKUP_CANCEL_REQUEST_STATUSES = new Set(['PICKED_UP', 'IN_TRANSIT']);
const LOCATION_TIMEOUT_MS = 8000;
const CANCELLATION_REASONS = [
  'Vehicle broke down',
  'Unsafe area or conditions',
  'Client is unreachable',
  'Package not as described',
  'Personal emergency',
];

function getLoadErrorMessage(error: unknown) {
  const err = error as any;
  return err?.response?.data?.error?.message
    ?? err?.response?.data?.message
    ?? err?.message
    ?? 'We could not load this delivery.';
}

function JobLoadState({
  title,
  body,
  retrying,
  onRetry,
}: {
  title: string;
  body: string;
  retrying?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: riderColors.surface, padding: 18, justifyContent: 'center' }}>
      <View style={{ backgroundColor: riderColors.white, borderRadius: 22, borderWidth: 1, borderColor: riderColors.line, padding: 18, gap: 14 }}>
        <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="alert-circle-outline" size={28} color={riderColors.greenDark} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: riderColors.ink, fontSize: 22, fontWeight: '900' }}>{title}</Text>
          <Text style={{ color: riderColors.muted, fontSize: 14, lineHeight: 21 }}>{body}</Text>
        </View>
        {onRetry ? (
          <RiderButton label="Retry" icon="refresh" loading={retrying} onPress={onRetry} />
        ) : null}
        <RiderButton label="Back to deliveries" icon="arrow-back" variant="light" onPress={() => router.replace('/(tabs)/jobs')} />
      </View>
    </View>
  );
}

function DeliveryRouteCanvas({
  pickupAddress,
  dropoffAddress,
}: {
  pickupAddress: string;
  dropoffAddress: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`Delivery route from ${pickupAddress} to ${dropoffAddress}`}
      style={{ flex: 1, overflow: 'hidden', backgroundColor: '#EAF6F0', paddingHorizontal: 22, paddingTop: 126, paddingBottom: 250 }}
    >
      <View style={{ position: 'absolute', width: '150%', height: 34, top: 110, left: '-24%', backgroundColor: 'rgba(255,255,255,0.72)', transform: [{ rotate: '-14deg' }] }} />
      <View style={{ position: 'absolute', width: '145%', height: 22, top: 270, left: '-20%', backgroundColor: 'rgba(64,190,137,0.10)', transform: [{ rotate: '18deg' }] }} />
      <View style={{ flex: 1, minHeight: 230, borderRadius: 28, borderWidth: 1, borderColor: '#CFE8DC', backgroundColor: 'rgba(255,255,255,0.96)', padding: 20, justifyContent: 'center', ...riderShadow }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="navigate" size={21} color={riderColors.greenDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: riderColors.ink, fontSize: 16, fontWeight: '900' }}>Delivery route</Text>
            <Text style={{ color: riderColors.muted, fontSize: 11, marginTop: 2 }}>Tap Navigate for live turn-by-turn directions.</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <View style={{ width: 34, alignItems: 'center' }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: riderColors.green, borderWidth: 4, borderColor: riderColors.white }} />
            <View style={{ width: 3, flex: 1, minHeight: 54, marginVertical: 5, borderRadius: 2, backgroundColor: '#B9DDCC' }} />
            <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: riderColors.red, borderWidth: 4, borderColor: riderColors.white }} />
          </View>
          <View style={{ flex: 1, gap: 20 }}>
            <View>
              <Text style={{ color: riderColors.greenDark, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Pickup</Text>
              <Text style={{ color: riderColors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 3 }} numberOfLines={2}>{pickupAddress}</Text>
            </View>
            <View>
              <Text style={{ color: riderColors.red, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Dropoff</Text>
              <Text style={{ color: riderColors.ink, fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 3 }} numberOfLines={2}>{dropoffAddress}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

async function getUsablePosition() {
  const current = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
  ]).catch(() => null);

  if (current) return current;

  return Location.getLastKnownPositionAsync({
    maxAge: 5 * 60 * 1000,
    requiredAccuracy: 1000,
  }).catch(() => null);
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const qc = useQueryClient();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const socketRef = useRef<Socket | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCELLATION_REASONS[0]);
  const [cancelNote, setCancelNote] = useState('');

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data ?? data;
    },
    enabled: !!id,
    refetchInterval: 8000,
  });

  const { data: eta } = useQuery({
    queryKey: ['order-eta', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}/eta`);
      return data.data?.eta ?? data.eta ?? null;
    },
    enabled: !!id,
    refetchInterval: 12000,
  });

  const updateStatus = useMutation({
    mutationFn: async (nextStatus: string) => {
      const position = await getUsablePosition();
      await api.patch(`/orders/${id}/status`, {
        status: nextStatus,
        ...(position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : {}),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order', id] }),
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Status update failed.' }),
  });

  const cancelJob = useMutation({
    mutationFn: async () => {
      const reason = [cancelReason, cancelNote.trim()].filter(Boolean).join(': ');
      if (POST_PICKUP_CANCEL_REQUEST_STATUSES.has(order?.status)) {
        await api.post(`/orders/${id}/cancel-request`, { reason });
        return 'request';
      }
      await api.post(`/orders/${id}/rider-cancel`, { reason });
      return 'cancelled';
    },
    onSuccess: async (result) => {
      setCancelVisible(false);
      setCancelNote('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['order', id] }),
        qc.invalidateQueries({ queryKey: ['jobs-active'] }),
        qc.invalidateQueries({ queryKey: ['jobs-available'] }),
      ]);
      Toast.show({
        type: 'success',
        text1: result === 'request' ? 'Cancellation request sent.' : 'Job cancelled.',
      });
      if (result === 'cancelled') router.replace('/(tabs)/jobs');
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Cancellation failed.' }),
  });

  const openNavigation = async (lat: number, lng: number) => {
    const appUrl = Platform.select({
      ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
      android: `google.navigation:q=${lat},${lng}`,
    });
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const canOpen = appUrl ? await Linking.canOpenURL(appUrl) : false;
    await Linking.openURL(canOpen && appUrl ? appUrl : fallback);
  };

  useEffect(() => {
    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      locationWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 20 },
        (loc) => {
          socketRef.current?.emit('rider:updateLocation', {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
          });
        },
      );
    };
    startTracking();
    return () => locationWatchRef.current?.remove();
  }, []);

  useEffect(() => {
    const connect = async () => {
      const token = await tokenStorage.getAccessToken();
      const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], auth: { token } });
      socket.on('connect', () => socket.emit('order:subscribe', { orderId: id }));
      socket.on('order:status', () => qc.invalidateQueries({ queryKey: ['order', id] }));
      socket.on('message:new', () => qc.invalidateQueries({ queryKey: ['order', id] }));
      socketRef.current = socket;
    };
    connect();
    return () => {
      socketRef.current?.disconnect();
    };
  }, [id, qc]);

  useEffect(() => {
    if (order) bottomSheetRef.current?.present();
  }, [order]);

  if (!id) {
    return (
      <JobLoadState
        title="Missing delivery"
        body="This delivery link is missing its order reference."
      />
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: riderColors.surface }}>
        <ActivityIndicator color={riderColors.green} size="large" />
      </View>
    );
  }

  if (isError || !order) {
    return (
      <JobLoadState
        title="Delivery unavailable"
        body={getLoadErrorMessage(error)}
        retrying={isRefetching}
        onRetry={() => { refetch(); }}
      />
    );
  }

  const pickup = {
    latitude: Number(order.pickupLatitude ?? 5.6037),
    longitude: Number(order.pickupLongitude ?? -0.1870),
  };
  const dropoff = {
    latitude: Number(order.dropoffLatitude ?? 5.5913),
    longitude: Number(order.dropoffLongitude ?? -0.2020),
  };
  const action = STATUS_ACTIONS[order.status];
  const cancellationMode = PRE_PICKUP_CANCEL_STATUSES.has(order.status)
    ? 'cancel'
    : POST_PICKUP_CANCEL_REQUEST_STATUSES.has(order.status)
      ? 'request'
      : null;
  const navTarget = action?.nav === 'pickup' ? pickup : dropoff;
  const clientPhone = typeof order.client?.phone === 'string' ? order.client.phone.trim() : '';

  const openOrderChat = () => {
    router.push({ pathname: '/(app)/chat/[orderId]' as any, params: { orderId: id } });
  };

  const callClient = async () => {
    if (!clientPhone) {
      Toast.show({ type: 'error', text1: 'Customer phone is not available.' });
      return;
    }
    await Linking.openURL(`tel:${clientPhone}`);
  };

  const runAction = async () => {
    if (!action) return;
    if (order.status === 'AT_DROPOFF') {
      bottomSheetRef.current?.dismiss();
      router.push({ pathname: '/(app)/jobs/[id]/proof' as any, params: { id } });
      return;
    }
    if (action.nav !== 'none') await openNavigation(navTarget.latitude, navTarget.longitude);
    if (action.nextStatus) updateStatus.mutate(action.nextStatus);
  };

  return (
    <View style={{ flex: 1 }}>
      <DeliveryRouteCanvas
        pickupAddress={order.pickupAddress ?? 'Pickup location'}
        dropoffAddress={order.dropoffAddress ?? 'Dropoff location'}
      />

      <View style={{ position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: riderColors.white, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: riderColors.line }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: riderColors.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={riderColors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>{cleanLabel(order.status)}</Text>
          <Text style={{ color: riderColors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{eta ? `${Math.ceil((eta.durationSeconds ?? 0) / 60)} min to ${cleanLabel(eta.destination)}` : order.orderNumber}</Text>
        </View>
        <TouchableOpacity onPress={() => openNavigation(navTarget.latitude, navTarget.longitude)} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="navigate" size={19} color={riderColors.greenDark} />
        </TouchableOpacity>
      </View>

      <BottomSheetModal ref={bottomSheetRef} snapPoints={['42%', '72%']} enablePanDownToClose={false}>
        <BottomSheetView>
          <View style={{ padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: riderColors.ink, fontSize: 19, fontWeight: '900' }}>{order.orderNumber ?? 'Delivery'}</Text>
              <Text style={{ color: riderColors.muted, fontSize: 12, marginTop: 3 }}>{cleanLabel(order.packageType)} package</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <StatusPill status={order.status} />
              <Text style={{ color: riderColors.greenDark, fontSize: 16, fontWeight: '900' }}>
                {formatCurrency(Number(order.riderEarnings ?? 0), order.currency ?? 'GHS')}
              </Text>
            </View>
          </View>

          <RouteSummary pickup={order.pickupAddress} dropoff={order.dropoffAddress} />

          {order.client ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: riderColors.line, paddingTop: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: riderColors.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: riderColors.ink, fontWeight: '900' }}>{order.client.firstName?.[0] ?? 'C'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: riderColors.ink, fontWeight: '900' }}>{order.client.firstName ?? 'Customer'}</Text>
                <Text style={{ color: riderColors.muted, fontSize: 12, marginTop: 2 }}>Delivery customer</Text>
              </View>
              <TouchableOpacity onPress={openOrderChat} style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chatbubble-ellipses" size={18} color={riderColors.greenDark} />
              </TouchableOpacity>
              <TouchableOpacity onPress={callClient} style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: clientPhone ? riderColors.panelAlt : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="call" size={18} color={clientPhone ? riderColors.ink : riderColors.muted} />
              </TouchableOpacity>
            </View>
          ) : null}

          {action ? (
            <RiderButton
              label={action.label}
              icon={order.status === 'AT_DROPOFF' ? 'camera' : 'navigate'}
              loading={updateStatus.isPending}
              onPress={runAction}
            />
          ) : (
            <RiderButton label="Delivery closed" icon="checkmark-circle" variant="light" disabled />
          )}

          <RiderButton
            label={cancellationMode === 'request' ? 'Request cancellation approval' : 'Request cancellation'}
            icon="alert-circle"
            variant="danger"
            disabled={!cancellationMode}
            onPress={() => setCancelVisible(true)}
          />
          </View>
        </BottomSheetView>
      </BottomSheetModal>

      <Modal visible={cancelVisible} transparent animationType="slide" onRequestClose={() => setCancelVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,17,31,0.58)' }}>
          <View style={{ backgroundColor: riderColors.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>
                  {cancellationMode === 'request' ? 'Ask customer to approve' : 'Cancel this job'}
                </Text>
                <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                  {cancellationMode === 'request'
                    ? 'The customer must authorize cancellation because the package has been picked up.'
                    : 'This releases the job and records the cancellation reason.'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCancelVisible(false)} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: riderColors.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={22} color={riderColors.ink} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8 }}>
              {CANCELLATION_REASONS.map((reason) => {
                const selected = cancelReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setCancelReason(reason)}
                    activeOpacity={0.84}
                    style={{
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: selected ? riderColors.green : riderColors.line,
                      backgroundColor: selected ? riderColors.greenSoft : riderColors.white,
                      padding: 13,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '800' }}>{reason}</Text>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={riderColors.greenDark} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={cancelNote}
              onChangeText={setCancelNote}
              placeholder="Add details for support"
              placeholderTextColor={riderColors.soft}
              multiline
              style={{
                minHeight: 88,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: riderColors.line,
                backgroundColor: riderColors.panelAlt,
                padding: 12,
                color: riderColors.ink,
                fontSize: 14,
                textAlignVertical: 'top',
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <RiderButton label="Keep job" icon="arrow-back" variant="light" style={{ flex: 1 }} onPress={() => setCancelVisible(false)} />
              <RiderButton
                label={cancellationMode === 'request' ? 'Send request' : 'Cancel job'}
                icon="send"
                variant="danger"
                loading={cancelJob.isPending}
                style={{ flex: 1 }}
                onPress={() => cancelJob.mutate()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
