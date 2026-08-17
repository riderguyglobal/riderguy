import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import { ClientBrandHeader, ServiceCard } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';
import { ACTIVE_STATUSES, formatOrderDate, getOrderStatus, normalizeOrderTotal } from '@/lib/client-design';

const hero = require('../../assets/images/illustrations/header-hero-client.png');
const sendIcon = require('../../assets/images/icons/send-package.png');
const rideIcon = require('../../assets/images/icons/ride.png');

const UTILITY_ACTIONS = [
  { icon: 'calendar-outline' as const, label: 'Schedule\nDelivery', route: '/(app)/scheduled' },
  { icon: 'locate-outline' as const, label: 'Track\nOrders', route: '/(app)/track' },
  { icon: 'location-outline' as const, label: 'Saved\nAddresses', route: '/(app)/saved-addresses' },
  { icon: 'sparkles-outline' as const, label: 'Rider\nWizard', route: '/(app)/rider-genius' },
  { icon: 'gift-outline' as const, label: 'Refer & Earn', route: '/(app)/promos' },
  { icon: 'shield-checkmark-outline' as const, label: 'Safety\nCenter', route: '/(app)/safety-center' },
  { icon: 'help-circle-outline' as const, label: 'Support', route: '/(app)/settings/help' },
  { icon: 'ellipsis-horizontal' as const, label: 'More', route: '/(tabs)/account' },
];

export default function HomeScreen() {
  const { api } = useAuth();

  const ordersQuery = useQuery({
    queryKey: ['recent-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params: { limit: 20, sort: '-createdAt' } });
      return (data.data ?? data) as any[];
    },
  });

  const unreadQuery = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications', { params: { pageSize: 1 } });
      const rows = data.data ?? [];
      return data.unreadCount ?? data.meta?.total ?? rows.filter((item: any) => !item.isRead).length ?? 0;
    },
    refetchInterval: 30000,
  });

  const orders = ordersQuery.data ?? [];
  const activeOrder = orders.find((order) => ACTIVE_STATUSES.has(order.status));
  const recentOrders = orders.slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ClientBrandHeader
        onMenu={() => router.push('/(tabs)/account')}
        onNotifications={() => router.push('/(app)/notifications')}
        unread={!!unreadQuery.data && unreadQuery.data > 0}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={ordersQuery.isFetching} onRefresh={ordersQuery.refetch} tintColor={colors.brand} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 }}
      >
        <View style={{ height: 168, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.black, ...shadow.card }}>
          <Image source={hero} resizeMode="cover" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <View style={{ width: '52%', height: '100%', justifyContent: 'center', paddingLeft: 16 }}>
            <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.52)', marginBottom: 7 }}>
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '600', letterSpacing: 0.4 }}>Fast. Safe. Reliable.</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', lineHeight: 21 }}>
              Deliveries made easy with Riderguy
            </Text>
            <Text style={{ marginTop: 5, color: 'rgba(255,255,255,0.78)', fontSize: 11, lineHeight: 15 }}>
              Your packages, our priority.
            </Text>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => router.push('/(app)/quick-send')}
              style={{ marginTop: 10, alignSelf: 'flex-start', height: 26, borderRadius: 8, paddingHorizontal: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
            >
              <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 8 }}>Send a Package</Text>
              <Ionicons name="arrow-forward" size={9} color={colors.brand} />
            </TouchableOpacity>
          </View>
        </View>

        {activeOrder && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/(app)/orders/${activeOrder.id}/tracking` as any)}
            style={{ marginTop: 12, borderRadius: 18, backgroundColor: '#fff', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...shadow.card }}
          >
            <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="navigate-outline" size={21} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '900' }}>Active delivery</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                {getOrderStatus(activeOrder.status).label} - {activeOrder.dropoffAddress}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </TouchableOpacity>
        )}

        <View style={{ marginTop: 18 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: 11 }}>What would you like to do?</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ServiceCard
              icon="cube-outline"
              title="Quick Delivery"
              body="Deliver items anywhere, anytime."
              onPress={() => router.push('/(app)/quick-send')}
              image={<Image source={sendIcon} resizeMode="contain" style={{ width: 36, height: 36 }} />}
            />
            <ServiceCard
              icon="car-outline"
              title="Book a Ride"
              body="Get a ride to your destination safely."
              onPress={() => router.push('/(app)/book-ride')}
              image={<Image source={rideIcon} resizeMode="contain" style={{ width: 36, height: 36 }} />}
              tone={colors.blueSoft}
            />
          </View>
        </View>

        <View style={{ marginTop: 16, borderRadius: 20, backgroundColor: '#fff', overflow: 'hidden', borderWidth: 1, borderColor: colors.line, ...shadow.card }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {UTILITY_ACTIONS.map((item, index) => {
              const rightEdge = (index + 1) % 4 === 0;
              const bottomRow = index >= 4;
              return (
                <TouchableOpacity
                  key={item.label}
                  activeOpacity={0.82}
                  onPress={() => router.push(item.route as any)}
                  style={{
                    width: '25%',
                    height: 74,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRightWidth: rightEdge ? 0 : 1,
                    borderBottomWidth: bottomRow ? 0 : 1,
                    borderColor: '#EEEEEE',
                  }}
                >
                  <Ionicons name={item.icon} size={21} color={colors.brandDark} />
                  <Text style={{ marginTop: 6, color: '#111', fontSize: 9.5, fontWeight: '900', lineHeight: 11, textAlign: 'center' }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900' }}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
              <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '800' }}>View all</Text>
            </TouchableOpacity>
          </View>

          {ordersQuery.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 28 }} />
          ) : recentOrders.length === 0 ? (
            <View style={{ alignItems: 'center', borderRadius: 18, backgroundColor: '#fff', paddingVertical: 30 }}>
              <Ionicons name="cube-outline" size={38} color="#E5E7EB" />
              <Text style={{ marginTop: 8, color: colors.subtle, fontWeight: '800', fontSize: 13 }}>No orders yet</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/quick-send')} style={{ marginTop: 12, borderRadius: 999, backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 9 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>Send your first package</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {recentOrders.map((order) => {
                const status = getOrderStatus(order.status);
                return (
                  <TouchableOpacity
                    key={order.id}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/(app)/orders/${order.id}` as any)}
                    style={{ borderRadius: 16, backgroundColor: '#fff', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="cube-outline" size={20} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '900' }}>Order #{order.orderNumber ?? order.id?.slice?.(0, 6)}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                        {order.pickupAddress} to {order.dropoffAddress}
                      </Text>
                      <Text style={{ color: colors.subtle, fontSize: 10, marginTop: 2 }}>{formatOrderDate(order.createdAt)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={{ borderRadius: 999, backgroundColor: status.bg, paddingHorizontal: 9, paddingVertical: 4 }}>
                        <Text style={{ color: status.text, fontSize: 10, fontWeight: '800' }}>{status.label}</Text>
                      </View>
                      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '900' }}>{formatCurrency(normalizeOrderTotal(order), 'GHS')}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
