import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

const CHECKS = [
  'Confirm the rider name before handing over a package.',
  'Keep sensitive instructions inside the in-app order notes or chat.',
  'Use live tracking for active deliveries instead of external location sharing.',
  'Report suspicious behaviour to support with the order number.',
];

export default function SafetyCenterScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Safety Center" subtitle="Trust, verification, and help" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
          <View style={{ position: 'absolute', right: -44, top: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(10,185,87,0.18)' }} />
          <View style={{ width: 62, height: 62, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="shield-checkmark" size={30} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -0.9, marginTop: 18 }}>Safer handoffs, every time.</Text>
          <Text style={{ color: '#D1D5DB', fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 10 }}>
            Use built-in verification, chat, and tracking so every delivery leaves a clear trail.
          </Text>
        </View>

        <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', marginBottom: 10 }}>Client safety checklist</Text>
          {CHECKS.map((tip, index) => (
            <View key={tip} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: '#F3F4F6' }}>
              <View style={{ width: 28, height: 28, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.brandDark, fontSize: 12, fontWeight: '900' }}>{index + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700' }}>{tip}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity onPress={() => Linking.openURL('tel:191')} style={{ flex: 1, borderRadius: 20, backgroundColor: '#FEF2F2', padding: 15, borderWidth: 1, borderColor: '#FECACA' }}>
            <Ionicons name="call-outline" size={22} color={colors.red} />
            <Text style={{ color: colors.red, fontSize: 14, fontWeight: '900', marginTop: 10 }}>Emergency</Text>
            <Text style={{ color: '#B91C1C', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 3 }}>Call Ghana Police 191.</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:support@riderguy.com')} style={{ flex: 1, borderRadius: 20, backgroundColor: '#fff', padding: 15, borderWidth: 1, borderColor: '#EEF2F7' }}>
            <Ionicons name="mail-outline" size={22} color={colors.brandDark} />
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 10 }}>Support</Text>
            <Text style={{ color: colors.subtle, fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 3 }}>Send a support email.</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
