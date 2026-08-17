import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

export default function RiderAboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="About" subtitle="RiderGuy native rider app" canGoBack right={<StatusPill status="ONLINE" label={`v${version}`} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <RiderCard dark style={{ alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 78, height: 78, borderRadius: 26, backgroundColor: riderColors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Ionicons name="navigate" size={35} color={riderColors.white} />
          </View>
          <Text style={{ color: riderColors.white, fontSize: 22, fontWeight: '900' }}>RiderGuy Rider</Text>
          <Text style={{ color: '#9fb0c4', fontSize: 13, marginTop: 4 }}>Premium delivery operations app</Text>
        </RiderCard>

        <RiderCard style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { label: 'Rider terms', url: 'https://riderguy.com/rider-terms', icon: 'document-text-outline' as const },
            { label: 'Privacy policy', url: 'https://riderguy.com/privacy', icon: 'shield-checkmark-outline' as const },
            { label: 'Delete account', url: 'https://myriderguy.com/delete-account', icon: 'trash-outline' as const },
            { label: 'Rider support', url: 'mailto:riders@riderguy.com', icon: 'mail-outline' as const },
          ].map((link, index, arr) => (
            <TouchableOpacity key={link.label} onPress={() => Linking.openURL(link.url)} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: index < arr.length - 1 ? 1 : 0, borderBottomColor: riderColors.line }}>
              <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: riderColors.panelAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={link.icon} size={19} color={riderColors.ink} />
              </View>
              <Text style={{ flex: 1, color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>{link.label}</Text>
              <Ionicons name="open-outline" size={17} color={riderColors.soft} />
            </TouchableOpacity>
          ))}
        </RiderCard>

        <Text style={{ textAlign: 'center', color: riderColors.soft, fontSize: 11, marginTop: 20 }}>
          Copyright {new Date().getFullYear()} RiderGuy. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
