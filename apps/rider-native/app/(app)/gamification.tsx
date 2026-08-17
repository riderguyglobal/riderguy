import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { MetricTile, ProgressBar, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { compactDate, initials, riderColors } from '@/lib/rider-design';

export default function GamificationScreen() {
  const { api } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['gamification-profile'],
    queryFn: async () => {
      const { data } = await api.get('/gamification/profile');
      return data.data ?? data;
    },
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['gamification-leaderboard-week'],
    queryFn: async () => {
      const { data } = await api.get('/gamification/leaderboard?timeRange=week&category=xp&limit=12');
      return (data.data ?? data) as any[];
    },
  });

  const currentLevel = profile?.currentLevel ?? profile?.level ?? 1;
  const progress = profile?.progressPercent ?? 0;
  const badges = profile?.badges ?? [];
  const xp = profile?.totalXp ?? profile?.xp ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Progress hub" subtitle="Levels, badges, streaks, leaderboards" canGoBack right={<StatusPill status="ONLINE" label={`${xp} XP`} />} />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={riderColors.green} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
          <RiderCard dark>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <View>
                <Text style={{ color: '#9fb0c4', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>Current level</Text>
                <Text style={{ color: riderColors.white, fontSize: 38, fontWeight: '900', marginTop: 3 }}>Level {currentLevel}</Text>
                <Text style={{ color: '#9fb0c4', fontSize: 13, marginTop: 2 }}>{profile?.levelName ?? 'Rider level'}</Text>
              </View>
              <View style={{ width: 78, height: 78, borderRadius: 28, backgroundColor: '#142942', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#26405f' }}>
                <Ionicons name="ribbon" size={33} color={riderColors.green} />
              </View>
            </View>
            <ProgressBar progress={progress} color={riderColors.green} />
            <Text style={{ color: '#9fb0c4', fontSize: 12, marginTop: 10 }}>
              {profile?.currentLevelXp ?? 0}/{profile?.nextLevelXp ?? 0} XP to next level
            </Text>
          </RiderCard>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <MetricTile label="Badges" value={String(badges.length)} icon="medal-outline" tone="amber" />
            <MetricTile label="Recent XP" value={String(profile?.recentXp?.length ?? 0)} icon="flash-outline" tone="green" />
            <MetricTile label="Unseen" value={String(profile?.unseenBadges?.length ?? 0)} icon="sparkles-outline" tone="violet" />
          </View>

          {badges.length > 0 ? (
            <RiderCard>
              <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '900', marginBottom: 12 }}>Badges</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {badges.slice(0, 12).map((entry: any) => {
                  const badge = entry.badge ?? entry;
                  return (
                    <View key={badge.id ?? entry.id} style={{ width: '30%', minHeight: 98, borderRadius: 16, backgroundColor: riderColors.panelAlt, alignItems: 'center', justifyContent: 'center', padding: 10 }}>
                      <Text style={{ fontSize: 24 }}>{badge.icon ?? '*'}</Text>
                      <Text style={{ color: riderColors.ink, fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 6 }} numberOfLines={2}>{badge.name}</Text>
                    </View>
                  );
                })}
              </View>
            </RiderCard>
          ) : null}

          <RiderCard>
            <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '900', marginBottom: 10 }}>Weekly leaderboard</Text>
            {(leaderboard ?? []).slice(0, 10).map((entry: any, index: number) => (
              <View key={entry.riderId ?? index} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: index < Math.min((leaderboard ?? []).length, 10) - 1 ? 1 : 0, borderBottomColor: riderColors.line }}>
                <Text style={{ width: 28, color: index < 3 ? riderColors.greenDark : riderColors.soft, fontWeight: '900' }}>{entry.rank ?? index + 1}</Text>
                <View style={{ width: 36, height: 36, borderRadius: 14, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ color: riderColors.greenDark, fontWeight: '900' }}>{initials(entry.riderName?.split(' ')[0], entry.riderName?.split(' ')[1], '?')}</Text>
                </View>
                <Text style={{ flex: 1, color: riderColors.ink, fontWeight: '900' }}>{entry.riderName}</Text>
                <Text style={{ color: riderColors.greenDark, fontWeight: '900' }}>{entry.totalXp ?? entry.xp ?? 0} XP</Text>
              </View>
            ))}
          </RiderCard>

          {profile?.recentXp?.length ? (
            <RiderCard>
              <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '900', marginBottom: 8 }}>Recent XP</Text>
              {profile.recentXp.slice(0, 6).map((event: any) => (
                <View key={event.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }}>
                  <Text style={{ color: riderColors.muted, fontWeight: '800' }}>{event.action?.replace(/_/g, ' ')}</Text>
                  <Text style={{ color: riderColors.greenDark, fontWeight: '900' }}>+{event.points} - {compactDate(event.createdAt)}</Text>
                </View>
              ))}
            </RiderCard>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
