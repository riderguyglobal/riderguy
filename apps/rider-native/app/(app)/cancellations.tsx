import { useState } from 'react';
import { FlatList, Modal, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { EmptyState, MetricTile, RiderButton, RiderCard, RiderHeader, RiderTextField, StatusPill } from '@/components/rider-ui';
import { dateTime, riderColors } from '@/lib/rider-design';

export default function CancellationsScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();
  const [appealId, setAppealId] = useState<string | null>(null);
  const [statement, setStatement] = useState('');
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rider-cancellations'],
    queryFn: async () => {
      const { data } = await api.get('/riders/cancellations');
      return data.data ?? data;
    },
  });

  const appeal = useMutation({
    mutationFn: async () => {
      if (!appealId) return;
      await api.post(`/riders/cancellations/${appealId}/appeal`, { statement: statement.trim(), evidenceUrls: [] });
    },
    onSuccess: async () => {
      setAppealId(null);
      setStatement('');
      await qc.invalidateQueries({ queryKey: ['rider-cancellations'] });
      Toast.show({ type: 'success', text1: 'Appeal submitted.' });
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not submit appeal.' }),
  });

  const records = data?.records ?? data?.history ?? [];
  const total = data?.totalCancellations ?? records.length;
  const suspended = data?.suspendedUntil && new Date(data.suspendedUntil) > new Date();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Cancellations" subtitle="History, penalties, and appeals" canGoBack right={<StatusPill status={suspended ? 'SUSPENDED' : 'ONLINE'} label={suspended ? 'Suspended' : 'Clear'} />} />
      <FlatList
        data={records}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={riderColors.green} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 2 }}>
            <RiderCard dark>
              <Text style={{ color: riderColors.white, fontSize: 20, fontWeight: '900' }}>{suspended ? 'Account temporarily limited' : 'Keep the record clean'}</Text>
              <Text style={{ color: '#9fb0c4', fontSize: 13, lineHeight: 19, marginTop: 8 }}>
                {suspended ? `Suspension runs until ${dateTime(data?.suspendedUntil)}.` : 'Low cancellations keep your dispatch priority healthy.'}
              </Text>
            </RiderCard>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <MetricTile label="Total" value={String(total)} icon="close-circle-outline" tone={total > 0 ? 'red' : 'green'} />
              <MetricTile label="Appeals" value={String(records.filter((r: any) => r.appealStatus).length)} icon="document-text-outline" tone="blue" />
              <MetricTile label="Status" value={suspended ? 'Hold' : 'Good'} icon="shield-checkmark-outline" tone={suspended ? 'red' : 'green'} />
            </View>
            <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '900' }}>Records</Text>
          </View>
        }
        ListEmptyComponent={!isLoading ? <EmptyState icon="checkmark-circle-outline" title="No cancellations" body="Great record. Keep deliveries smooth and communicate early when something goes wrong." /> : null}
        renderItem={({ item }: any) => (
          <RiderCard>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: riderColors.redSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="alert-circle-outline" size={22} color={riderColors.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>{item.reason ?? item.cancellationReason ?? 'Cancelled delivery'}</Text>
                <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }} numberOfLines={2}>
                  {item.order?.pickupAddress ?? item.pickupAddress ?? 'Pickup'} to {item.order?.dropoffAddress ?? item.dropoffAddress ?? 'Dropoff'}
                </Text>
                <Text style={{ color: riderColors.soft, fontSize: 11, fontWeight: '800', marginTop: 6 }}>{dateTime(item.createdAt)}</Text>
                {!item.appealStatus ? (
                  <TouchableOpacity onPress={() => setAppealId(item.id)} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                    <Text style={{ color: riderColors.greenDark, fontWeight: '900', fontSize: 12 }}>Appeal record</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ marginTop: 9 }}><StatusPill status="PENDING" label={`Appeal ${item.appealStatus}`} /></View>
                )}
              </View>
            </View>
          </RiderCard>
        )}
      />

      <Modal visible={!!appealId} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,17,31,0.58)' }}>
          <View style={{ backgroundColor: riderColors.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>Appeal cancellation</Text>
              <TouchableOpacity onPress={() => setAppealId(null)}><Ionicons name="close" size={24} color={riderColors.ink} /></TouchableOpacity>
            </View>
            <RiderTextField
              label="Statement"
              placeholder="Explain what happened clearly"
              value={statement}
              onChangeText={setStatement}
              multiline
              inputStyle={{ minHeight: 128, textAlignVertical: 'top', paddingTop: 12 }}
            />
            <RiderButton label="Submit appeal" icon="send" loading={appeal.isPending} disabled={!statement.trim()} onPress={() => appeal.mutate()} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
