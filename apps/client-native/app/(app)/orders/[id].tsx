import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import { RoutePair, ScreenHeader, StatusBadge } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';
import { ACTIVE_STATUSES, formatOrderDate, getOrderStatus, normalizeOrderTotal } from '@/lib/client-design';

const CANCEL_REASONS = [
  'Plans changed',
  'Wrong address',
  'Taking too long',
  'Placed by mistake',
];

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 }}>
      <View style={{ width: 34, height: 34, borderRadius: 13, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 2 }}>{value || 'Not provided'}</Text>
      </View>
    </View>
  );
}

function normalizeRider(raw: any) {
  if (!raw) return null;
  const user = raw.user ?? raw;
  const firstName = typeof user.firstName === 'string' ? user.firstName.trim() : '';
  const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Your RiderGuy rider';
  return {
    firstName,
    lastName,
    displayName,
    initial: firstName[0] ?? 'R',
    subtitle: raw.vehicleType ?? raw.vehicle ?? 'RiderGuy rider',
    rating: typeof raw.averageRating === 'number' ? raw.averageRating : raw.rating,
  };
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data ?? data;
    },
    refetchInterval: (query) => {
      const current = query.state.data as any;
      return current && ACTIVE_STATUSES.has(current.status) ? 7000 : false;
    },
  });

  const cancelOrder = useMutation({
    mutationFn: async (reason: string) => api.post(`/orders/${id}/cancel`, { reason }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Order cancelled' });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: any) => {
      Toast.show({ type: 'error', text1: err?.response?.data?.error?.message ?? 'Could not cancel order' });
    },
  });

  const askCancel = () => {
    Alert.alert(
      'Cancel this delivery?',
      'Choose a reason. If a rider is already assigned, cancellation rules may apply.',
      [
        { text: 'Keep Order', style: 'cancel' },
        ...CANCEL_REASONS.map((reason) => ({
          text: reason,
          onPress: () => cancelOrder.mutate(reason),
        })),
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <ScreenHeader title="Order Details" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.subtle} />
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 12 }}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = getOrderStatus(order.status);
  const isActive = ACTIVE_STATUSES.has(order.status);
  const total = normalizeOrderTotal(order);
  const rider = normalizeRider(order.rider ?? order.assignedRider);
  const deliveryPin = typeof order.deliveryPinCode === 'string' ? order.deliveryPinCode : '';
  const showDeliveryPin = isActive && deliveryPin.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader
        title="Order Details"
        subtitle={`#${order.orderNumber ?? id?.slice(0, 8)} - ${formatOrderDate(order.createdAt)}`}
        right={isActive ? (
          <TouchableOpacity onPress={() => router.push(`/(app)/orders/${id}/tracking` as any)} style={{ borderRadius: 999, backgroundColor: colors.brand, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>Track</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <View style={{ borderRadius: 24, backgroundColor: colors.ink, padding: 18, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -38, top: -42, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(10,185,87,0.16)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <StatusBadge label={status.label} bg={status.solid} text="#fff" />
            <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '800' }}>{order.paymentStatus ?? order.paymentMethod ?? 'Payment'}</Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1, marginTop: 18 }}>{formatCurrency(total, 'GHS')}</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '700', marginTop: 4 }}>
            {isActive ? 'Your delivery is still moving through the city.' : 'Receipt and delivery details'}
          </Text>
        </View>

        <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          <RoutePair pickup={order.pickupAddress} dropoff={order.dropoffAddress} />
        </View>

        {!!rider && (
          <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', flexDirection: 'row', alignItems: 'center', gap: 13, ...shadow.card }}>
            <View style={{ width: 54, height: 54, borderRadius: 22, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.brandDark, fontSize: 18, fontWeight: '900' }}>{rider.initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900' }}>{rider.displayName}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{rider.subtitle}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="star" size={14} color={colors.amber} />
              <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '900' }}>{rider.rating?.toFixed?.(1) ?? '5.0'}</Text>
            </View>
          </View>
        )}

        <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          <InfoRow icon="cube-outline" label="Package" value={order.packageType?.replace(/_/g, ' ')} />
          <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
          <InfoRow icon="wallet-outline" label="Payment method" value={order.paymentMethod?.replace(/_/g, ' ')} />
          <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
          <InfoRow icon="time-outline" label="Schedule" value={order.scheduledAt ? formatOrderDate(order.scheduledAt) : 'Pickup ASAP'} />
          {showDeliveryPin && (
            <>
              <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
              <InfoRow icon="keypad-outline" label="Delivery PIN" value={deliveryPin} />
            </>
          )}
        </View>

        {!!order.dropoffInstructions && (
          <View style={{ marginTop: 14, borderRadius: 18, backgroundColor: '#FFFBEB', padding: 14, flexDirection: 'row', gap: 10 }}>
            <Ionicons name="reader-outline" size={18} color="#B45309" />
            <Text style={{ flex: 1, color: '#92400E', fontSize: 12, lineHeight: 18, fontWeight: '700' }}>{order.dropoffInstructions}</Text>
          </View>
        )}

        {order.status === 'DELIVERED' && (
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => router.push(`/(app)/orders/${id}/rate` as any)}
            style={{ marginTop: 16, height: 56, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...shadow.brand }}
          >
            <Ionicons name="star-outline" size={19} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Rate your rider</Text>
          </TouchableOpacity>
        )}

        {isActive && (
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={askCancel}
            disabled={cancelOrder.isPending}
            style={{ marginTop: 12, height: 54, borderRadius: 18, borderWidth: 1, borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}
          >
            {cancelOrder.isPending ? <ActivityIndicator color={colors.red} /> : <Text style={{ color: colors.red, fontSize: 14, fontWeight: '900' }}>Cancel Order</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
