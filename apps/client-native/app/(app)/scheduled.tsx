import { ActivityIndicator, Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuth } from '@riderguy/auth-native';
import { EmptyState, RoutePair, ScreenHeader, StatusBadge } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';
import { formatOrderDate } from '@/lib/client-design';

function scheduleStatus(status?: string) {
  if (status === 'ACTIVE') return { label: 'Active', bg: colors.brandSoft, text: colors.brandDark };
  if (status === 'PAUSED') return { label: 'Paused', bg: '#FEF3C7', text: '#92400E' };
  if (status === 'CANCELLED') return { label: 'Cancelled', bg: '#FEE2E2', text: '#B91C1C' };
  return { label: status ?? 'Scheduled', bg: '#F3F4F6', text: colors.muted };
}

export default function ScheduledScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();

  const schedulesQuery = useQuery({
    queryKey: ['scheduled-deliveries'],
    queryFn: async () => {
      const { data } = await api.get('/scheduled-deliveries');
      return (data.data ?? data) as any[];
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ACTIVE' | 'PAUSED' }) => {
      await api.patch(`/scheduled-deliveries/${id}`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-deliveries'] });
      Toast.show({ type: 'success', text1: 'Schedule updated' });
    },
  });

  const cancelSchedule = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/scheduled-deliveries/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-deliveries'] });
      Toast.show({ type: 'success', text1: 'Schedule cancelled' });
    },
  });

  const askCancel = (id: string) => {
    Alert.alert('Cancel schedule?', 'Future deliveries from this schedule will stop.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Schedule', style: 'destructive', onPress: () => cancelSchedule.mutate(id) },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Scheduled" subtitle="Future and recurring deliveries" />
      <FlatList
        data={schedulesQuery.data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={schedulesQuery.isFetching} onRefresh={() => schedulesQuery.refetch()} tintColor={colors.brand} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
              <View style={{ position: 'absolute', right: -44, top: -42, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(10,185,87,0.18)' }} />
              <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Planner</Text>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 6 }}>Set it once. Let it move.</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/quick-send' as any)} style={{ marginTop: 18, height: 46, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Schedule a Delivery</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          schedulesQuery.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 44 }} />
          ) : (
            <EmptyState icon="calendar-outline" title="No scheduled deliveries" body="Plan a future pickup or recurring delivery from quick send." action="Create Schedule" onPress={() => router.push('/(app)/quick-send' as any)} />
          )
        }
        renderItem={({ item }) => {
          const status = scheduleStatus(item.status);
          const isActive = item.status === 'ACTIVE';
          return (
            <View style={{ borderRadius: 24, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 12, ...shadow.card }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900' }}>{item.title || `${item.frequency?.replace(/_/g, ' ') ?? 'Scheduled'} delivery`}</Text>
                  <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: '800', marginTop: 4 }}>
                    Next: {item.nextScheduledAt ? formatOrderDate(item.nextScheduledAt) : item.scheduledDate ? formatOrderDate(item.scheduledDate) : 'Not calculated'}
                  </Text>
                </View>
                <StatusBadge label={status.label} bg={status.bg} text={status.text} />
              </View>

              <View style={{ marginTop: 14 }}>
                <RoutePair pickup={item.pickupAddress} dropoff={item.dropoffAddress} compact />
              </View>

              <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => updateSchedule.mutate({ id: item.id, status: isActive ? 'PAUSED' : 'ACTIVE' })}
                  disabled={updateSchedule.isPending || item.status === 'CANCELLED'}
                  style={{ flex: 1, height: 44, borderRadius: 15, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, borderWidth: 1, borderColor: '#EEF2F7' }}
                >
                  <Ionicons name={isActive ? 'pause-outline' : 'play-outline'} size={17} color={colors.ink} />
                  <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '900' }}>{isActive ? 'Pause' : 'Resume'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => askCancel(item.id)}
                  disabled={cancelSchedule.isPending || item.status === 'CANCELLED'}
                  style={{ flex: 1, height: 44, borderRadius: 15, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }}
                >
                  <Ionicons name="close-outline" size={18} color={colors.red} />
                  <Text style={{ color: colors.red, fontSize: 12, fontWeight: '900' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
