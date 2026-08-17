import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { EmptyState, RoutePair, ScreenHeader, StatusBadge } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';
import { ACTIVE_STATUSES, getOrderStatus } from '@/lib/client-design';

const ACTIVE_STATUS_QUERY = Array.from(ACTIVE_STATUSES).join(',');

export default function TrackScreen() {
  const { api } = useAuth();
  const activeQuery = useQuery({
    queryKey: ['active-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params: { status: ACTIVE_STATUS_QUERY, limit: 10 } });
      return (data.data ?? data) as any[];
    },
    refetchInterval: 5000,
  });

  const orders = activeQuery.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Track" subtitle="Live deliveries in motion" />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={activeQuery.isFetching} onRefresh={() => activeQuery.refetch()} tintColor={colors.brand} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        ListHeaderComponent={
          <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', marginBottom: 16, ...shadow.float }}>
            <View style={{ position: 'absolute', right: -44, top: -42, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(74,128,240,0.24)' }} />
            <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Live board</Text>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 6 }}>{orders.length || 'No'} active {orders.length === 1 ? 'delivery' : 'deliveries'}</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 10 }}>
              Jump straight into the live map when a delivery is assigned.
            </Text>
          </View>
        }
        ListEmptyComponent={
          activeQuery.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 44 }} />
          ) : (
            <EmptyState icon="navigate-outline" title="Nothing moving right now" body="Create a delivery and it will appear here as soon as it becomes active." action="Send a Package" onPress={() => router.push('/(app)/quick-send' as any)} />
          )
        }
        renderItem={({ item }) => {
          const status = getOrderStatus(item.status);
          return (
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => router.push(`/(app)/orders/${item.id}/tracking` as any)}
              style={{ borderRadius: 24, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 12, ...shadow.card }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900' }}>{item.orderNumber ?? item.id.slice(0, 8)}</Text>
                <StatusBadge label={status.label} bg={status.bg} text={status.text} />
              </View>
              <RoutePair pickup={item.pickupAddress} dropoff={item.dropoffAddress} compact />
              <View style={{ marginTop: 14, height: 44, borderRadius: 15, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                <Ionicons name="map-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Open Live Map</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
