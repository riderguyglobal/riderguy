import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { EmptyState, ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';
import { useAuth } from '@riderguy/auth-native';

function iconFor(type?: string) {
  const lower = (type ?? '').toLowerCase();
  if (lower.includes('order') || lower.includes('delivery')) return 'cube-outline' as const;
  if (lower.includes('payment') || lower.includes('wallet')) return 'wallet-outline' as const;
  if (lower.includes('promo')) return 'pricetag-outline' as const;
  return 'notifications-outline' as const;
}

export default function NotificationsScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications', { params: { pageSize: 50 } });
      return (data.data ?? data) as any[];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'All caught up' });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const rows = notificationsQuery.data ?? [];
  const unread = rows.filter((item) => !(item.isRead ?? item.read)).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader
        title="Activity Inbox"
        subtitle={unread ? `${unread} unread update${unread > 1 ? 's' : ''}` : 'Every delivery update in one place'}
        right={unread > 0 ? (
          <TouchableOpacity onPress={() => markAllRead.mutate()} style={{ borderRadius: 999, backgroundColor: colors.brandSoft, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: colors.brandDark, fontSize: 11, fontWeight: '900' }}>Read all</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={notificationsQuery.isFetching} onRefresh={notificationsQuery.refetch} tintColor={colors.brand} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 10 }}
        ListHeaderComponent={
          rows.length > 0 ? (
            <View style={{ borderRadius: 24, backgroundColor: unread ? colors.ink : '#fff', padding: 18, marginBottom: 4, borderWidth: unread ? 0 : 1, borderColor: '#EEF2F7' }}>
              <Text style={{ color: unread ? '#fff' : colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>{unread ? 'Needs your eye' : "You're all caught up"}</Text>
              <Text style={{ color: unread ? '#9CA3AF' : colors.subtle, fontSize: 12, lineHeight: 18, marginTop: 5 }}>
                {unread ? 'Unread updates are pinned visually so nothing important gets buried.' : 'We will notify you when riders, payments, or promos need attention.'}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !notificationsQuery.isLoading ? (
            <EmptyState icon="notifications-outline" title="No notifications yet" body="Delivery updates, receipts, and promo alerts will appear here." />
          ) : null
        }
        renderItem={({ item }) => {
          const read = item.isRead ?? item.read;
          return (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                if (!read) markRead.mutate(item.id);
                if (item.orderId) router.push(`/(app)/orders/${item.orderId}` as any);
              }}
              style={{ borderRadius: 20, backgroundColor: '#fff', padding: 15, borderWidth: 1, borderColor: read ? '#EEF2F7' : 'rgba(10,185,87,0.28)', flexDirection: 'row', gap: 12, ...shadow.card }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 18, backgroundColor: read ? '#F3F4F6' : colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={iconFor(item.type)} size={20} color={read ? colors.muted : '#fff'} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: '900' }} numberOfLines={1}>{item.title}</Text>
                  {!read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand }} />}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }} numberOfLines={2}>{item.body ?? item.message}</Text>
                <Text style={{ color: colors.subtle, fontSize: 10.5, marginTop: 6, fontWeight: '700' }}>{new Date(item.createdAt).toLocaleString('en-GB')}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
