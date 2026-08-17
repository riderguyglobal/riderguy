import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import { colors, shadow } from '@/design/client';

const PRIMARY_ITEMS = [
  { icon: 'person-outline' as const, label: 'Edit Profile', sub: 'Name, email, phone', route: '/(app)/settings/profile' },
  { icon: 'card-outline' as const, label: 'Payment Methods', sub: 'Cards, wallet, MoMo', route: '/(app)/settings/payment-methods' },
  { icon: 'lock-closed-outline' as const, label: 'Security & PIN', sub: 'PIN and quick sign-in', route: '/(app)/settings/security/set-pin' },
  { icon: 'notifications-outline' as const, label: 'Notifications', sub: 'Delivery and promo alerts', route: '/(app)/settings/notifications' },
];

const SHORTCUTS = [
  { icon: 'location-outline' as const, label: 'Addresses', route: '/(app)/saved-addresses' },
  { icon: 'heart-outline' as const, label: 'Riders', route: '/(app)/favorite-riders' },
  { icon: 'shield-checkmark-outline' as const, label: 'Safety', route: '/(app)/safety-center' },
  { icon: 'help-circle-outline' as const, label: 'Help', route: '/(app)/settings/help' },
];

function initials(user: any) {
  return `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U';
}

export default function AccountScreen() {
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 18, overflow: 'hidden', ...shadow.float }}>
          <View style={{ position: 'absolute', right: -48, top: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(10,185,87,0.18)' }} />
          <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '800' }}>RiderGuy account</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 26, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{initials(user)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 21, fontWeight: '900', letterSpacing: -0.4 }}>{user?.firstName ?? 'RiderGuy'} {user?.lastName ?? ''}</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 3 }}>{user?.phone ?? user?.email ?? 'Client profile'}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(app)/settings/profile')} style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="create-outline" size={19} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          {SHORTCUTS.map((item) => (
            <TouchableOpacity key={item.label} onPress={() => router.push(item.route as any)} style={{ flex: 1, minHeight: 78, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EEF2F7' }}>
              <Ionicons name={item.icon} size={22} color={colors.brandDark} />
              <Text style={{ color: colors.ink, fontSize: 10.5, fontWeight: '900', marginTop: 7 }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ marginTop: 16, borderRadius: 24, backgroundColor: '#fff', overflow: 'hidden', borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          {PRIMARY_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route as any)}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: index === PRIMARY_ITEMS.length - 1 ? 0 : 1, borderBottomColor: '#F3F4F6' }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 15, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={item.icon} size={19} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '900' }}>{item.label}</Text>
                <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 2 }}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={() => router.push('/(app)/settings/about')} style={{ marginTop: 12, borderRadius: 20, backgroundColor: '#fff', padding: 15, borderWidth: 1, borderColor: '#EEF2F7', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="information-circle-outline" size={22} color={colors.blue} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '900' }}>About RiderGuy</Text>
            <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 2 }}>Version, terms, privacy and company info</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(app)/settings/delete-account' as any)} style={{ marginTop: 12, borderRadius: 20, backgroundColor: '#FEF2F2', padding: 15, borderWidth: 1, borderColor: '#FECACA', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="trash-outline" size={22} color={colors.red} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.red, fontSize: 13, fontWeight: '900' }}>Delete Account</Text>
            <Text style={{ color: '#B91C1C', fontSize: 11, marginTop: 2 }}>Request permanent account deletion</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.red} />
        </TouchableOpacity>

        <TouchableOpacity onPress={confirmLogout} style={{ marginTop: 16, height: 54, borderRadius: 18, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.red, fontSize: 14, fontWeight: '900' }}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', color: '#CBD5E1', fontSize: 11, marginTop: 18, fontWeight: '700' }}>RiderGuy v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
