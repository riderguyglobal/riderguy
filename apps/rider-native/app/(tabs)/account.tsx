import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import { useQuery } from '@tanstack/react-query';
import { BrandHeader } from '@/components/rider-ui';
import { RiderNavigationMenu } from '@/components/rider-navigation-menu';
import { cleanLabel, initials, riderColors, riderFonts, riderShadow } from '@/lib/rider-design';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

type IconName = keyof typeof Ionicons.glyphMap;

type RiderVehicle = {
  id: string;
  type: string;
  make: string;
  model: string;
  isPrimary: boolean;
  reviewStatus: string;
};

type RiderProfile = {
  id: string;
  onboardingStatus: string;
  availability?: string | null;
  isVerified: boolean;
  averageRating: number;
  totalDeliveries: number;
  completionRate?: number | null;
  publicProfileUrl?: string | null;
  preferredVehicleType: string | null;
  currentZone: { id: string; name: string } | null;
  vehicles: RiderVehicle[];
};

type ProfileRow = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

function formatMemberSince(createdAt?: string) {
  if (!createdAt) return 'New member';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'New member';
  return `Since ${date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
}

function displayRiderId(profile?: RiderProfile | null) {
  if (profile?.publicProfileUrl) return `@${profile.publicProfileUrl}`;
  return profile?.id ?? 'Pending verification';
}

function percentageFromRatio(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const number = Number(value);
  return Math.max(0, Math.min(100, number <= 1 ? number * 100 : number));
}

export default function AccountScreen() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, api, logout } = useAuth();
  const { unreadCount } = useUnreadNotifications();

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    isRefetching: profileRefetching,
    refetch: refetchProfile,
  } = useQuery<RiderProfile | null>({
    queryKey: ['rider-profile'],
    queryFn: async () => {
      const { data } = await api.get('/riders/profile');
      return (data.data ?? data) as RiderProfile | null;
    },
    enabled: Boolean(user?.id),
  });

  const {
    data: gamification,
    isLoading: gamificationLoading,
    isError: gamificationError,
    isRefetching: gamificationRefetching,
    refetch: refetchGamification,
  } = useQuery({
    queryKey: ['gamification-profile'],
    queryFn: async () => {
      const { data } = await api.get('/gamification/profile');
      return data.data ?? data;
    },
    enabled: Boolean(user?.id),
    retry: false,
  });

  const onboardingStatus = String(profile?.onboardingStatus ?? '').toUpperCase();
  const active =
    ['ACTIVATED', 'APPROVED'].includes(onboardingStatus) && profile?.isVerified === true;
  const availability = String(profile?.availability ?? '').toUpperCase();
  const statusLabel = profileLoading
    ? 'Checking status'
    : profileError || !profile
      ? 'Unavailable'
      : availability === 'ON_DELIVERY'
        ? 'Delivering'
        : active
          ? 'Active'
          : cleanLabel(onboardingStatus);
  const riderId = displayRiderId(profile);
  const completionRate = percentageFromRatio(profile?.completionRate);
  const level = gamificationLoading
    ? 'Loading…'
    : gamificationError
      ? 'Unavailable'
      : String(gamification?.levelName ?? gamification?.level ?? 'Not ranked');

  const confirmLogout = () => {
    Alert.alert('Log out of RiderGuy?', 'You will need to sign in again to receive deliveries.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const openSecurity = useCallback(() => {
    Alert.alert('Privacy & Security', 'Choose what you want to manage.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Security PIN',
        onPress: () => {
          Alert.alert('Security PIN', 'Choose the PIN action that matches your account.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Set first PIN',
              onPress: () => router.push('/(app)/settings/security/set-pin' as any),
            },
            {
              text: 'Change PIN',
              onPress: () => router.push('/(app)/settings/security/change-pin' as any),
            },
          ]);
        },
      },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: () => router.push('/(app)/settings/delete-account' as any),
      },
    ]);
  }, []);

  const groups = useMemo<{ title: string; rows: ProfileRow[] }[]>(
    () => [
      {
        title: 'Account',
        rows: [
          {
            icon: 'person-outline',
            label: 'Personal Information',
            onPress: () => router.push('/(app)/settings/profile' as any),
          },
          {
            icon: 'call-outline',
            label: 'Contact Details',
            onPress: () => router.push('/(app)/settings/profile' as any),
          },
          {
            icon: 'wallet-outline',
            label: 'Bank & Wallet',
            onPress: () => router.push('/(tabs)/earnings' as any),
          },
        ],
      },
      {
        title: 'Work & Verification',
        rows: [
          {
            icon: 'bicycle-outline',
            label: 'Add a Vehicle',
            onPress: () => router.push('/(app)/onboarding/vehicle' as any),
          },
          {
            icon: 'document-text-outline',
            label: 'Documents & KYC',
            onPress: () =>
              Alert.alert(
                'Documents & KYC',
                'To replace an approved identity document, contact RiderGuy Support so your verification stays protected.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Contact support',
                    onPress: () => router.push('/(app)/settings/about' as any),
                  },
                ],
              ),
          },
          {
            icon: 'school-outline',
            label: 'Training Certificates',
            onPress: () => router.push('/(app)/training' as any),
          },
          {
            icon: 'bicycle',
            label: 'Asset Financing',
            onPress: () => router.push('/(app)/asset-financing' as any),
          },
        ],
      },
      {
        title: 'Preferences',
        rows: [
          {
            icon: 'notifications-outline',
            label: 'Notifications',
            onPress: () => router.push('/(app)/notifications' as any),
          },
          { icon: 'shield-checkmark-outline', label: 'Privacy & Security', onPress: openSecurity },
          {
            icon: 'globe-outline',
            label: 'Language',
            onPress: () => Alert.alert('Language', 'RiderGuy is currently available in English.'),
          },
          {
            icon: 'settings-outline',
            label: 'App Settings',
            onPress: () => void Linking.openSettings(),
          },
        ],
      },
    ],
    [openSecurity],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BrandHeader
        onMenu={() => setMenuOpen(true)}
        onNotifications={() => router.push('/(app)/notifications')}
        unread={unreadCount > 0}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={profileRefetching || gamificationRefetching}
            onRefresh={() => void Promise.all([refetchProfile(), refetchGamification()])}
            tintColor={riderColors.green}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.pageHeading}>
          <Text style={styles.pageTitle}>Profile & Settings</Text>
          <Text style={styles.pageSubtitle}>Manage your account, documents, and preferences.</Text>
        </View>

        <View style={styles.identityCard}>
          <View style={styles.identityGlowLarge} />
          <View style={styles.identityGlowSmall} />
          <View style={styles.identityRow}>
            <View style={styles.avatarWrap}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} resizeMode="cover" style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>
                    {initials(user?.firstName, user?.lastName)}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                activeOpacity={0.84}
                onPress={() => router.push('/(app)/settings/profile' as any)}
                style={styles.cameraButton}
              >
                <Ionicons name="camera-outline" size={17} color={riderColors.greenDark} />
              </TouchableOpacity>
            </View>

            <View style={styles.identityCopy}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.profileName}>
                  {user?.firstName ?? 'Rider'} {user?.lastName ?? ''}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                  onPress={() => router.push('/(app)/settings/profile' as any)}
                  activeOpacity={0.82}
                  style={styles.editButton}
                >
                  <Ionicons name="pencil-outline" size={13} color={riderColors.white} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Share rider ID ${riderId}`}
                activeOpacity={0.82}
                onPress={() => void Share.share({ message: `My RiderGuy rider ID is ${riderId}` })}
                style={styles.riderIdRow}
              >
                <Text style={styles.riderId}>{riderId}</Text>
                <Ionicons name="copy-outline" size={15} color="#DDF7E9" />
              </TouchableOpacity>

              <View style={styles.identityMeta}>
                <Ionicons name="star" size={16} color="#FFE16A" />
                <Text style={styles.rating}>
                  {profileLoading
                    ? '…'
                    : profileError || !profile
                      ? '—'
                      : Number(profile.averageRating ?? 0).toFixed(1)}
                </Text>
                <View style={styles.metaDivider} />
                <View style={styles.activePill}>
                  <View style={[styles.activeDot, !active ? styles.pendingDot : null]} />
                  <Text style={styles.activeText}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.memberSince}>{formatMemberSince(user?.createdAt)}</Text>
            </View>
          </View>
        </View>

        {profileError || gamificationError ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry unavailable profile information"
            activeOpacity={0.82}
            onPress={() => void Promise.all([refetchProfile(), refetchGamification()])}
            style={styles.dataNotice}
          >
            <Ionicons name="cloud-offline-outline" size={20} color={riderColors.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dataNoticeTitle}>Some profile details are unavailable</Text>
              <Text style={styles.dataNoticeBody}>
                Tap to retry. Unavailable values are not shown as zero.
              </Text>
            </View>
            <Ionicons name="refresh" size={18} color={riderColors.greenDark} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.metricsCard}>
          <ProfileMetric
            icon="briefcase-outline"
            label="Deliveries"
            value={
              profileLoading
                ? '…'
                : profileError || !profile
                  ? '—'
                  : String(profile.totalDeliveries)
            }
          />
          <View style={styles.metricDivider} />
          <ProfileMetric
            icon="shield-checkmark-outline"
            label="Completion Rate"
            value={
              completionRate === null
                ? profileLoading
                  ? '…'
                  : '—'
                : `${Math.round(completionRate)}%`
            }
          />
          <View style={styles.metricDivider} />
          <ProfileMetric icon="trophy-outline" label="Level" value={level} />
        </View>

        {groups.map((group) => (
          <View key={group.title} style={styles.settingsCard}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.rows.map((row, index) => (
              <ProfileListRow key={row.label} {...row} divided={index < group.rows.length - 1} />
            ))}
          </View>
        ))}

        <View style={styles.supportBand}>
          <SupportLink
            icon="headset-outline"
            title="Help & Support"
            body="Get help and support"
            onPress={() => router.push('/(app)/settings/about' as any)}
          />
          <View style={styles.supportDivider} />
          <SupportLink
            icon="shield-checkmark-outline"
            title="Safety Center"
            body="Guidance and emergency help"
            onPress={() => router.push('/(app)/safety' as any)}
          />
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Log out"
          activeOpacity={0.84}
          onPress={confirmLogout}
          style={styles.logoutButton}
        >
          <Ionicons name="log-out-outline" size={22} color={riderColors.red} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      <RiderNavigationMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}

function ProfileMetric({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={20} color={riderColors.greenDark} />
      </View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.metricValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ProfileListRow({ icon, label, onPress, divided }: ProfileRow & { divided: boolean }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.78}
      onPress={onPress}
      style={[styles.settingsRow, divided ? styles.settingsRowDivided : null]}
    >
      <Ionicons name={icon} size={21} color={riderColors.greenDark} />
      <Text style={styles.settingsLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#7B827E" />
    </TouchableOpacity>
  );
}

function SupportLink({
  icon,
  title,
  body,
  onPress,
}: {
  icon: IconName;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.supportLink}
    >
      <View style={styles.supportIcon}>
        <Ionicons name={icon} size={22} color={riderColors.greenDark} />
      </View>
      <View style={styles.supportCopy}>
        <Text style={styles.supportTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.supportBody} numberOfLines={1}>
          {body}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={riderColors.greenDark} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: riderColors.white },
  content: { paddingHorizontal: 16, paddingBottom: 30 },
  pageHeading: { paddingTop: 7, paddingBottom: 14 },
  pageTitle: {
    color: riderColors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: riderFonts.extrabold,
    fontWeight: '900',
  },
  pageSubtitle: {
    color: riderColors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: riderFonts.regular,
    marginTop: 3,
  },
  identityCard: {
    minHeight: 160,
    borderRadius: 14,
    backgroundColor: '#13955D',
    padding: 14,
    overflow: 'hidden',
    ...riderShadow,
  },
  identityGlowLarge: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -72,
    bottom: -155,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  identityGlowSmall: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    right: 12,
    bottom: -112,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  identityRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatarWrap: { width: 94, height: 100, justifyContent: 'center' },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 4,
    borderColor: riderColors.white,
    backgroundColor: riderColors.greenSoft,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDF5E8',
  },
  avatarInitials: {
    color: riderColors.greenDark,
    fontSize: 25,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  cameraButton: {
    position: 'absolute',
    right: 1,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: riderColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D8F2E5',
  },
  dataNotice: {
    minHeight: 62,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F1C9C5',
    backgroundColor: riderColors.redSoft,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dataNoticeTitle: {
    color: riderColors.ink,
    fontSize: 11.5,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  dataNoticeBody: {
    color: riderColors.muted,
    fontSize: 9.5,
    lineHeight: 14,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  identityCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  profileName: {
    flex: 1,
    minWidth: 0,
    color: riderColors.white,
    fontSize: 19,
    lineHeight: 24,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  editButton: {
    minWidth: 66,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  editButtonText: {
    color: riderColors.white,
    fontSize: 10.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
  },
  riderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  riderId: {
    color: '#E6FAEF',
    fontSize: 13.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
  },
  identityMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  rating: {
    color: riderColors.white,
    fontSize: 12.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
  },
  metaDivider: {
    width: 1,
    height: 17,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginHorizontal: 3,
  },
  activePill: {
    minHeight: 25,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.27)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C9FFDF' },
  pendingDot: { backgroundColor: '#FFE6A6' },
  activeText: {
    color: riderColors.white,
    fontSize: 10,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
  },
  memberSince: {
    color: '#DDF6E9',
    fontSize: 10.5,
    fontFamily: riderFonts.regular,
    marginTop: 7,
  },
  metricsCard: {
    minHeight: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDF1EF',
    backgroundColor: riderColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    marginTop: 11,
    ...riderShadow,
  },
  metric: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 5,
    minWidth: 0,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: riderColors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCopy: { flex: 1, minWidth: 0 },
  metricLabel: {
    color: riderColors.muted,
    fontSize: 8.5,
    lineHeight: 12,
    fontFamily: riderFonts.regular,
  },
  metricValue: {
    color: riderColors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
    marginTop: 1,
  },
  metricDivider: { width: 1, height: 48, backgroundColor: riderColors.line },
  settingsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDF1EF',
    backgroundColor: riderColors.white,
    paddingHorizontal: 13,
    paddingTop: 11,
    marginTop: 11,
    overflow: 'hidden',
    ...riderShadow,
  },
  groupTitle: {
    color: riderColors.ink,
    fontSize: 13.5,
    lineHeight: 18,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
    marginBottom: 2,
  },
  settingsRow: {
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 2,
  },
  settingsRowDivided: { borderBottomWidth: 1, borderBottomColor: '#EEF2F0' },
  settingsLabel: {
    flex: 1,
    color: '#202421',
    fontSize: 12,
    fontFamily: riderFonts.regular,
    fontWeight: '500',
  },
  supportBand: {
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCEFE5',
    backgroundColor: '#F2FBF6',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
    paddingHorizontal: 9,
  },
  supportLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  supportIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E1F5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCopy: { flex: 1, minWidth: 0 },
  supportTitle: {
    color: riderColors.ink,
    fontSize: 10.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
  supportBody: {
    color: riderColors.muted,
    fontSize: 8.5,
    fontFamily: riderFonts.regular,
    marginTop: 1,
  },
  supportDivider: { width: 1, height: 46, backgroundColor: '#DCE8E2', marginHorizontal: 5 },
  logoutButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFE4E3',
    backgroundColor: riderColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 11,
    ...riderShadow,
  },
  logoutText: {
    color: riderColors.red,
    fontSize: 13.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
});
