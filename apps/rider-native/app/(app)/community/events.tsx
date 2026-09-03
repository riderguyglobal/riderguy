import { FlatList, Text, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { EmptyState, RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { dateTime, riderColors } from '@/lib/rider-design';

export default function EventsScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['community-events'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/events?limit=30&status=UPCOMING');
        const payload = data.data ?? data;
        return payload.events ?? payload;
      } catch (error: any) {
        if (error?.response?.status === 400) return [];
        throw error;
      }
    },
  });

  const rsvp = useMutation({
    mutationFn: async ({ id, isGoing }: { id: string; isGoing: boolean }) =>
      isGoing ? api.delete(`/events/${id}/rsvp`) : api.post(`/events/${id}/rsvp`),
    onSuccess: async (_response, variables) => {
      await qc.invalidateQueries({ queryKey: ['community-events'] });
      Toast.show({
        type: 'success',
        text1: variables.isGoing ? 'RSVP cancelled.' : 'RSVP confirmed.',
      });
    },
    onError: (error: any) =>
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.error?.message ?? 'Could not update your RSVP.',
      }),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader
        title="Rider events"
        subtitle="Clinics, meetups, and training days"
        canGoBack
        right={<StatusPill status="ONLINE" label={`${(data ?? []).length}`} />}
      />
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={riderColors.green}
          />
        }
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="calendar-outline"
              title="No upcoming events"
              body="Rider meetups and clinics will appear here when scheduled."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <RiderCard style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ backgroundColor: riderColors.ink, padding: 16 }}>
              <Text style={{ color: riderColors.white, fontSize: 18, fontWeight: '900' }}>
                {item.title}
              </Text>
              <Text style={{ color: '#9fb0c4', fontSize: 12, marginTop: 4 }}>
                {item.type?.replace(/_/g, ' ') ?? 'Event'}
              </Text>
            </View>
            <View style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
                <Ionicons name="calendar-outline" size={17} color={riderColors.greenDark} />
                <Text style={{ color: riderColors.ink, fontWeight: '800', flex: 1 }}>
                  {dateTime(item.date)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
                <Ionicons name="location-outline" size={17} color={riderColors.red} />
                <Text style={{ color: riderColors.muted, fontWeight: '800', flex: 1 }}>
                  {item.location ?? item.virtualLink ?? 'Online'}
                </Text>
              </View>
              {item.description ? (
                <Text
                  style={{ color: riderColors.muted, fontSize: 13, lineHeight: 20 }}
                  numberOfLines={3}
                >
                  {item.description}
                </Text>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 2,
                }}
              >
                <StatusPill status="PENDING" label={`${item._count?.rsvps ?? 0} going`} />
                <RiderButton
                  label={item.hasRsvp ? 'Cancel RSVP' : 'RSVP'}
                  icon={item.hasRsvp ? 'close-circle-outline' : 'checkmark-circle'}
                  variant={item.hasRsvp ? 'light' : 'primary'}
                  loading={rsvp.isPending && rsvp.variables?.id === item.id}
                  disabled={rsvp.isPending && rsvp.variables?.id === item.id}
                  onPress={() => rsvp.mutate({ id: item.id, isGoing: Boolean(item.hasRsvp) })}
                  style={{ minHeight: 42, borderRadius: 14 }}
                />
              </View>
            </View>
          </RiderCard>
        )}
      />
    </SafeAreaView>
  );
}
