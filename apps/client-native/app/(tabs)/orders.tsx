import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import { EmptyState, RoutePair, StatusBadge } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';
import { ACTIVE_STATUSES, formatOrderDate, getOrderStatus, normalizeOrderTotal } from '@/lib/client-design';

export default function OrdersScreen() {
  const { api } = useAuth();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params: { limit: 50, sort: '-createdAt' } });
      return (data.data ?? data) as any[];
    },
    refetchInterval: (query) => {
      const rows = (query.state.data as any[] | undefined) ?? [];
      return rows.some((order) => ACTIVE_STATUSES.has(order.status)) ? 8000 : false;
    },
  });

  const orders = data ?? [];
  const activeOrders = orders.filter((order) => ACTIVE_STATUSES.has(order.status));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>My Orders</Text>
        <Text style={{ color: colors.subtle, marginTop: 3, fontSize: 12, fontWeight: '600' }}>
          {activeOrders.length > 0 ? `${activeOrders.length} active delivery${activeOrders.length > 1 ? 'ies' : ''}` : 'Track deliveries, receipts, and history'}
        </Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brand} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 10 }}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 80 }} />
          ) : (
            <EmptyState
              icon="cube-outline"
              title="No deliveries yet"
              body="Send your first package and every order will appear here with live status."
              action="Send Package"
              onPress={() => router.push('/(app)/quick-send')}
            />
          )
        }
        renderItem={({ item }) => {
          const status = getOrderStatus(item.status);
          const isActive = ACTIVE_STATUSES.has(item.status);
          return (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.push(`/(app)/orders/${item.id}` as any)}
              style={{ borderRadius: 18, backgroundColor: '#fff', padding: 15, borderWidth: 1, borderColor: isActive ? 'rgba(10,185,87,0.22)' : '#EEF2F7', ...shadow.card }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '900' }}>Order #{item.orderNumber ?? item.id?.slice?.(0, 6)}</Text>
                  <Text style={{ color: colors.subtle, fontSize: 10.5, marginTop: 2 }}>{formatOrderDate(item.createdAt)}</Text>
                </View>
                <StatusBadge label={status.label} bg={status.bg} text={status.text} />
              </View>

              <RoutePair pickup={item.pickupAddress} dropoff={item.dropoffAddress} compact />

              <View style={{ marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={isActive ? 'navigate-outline' : 'receipt-outline'} size={15} color={isActive ? colors.brand : colors.subtle} />
                  <Text style={{ color: isActive ? colors.brandDark : colors.muted, fontSize: 11, fontWeight: '800' }}>
                    {isActive ? 'Live tracking available' : 'Receipt available'}
                  </Text>
                </View>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '900' }}>{formatCurrency(normalizeOrderTotal(item), 'GHS')}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
