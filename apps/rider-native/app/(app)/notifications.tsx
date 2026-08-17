import { FlatList, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { EmptyState, RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { dateTime, riderColors } from '@/lib/rider-design';

export default function NotificationsScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications?pageSize=50');
      return (data.data ?? data) as any[];
    },
  });

  const markAll = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = (data ?? []).filter((item: any) => !item.read && !item.readAt).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader
        title="Notifications"
        subtitle="Dispatch, account, wallet, and review alerts"
        canGoBack
        right={<StatusPill status={unread > 0 ? 'PENDING' : 'ONLINE'} label={`${unread} unread`} />}
      />
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={riderColors.green} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        ListHeaderComponent={unread > 0 ? <RiderButton label="Mark all read" variant="light" icon="checkmark-done" loading={markAll.isPending} onPress={() => markAll.mutate()} style={{ marginBottom: 4 }} /> : null}
        ListEmptyComponent={!isLoading ? <EmptyState icon="notifications-outline" title="No notifications" body="Important rider updates will collect here." /> : null}
        renderItem={({ item }) => {
          const isUnread = !item.read && !item.readAt;
          return (
            <TouchableOpacity activeOpacity={0.84} onPress={() => isUnread ? markRead.mutate(item.id) : undefined}>
              <RiderCard style={{ borderColor: isUnread ? '#b7efd8' : riderColors.line }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: isUnread ? riderColors.greenSoft : riderColors.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={isUnread ? 'radio' : 'notifications-outline'} size={19} color={isUnread ? riderColors.greenDark : riderColors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>{item.title}</Text>
                    <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{item.body}</Text>
                    <Text style={{ color: riderColors.soft, fontSize: 11, fontWeight: '800', marginTop: 7 }}>{dateTime(item.createdAt)}</Text>
                  </View>
                </View>
              </RiderCard>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
