import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuth } from '@riderguy/auth-native';
import { EmptyState, ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

export default function FavoriteRidersScreen() {
  const { api } = useAuth();
  const qc = useQueryClient();

  const favoritesQuery = useQuery({
    queryKey: ['favorite-riders'],
    queryFn: async () => {
      const { data } = await api.get('/favorite-riders');
      return (data.data ?? data) as any[];
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (riderProfileId: string) => {
      await api.delete(`/favorite-riders/${riderProfileId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['favorite-riders'] });
      Toast.show({ type: 'success', text1: 'Removed from favourites' });
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Favourite Riders" subtitle="People you trust with deliveries" />
      <FlatList
        data={favoritesQuery.data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={favoritesQuery.isFetching} onRefresh={() => favoritesQuery.refetch()} tintColor={colors.brand} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        ListHeaderComponent={
          <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', marginBottom: 16, ...shadow.float }}>
            <View style={{ position: 'absolute', right: -44, top: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(239,68,68,0.20)' }} />
            <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Trusted list</Text>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 6 }}>Your best handoffs live here.</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 10 }}>
              Favourite a rider after a completed order to make future matching feel more personal.
            </Text>
          </View>
        }
        ListEmptyComponent={
          favoritesQuery.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 44 }} />
          ) : (
            <EmptyState icon="heart-outline" title="No favourites yet" body="After a great delivery, mark the rider as a favourite and they will appear here." />
          )
        }
        renderItem={({ item }) => {
          const rider = item.riderProfile;
          const user = rider?.user ?? item;
          const initials = `${user?.firstName?.[0] ?? 'R'}${user?.lastName?.[0] ?? ''}`.toUpperCase();
          return (
            <View style={{ borderRadius: 24, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 13, ...shadow.card }}>
              <View style={{ width: 58, height: 58, borderRadius: 23, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.brandDark, fontSize: 18, fontWeight: '900' }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900' }}>{user?.firstName} {user?.lastName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 }}>
                  <Ionicons name="star" size={14} color={colors.amber} />
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '800' }}>{Number(rider?.averageRating ?? 0).toFixed(1)} rating</Text>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '800' }}>{rider?.totalDeliveries ?? 0} trips</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => removeFavorite.mutate(item.riderProfileId ?? rider?.id)}
                disabled={removeFavorite.isPending}
                style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="heart" size={20} color={colors.red} />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
