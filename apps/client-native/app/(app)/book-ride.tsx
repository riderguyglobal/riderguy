import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

const READINESS = [
  { icon: 'shield-checkmark-outline', title: 'Verified riders', body: 'Ride-hailing will only launch with trained and identity-checked riders.' },
  { icon: 'navigate-outline', title: 'Live route visibility', body: 'Trips will use the same map-first tracking pattern as deliveries.' },
  { icon: 'wallet-outline', title: 'Clear fare before request', body: 'You will see the fare, pickup, and destination before confirming.' },
];

export default function BookRideScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Book a Ride" subtitle="Personal trips, built carefully" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
          <View style={{ position: 'absolute', right: -48, top: -44, width: 154, height: 154, borderRadius: 77, backgroundColor: 'rgba(245,158,11,0.22)' }} />
          <View style={{ width: 62, height: 62, borderRadius: 24, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="bicycle" size={30} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -0.9, marginTop: 18 }}>Bike trips are being tuned.</Text>
          <Text style={{ color: '#D1D5DB', fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 10 }}>
            Delivery is live first. Personal ride booking will open when safety, pricing, and rider supply are ready for your city.
          </Text>
        </View>

        <View style={{ marginTop: 16, gap: 12 }}>
          {READINESS.map((item) => (
            <View key={item.title} style={{ borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', flexDirection: 'row', gap: 13, ...shadow.card }}>
              <View style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={item.icon as any} size={22} color={colors.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '900' }}>{item.title}</Text>
                <Text style={{ color: colors.subtle, fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 4 }}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={() => router.push('/(app)/quick-send' as any)} style={{ marginTop: 18, height: 56, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...shadow.brand }}>
          <Ionicons name="cube-outline" size={19} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Send a Package Instead</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
