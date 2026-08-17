import { FlatList, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { EmptyState, RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

const QUICK_LINKS = [
  { icon: 'newspaper-outline' as const, label: 'Forum', body: 'Road tips and questions', route: '/(app)/community/forum', color: riderColors.blueSoft },
  { icon: 'calendar-outline' as const, label: 'Events', body: 'Meetups and clinics', route: '/(app)/community/events', color: riderColors.amberSoft },
  { icon: 'school-outline' as const, label: 'Mentorship', body: 'Learn from top riders', route: '/(app)/community/mentorship', color: riderColors.violetSoft },
  { icon: 'trophy-outline' as const, label: 'Leaderboard', body: 'XP and badges', route: '/(app)/gamification', color: riderColors.greenSoft },
];

export default function CommunityScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();

  const { data: rooms, isLoading, refetch } = useQuery({
    queryKey: ['community-rooms'],
    queryFn: async () => {
      const { data } = await api.get('/community/chat/rooms');
      return (data.data ?? data) as any[];
    },
  });

  const { data: zoneRooms } = useQuery({
    queryKey: ['community-zone-rooms'],
    queryFn: async () => {
      const { data } = await api.get('/community/chat/zones');
      return (data.data ?? data) as any[];
    },
  });

  const joinZone = useMutation({
    mutationFn: async (zoneId: string) => {
      const { data } = await api.post(`/community/chat/zones/${zoneId}/join`);
      return data.data ?? data;
    },
    onSuccess: async (result: any) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['community-rooms'] }),
        qc.invalidateQueries({ queryKey: ['community-zone-rooms'] }),
      ]);
      Toast.show({ type: 'success', text1: 'Joined room.' });
      if (result?.roomId) router.push(`/(app)/community/chat/${result.roomId}` as any);
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not join room.' }),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Rider crew" subtitle="Rooms, learning, and city updates" right={<StatusPill status="ONLINE" label={`${rooms?.length ?? 0} rooms`} />} />

      <FlatList
        data={rooms ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={riderColors.green} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 34 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 2 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {QUICK_LINKS.map((link) => (
                <TouchableOpacity key={link.label} activeOpacity={0.84} onPress={() => router.push(link.route as any)} style={{ width: '48%' }}>
                  <RiderCard style={{ minHeight: 124 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: link.color, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <Ionicons name={link.icon} size={22} color={riderColors.ink} />
                    </View>
                    <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>{link.label}</Text>
                    <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{link.body}</Text>
                  </RiderCard>
                </TouchableOpacity>
              ))}
            </View>

            {(zoneRooms ?? []).filter((room: any) => !room.isMember).slice(0, 2).map((room: any) => (
              <RiderCard key={room.id} dark>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: riderColors.white, fontSize: 16, fontWeight: '900' }}>{room.name}</Text>
                    <Text style={{ color: '#9fb0c4', fontSize: 12, marginTop: 3 }}>{room.memberCount ?? 0} riders in this room</Text>
                  </View>
                  <RiderButton label="Join" variant="light" loading={joinZone.isPending} disabled={!room.zoneId} onPress={() => joinZone.mutate(room.zoneId)} style={{ minHeight: 42, borderRadius: 14 }} />
                </View>
              </RiderCard>
            ))}

            <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '900', marginTop: 4 }}>Joined rooms</Text>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState icon="chatbubbles-outline" title="No joined rooms yet" body="Join a zone room to chat with nearby riders and dispatch support." />
          ) : null
        }
        renderItem={({ item }) => {
          const last = item.lastMessage;
          return (
            <TouchableOpacity activeOpacity={0.86} onPress={() => router.push(`/(app)/community/chat/${item.id}` as any)}>
              <RiderCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 18, backgroundColor: item.hasUnread ? riderColors.greenSoft : riderColors.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={item.type === 'DIRECT' ? 'person' : 'chatbubbles'} size={22} color={item.hasUnread ? riderColors.greenDark : riderColors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>{item.name}</Text>
                    <Text style={{ color: riderColors.muted, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                      {last ? `${last.senderName}: ${last.content}` : 'No messages yet'}
                    </Text>
                  </View>
                  {item.hasUnread ? <StatusPill status="ONLINE" label="New" /> : <Ionicons name="chevron-forward" size={18} color={riderColors.soft} />}
                </View>
              </RiderCard>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
