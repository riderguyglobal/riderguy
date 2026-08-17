import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import { useQuery } from '@tanstack/react-query';
import {
  ActionBand,
  BrandHeader,
  OverviewPanel,
  RiderButton,
  RiderCard,
  SettingsListItem,
} from '@/components/rider-ui';
import { cleanLabel, riderColors } from '@/lib/rider-design';

const MENU_ITEMS = [
  { icon: 'person' as const, label: 'Personal Information', sub: 'Update your personal details', route: '/(app)/settings/profile' },
  { icon: 'bicycle' as const, label: 'Vehicle Information', sub: 'Manage your vehicle details', route: '/(app)/onboarding/vehicle' },
  { icon: 'wallet' as const, label: 'Payout Information', sub: 'Manage your bank and payout settings', route: '/(tabs)/earnings' },
  { icon: 'shield' as const, label: 'Safety Center', sub: 'Tools and resources for your safety', route: '/(app)/settings/about' },
  { icon: 'headset' as const, label: 'Help & Support', sub: 'Get help and contact support', route: '/(app)/settings/about' },
  { icon: 'settings' as const, label: 'App Settings', sub: 'Preferences and app configuration', route: '/(app)/settings/security/set-pin' },
];
const profileImage = require('../../assets/images/illustrations/rider-profile.png');

function formatMemberSince(createdAt?: string) {
  if (!createdAt) return '—';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function AccountScreen() {
  const { user, api, logout } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['rider-profile'],
    queryFn: async () => {
      const { data } = await api.get('/riders/profile');
      return data.data ?? data;
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.white }} edges={['top']}>
      <BrandHeader
        onMenu={() => router.push('/(tabs)' as any)}
        onNotifications={() => router.push('/(app)/notifications')}
        unread
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingTop: 20, paddingBottom: 24 }}>
          <View>
            <Image source={user?.avatarUrl ? { uri: user.avatarUrl } : profileImage} resizeMode="cover" style={{ width: 128, height: 128, borderRadius: 64 }} />
            <TouchableOpacity onPress={() => router.push('/(app)/settings/profile')} activeOpacity={0.86} style={{ position: 'absolute', right: -2, bottom: 8, width: 42, height: 42, borderRadius: 21, backgroundColor: riderColors.greenDark, borderWidth: 4, borderColor: riderColors.white, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="camera" size={18} color={riderColors.white} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: riderColors.ink, fontSize: 30, fontWeight: '900', lineHeight: 35 }} numberOfLines={2}>
              {user?.firstName ?? 'Rider'} {user?.lastName ?? ''}
            </Text>
            <View style={{ alignSelf: 'flex-start', marginTop: 10, borderRadius: 8, backgroundColor: riderColors.greenSoft, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Ionicons name="checkmark-circle" size={18} color={riderColors.greenDark} />
              <Text style={{ color: riderColors.greenDark, fontSize: 13, fontWeight: '900' }}>{cleanLabel(profile?.onboardingStatus ?? 'Verified')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <Ionicons name="star" size={20} color={riderColors.greenDark} />
              <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900' }}>{(profile?.averageRating ?? 0).toFixed(1)}</Text>
              <Text style={{ color: riderColors.muted, fontSize: 16 }}>Rating</Text>
              <Text style={{ color: riderColors.muted, fontSize: 16 }}>-</Text>
              <Text style={{ color: riderColors.ink, fontSize: 16, fontWeight: '900' }}>{profile?.totalDeliveries ?? 0}</Text>
              <Text style={{ color: riderColors.muted, fontSize: 16 }}>Deliveries</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/(app)/settings/profile')} activeOpacity={0.84} style={{ width: 38, height: 54, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-forward" size={29} color={riderColors.muted} />
          </TouchableOpacity>
        </View>

        <View style={{ gap: 14 }}>
          <ActionBand
            icon="shield-checkmark"
            title={(profile?.averageRating ?? 0) >= 4.5 && (profile?.totalDeliveries ?? 0) > 0 ? "You're a Top Rider!" : 'Grow your rider level'}
            body={(profile?.averageRating ?? 0) >= 4.5 && (profile?.totalDeliveries ?? 0) > 0 ? 'Great job! Keep delivering excellence.' : 'Complete deliveries and earn XP to unlock perks.'}
            onPress={() => router.push('/(app)/gamification')}
          />

          <OverviewPanel
            title="Account Overview"
            items={[
              { label: 'Member Since', value: formatMemberSince(user?.createdAt), icon: 'calendar', tone: 'green' },
              { label: 'Current City', value: profile?.city ?? 'Accra', icon: 'location', tone: 'green' },
              { label: 'Vehicle Type', value: cleanLabel(profile?.vehicleType ?? 'Motorbike'), icon: 'bicycle', tone: 'green' },
            ]}
          />

          <RiderCard style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 17, paddingBottom: 4 }}>
              <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>Account Settings</Text>
            </View>
            {MENU_ITEMS.map((item) => (
              <SettingsListItem
                key={item.label}
                icon={item.icon}
                title={item.label}
                body={item.sub}
                onPress={() => router.push(item.route as any)}
              />
            ))}
          </RiderCard>

          <RiderButton
            label="Delete Account"
            icon="trash"
            variant="danger"
            onPress={() => router.push('/(app)/settings/delete-account' as any)}
            style={{ marginTop: 8, backgroundColor: riderColors.white, borderColor: '#fecaca' }}
          />

          <RiderButton
            label="Log Out"
            icon="power"
            variant="danger"
            onPress={logout}
            style={{ marginTop: 8, backgroundColor: riderColors.white, borderColor: riderColors.line }}
          />
          <Text style={{ textAlign: 'center', color: riderColors.soft, fontSize: 11, marginTop: 4 }}>RiderGuy Rider v1.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
