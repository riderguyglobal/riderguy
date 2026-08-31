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
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: response } = await api.get('/notifications?pageSize=50');
      const items = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
      return {
        items: items as any[],
        unreadCount: Number(response?.unreadCount ?? 0),
      };
    },
  });

  const markAll = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all'),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['notifications'] }),
        qc.invalidateQueries({ queryKey: ['notifications-summary'] }),
      ]);
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['notifications'] }),
        qc.invalidateQueries({ queryKey: ['notifications-summary'] }),
      ]);
    },
  });

  const notifications = data?.items ?? [];
  const unread = data?.unreadCount
    ?? notifications.filter((item: any) => item.isRead !== true && !item.readAt).length;

  const openNotification = async (item: any) => {
    if (item.isRead !== true && !item.readAt) {
      await markRead.mutateAsync(item.id).catch(() => undefined);
    }

    const orderId = item.data?.orderId;
    if (orderId) {
      router.push(`/(app)/jobs/${orderId}` as any);
      return;
    }

    const targetByType: Record<string, string> = {
      PAYMENT: '/(tabs)/earnings',
      TRAINING: '/(app)/training',
      COMMUNITY: '/(tabs)/community',
      GAMIFICATION: '/(app)/gamification',
    };
    const target = targetByType[String(item.type ?? '').toUpperCase()];
    if (target) router.push(target as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader
        title="Notifications"
        subtitle="Dispatch, account, wallet, and review alerts"
        canGoBack
        right={<StatusPill status={unread > 0 ? 'PENDING' : 'ONLINE'} label={`${unread} unread`} />}
      />
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading || isRefetching} onRefresh={refetch} tintColor={riderColors.green} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        ListHeaderComponent={unread > 0 ? <RiderButton label="Mark all read" variant="light" icon="checkmark-done" loading={markAll.isPending} onPress={() => markAll.mutate()} style={{ marginBottom: 4 }} /> : null}
        ListEmptyComponent={!isLoading ? <EmptyState icon="notifications-outline" title="No notifications" body="Important rider updates will collect here." /> : null}
        renderItem={({ item }) => {
          const isUnread = item.isRead !== true && !item.readAt;
          return (
            <TouchableOpacity activeOpacity={0.84} onPress={() => void openNotification(item)}>
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
