import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import Toast from 'react-native-toast-message';
import { BrandHeader, EmptyState, RiderButton, RiderCard, RouteSummary, SegmentedControl, StatusPill } from '@/components/rider-ui';
import { cleanLabel, riderColors } from '@/lib/rider-design';

type Tab = 'available' | 'active';

const ACTIVE_STATUSES = new Set(['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF']);

export default function JobsScreen() {
  const [tab, setTab] = useState<Tab>('available');
  const { api } = useAuth();
  const qc = useQueryClient();

  const { data: available, isLoading: availableLoading, refetch: refetchAvailable, error: availableError } = useQuery({
    queryKey: ['jobs-available'],
    queryFn: async () => {
      const { data } = await api.get('/orders/available');
      return (data.data ?? data) as any[];
    },
    refetchInterval: 10000,
    retry: false,
  });

  const { data: active, isLoading: activeLoading, refetch: refetchActive } = useQuery({
    queryKey: ['jobs-active'],
    queryFn: async () => {
      const { data } = await api.get('/orders?limit=100');
      const jobs = (data.data ?? data) as any[];
      return jobs.filter((job) => ACTIVE_STATUSES.has(job.status));
    },
    refetchInterval: 6000,
  });

  const { mutate: acceptJob, isPending: accepting } = useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.post(`/orders/${orderId}/accept`);
      return data.data ?? data;
    },
    onSuccess: async (order: any) => {
      Toast.show({ type: 'success', text1: 'Job accepted.' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['jobs-available'] }),
        qc.invalidateQueries({ queryKey: ['jobs-active'] }),
      ]);
      router.push(`/(app)/jobs/${order.id}` as any);
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not accept job.' }),
  });

  const isLoading = tab === 'available' ? availableLoading : activeLoading;
  const jobs = (tab === 'available' ? available : active) ?? [];
  const refetch = tab === 'available' ? refetchAvailable : refetchActive;

  const confirmAccept = (order: any) => {
    Alert.alert('Accept delivery?', `Pickup: ${order.pickupAddress}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => acceptJob(order.id) },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.white }} edges={['top']}>
      <BrandHeader
        onMenu={() => router.push('/(tabs)/account')}
        onNotifications={() => router.push('/(app)/notifications')}
        unread={false}
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: riderColors.white }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
          <View>
            <Text style={{ color: riderColors.ink, fontSize: 28, fontWeight: '900' }}>Deliveries</Text>
            <Text style={{ color: riderColors.muted, fontSize: 13, fontWeight: '600', marginTop: 3 }}>Claim work and manage active jobs.</Text>
          </View>
          <StatusPill status={tab === 'available' ? 'ONLINE' : 'ON_DELIVERY'} label={tab === 'available' ? 'Feed' : 'Active'} />
        </View>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { label: 'Available', value: 'available' },
            { label: 'Active', value: 'active' },
          ]}
        />
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={riderColors.green} />}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12, paddingBottom: 30 }}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={riderColors.green} style={{ paddingVertical: 70 }} />
          ) : (
            <EmptyState
              icon={tab === 'available' ? 'radio-outline' : 'navigate-outline'}
              title={tab === 'available' ? 'No jobs in range' : 'No active deliveries'}
              body={tab === 'available'
                ? ((availableError as any)?.response?.data?.error?.message ?? 'Go live and keep GPS enabled to see nearby work.')
                : 'Accepted deliveries will appear here with route status and proof actions.'}
              action={tab === 'available' ? <RiderButton label="Refresh feed" variant="light" onPress={() => refetchAvailable()} /> : undefined}
            />
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => tab === 'available' ? confirmAccept(item) : router.push(`/(app)/jobs/${item.id}` as any)}
          >
            <RiderCard>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: riderColors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>{cleanLabel(item.packageType)}</Text>
                  <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '900', marginTop: 3 }}>
                    {item.orderNumber ?? 'Delivery job'}
                  </Text>
                </View>
                <Text style={{ color: riderColors.greenDark, fontSize: 22, fontWeight: '900' }}>
                  {formatCurrency(Number(item.riderEarnings ?? item.totalPrice ?? 0), item.currency ?? 'GHS')}
                </Text>
              </View>

              <RouteSummary pickup={item.pickupAddress} dropoff={item.dropoffAddress} compact />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <View style={{ flexDirection: 'row', gap: 13 }}>
                  <Text style={{ color: riderColors.muted, fontSize: 12, fontWeight: '800' }}>{Number(item.distanceKm ?? 0).toFixed(1)} km</Text>
                  <Text style={{ color: riderColors.muted, fontSize: 12, fontWeight: '800' }}>{item.estimatedDurationMinutes ?? '?'} min</Text>
                </View>
                {tab === 'available' ? (
                  <RiderButton label={accepting ? 'Claiming' : 'Claim'} icon="flash" loading={accepting} onPress={() => confirmAccept(item)} style={{ minHeight: 40, borderRadius: 13, paddingHorizontal: 13 }} />
                ) : (
                  <StatusPill status={item.status} />
                )}
              </View>
            </RiderCard>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
