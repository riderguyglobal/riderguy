import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

const TOOLS = [
  { icon: 'location-outline', title: 'Address clarity', body: 'Break vague directions into pickup notes riders can actually act on.' },
  { icon: 'cube-outline', title: 'Package prep', body: 'Choose package type, handling notes, and safer handoff instructions.' },
  { icon: 'time-outline', title: 'Timing sense', body: 'Decide whether now, later today, or tomorrow is the better pickup window.' },
  { icon: 'sparkles-outline', title: 'Promo fit', body: 'Check whether a promo code looks suitable before estimating a delivery.' },
];

export default function RiderGeniusScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="RiderGenius" subtitle="Smarter delivery setup" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
          <View style={{ position: 'absolute', right: -44, top: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(74,128,240,0.24)' }} />
          <View style={{ width: 62, height: 62, borderRadius: 24, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="bulb-outline" size={30} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -0.9, marginTop: 18 }}>A sharper way to plan a send.</Text>
          <Text style={{ color: '#D1D5DB', fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 10 }}>
            This space will become the intelligent assistant for clients: cleaner addresses, better notes, and fewer delivery surprises.
          </Text>
        </View>

        <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {TOOLS.map((tool) => (
            <View key={tool.title} style={{ width: '48.5%', borderRadius: 22, backgroundColor: '#fff', padding: 15, borderWidth: 1, borderColor: '#EEF2F7', minHeight: 154, ...shadow.card }}>
              <View style={{ width: 44, height: 44, borderRadius: 17, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={tool.icon as any} size={21} color={colors.blue} />
              </View>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 12 }}>{tool.title}</Text>
              <Text style={{ color: colors.subtle, fontSize: 11, lineHeight: 17, fontWeight: '700', marginTop: 5 }}>{tool.body}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={() => router.push('/(app)/quick-send' as any)} style={{ marginTop: 18, height: 56, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...shadow.brand }}>
          <Ionicons name="flash-outline" size={19} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Start with Quick Send</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
