import { FlatList, Text, View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { EmptyState, RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { initials, riderColors } from '@/lib/rider-design';

export default function MentorshipScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();
  const { data: mentors, isLoading, refetch } = useQuery({
    queryKey: ['mentors'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/mentorship/mentors?limit=30');
        const payload = data.data ?? data;
        return payload.mentors ?? payload;
      } catch (error: any) {
        if (error?.response?.status === 400) return [];
        throw error;
      }
    },
  });

  const { data: mine } = useQuery({
    queryKey: ['mentorship-mine'],
    queryFn: async () => {
      const { data } = await api.get('/mentorship/mine');
      return data.data ?? data;
    },
  });

  const request = useMutation({
    mutationFn: async (mentorId: string) => api.post('/mentorship/request', { mentorId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mentorship-mine'] });
      Toast.show({ type: 'success', text1: 'Mentorship request sent.' });
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not request mentorship.' }),
  });

  const activeCount = (mine?.asMentee ?? mine?.mentee ?? []).length + (mine?.asMentor ?? mine?.mentor ?? []).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Mentorship" subtitle="Find a rider who has already done the miles" canGoBack right={<StatusPill status="ONLINE" label={`${activeCount} active`} />} />
      <FlatList
        data={mentors ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={riderColors.green} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListHeaderComponent={
          <RiderCard dark style={{ marginBottom: 2 }}>
            <Text style={{ color: riderColors.white, fontSize: 18, fontWeight: '900' }}>Level up with a guide.</Text>
            <Text style={{ color: '#9fb0c4', fontSize: 13, lineHeight: 19, marginTop: 8 }}>
              Mentors are activated riders with strong delivery history. Request one and use check-ins to improve faster.
            </Text>
          </RiderCard>
        }
        ListEmptyComponent={!isLoading ? <EmptyState icon="school-outline" title="No mentors available" body="Top riders will appear here when they are available for mentorship." /> : null}
        renderItem={({ item }) => {
          const first = item.user?.firstName ?? item.firstName;
          const last = item.user?.lastName ?? item.lastName;
          return (
            <RiderCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: riderColors.violetSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: riderColors.violet, fontSize: 18, fontWeight: '900' }}>{initials(first, last)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 16, fontWeight: '900' }}>{first} {last}</Text>
                  <Text style={{ color: riderColors.muted, fontSize: 12, marginTop: 3 }}>
                    Level {item.currentLevel ?? item.level ?? 3} - {item.totalDeliveries ?? 0} deliveries
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
                    <Ionicons name="star" size={13} color={riderColors.amber} />
                    <Text style={{ color: riderColors.muted, fontSize: 12, fontWeight: '800' }}>{Number(item.averageRating ?? item.rating ?? 0).toFixed(1)}</Text>
                  </View>
                </View>
                <RiderButton label="Request" loading={request.isPending} onPress={() => request.mutate(item.id)} style={{ minHeight: 42, borderRadius: 14 }} />
              </View>
            </RiderCard>
          );
        }}
      />
    </SafeAreaView>
  );
}
