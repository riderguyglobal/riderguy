import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { riderColors, riderFonts } from '@/lib/rider-design';

const MENU_ITEMS = [
  { icon: 'home-outline' as const, label: 'Home', target: '/(tabs)' },
  { icon: 'bicycle-outline' as const, label: 'Deliveries', target: '/(tabs)/jobs' },
  { icon: 'wallet-outline' as const, label: 'Earnings & wallet', target: '/(tabs)/earnings' },
  { icon: 'school-outline' as const, label: 'Learning Center', target: '/(app)/training' },
  { icon: 'people-outline' as const, label: 'Rider community', target: '/(tabs)/community' },
  { icon: 'shield-checkmark-outline' as const, label: 'Safety Center', target: '/(app)/safety' },
  { icon: 'person-outline' as const, label: 'Profile & settings', target: '/(tabs)/account' },
];

export function RiderNavigationMenu({
  onClose,
  visible,
}: {
  onClose: () => void;
  visible: boolean;
}) {
  const navigate = (target: string) => {
    onClose();
    router.push(target as any);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(5,15,10,0.48)', flexDirection: 'row' }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ width: '86%', maxWidth: 360, backgroundColor: riderColors.white, paddingHorizontal: 18 }}>
          <View style={{ height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: riderColors.greenDark, fontFamily: riderFonts.bold, fontSize: 27, fontWeight: '900' }}>Riderguy</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              activeOpacity={0.82}
              onPress={onClose}
              style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: riderColors.panelAlt, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={23} color={riderColors.ink} />
            </TouchableOpacity>
          </View>

          <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 14 }}>
            Deliver, learn, earn, and get support from one app.
          </Text>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.target}
                activeOpacity={0.84}
                onPress={() => navigate(item.target)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={{ minHeight: 55, borderRadius: 15, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ width: 39, height: 39, borderRadius: 14, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon} size={20} color={riderColors.greenDark} />
                </View>
                <Text style={{ flex: 1, color: riderColors.ink, fontFamily: riderFonts.semibold, fontSize: 14, fontWeight: '700' }}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={riderColors.soft} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.84}
            onPress={() => navigate('/(app)/settings/about')}
            accessibilityRole="button"
            accessibilityLabel="Help and support"
            style={{ minHeight: 58, borderRadius: 16, backgroundColor: riderColors.greenMist, borderWidth: 1, borderColor: riderColors.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, marginBottom: 8 }}
          >
            <Ionicons name="headset-outline" size={22} color={riderColors.greenDark} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '900' }}>Help & support</Text>
              <Text style={{ color: riderColors.muted, fontSize: 11, marginTop: 2 }}>Get RiderGuy assistance</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={riderColors.greenDark} />
          </TouchableOpacity>
        </SafeAreaView>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close menu" activeOpacity={1} onPress={onClose} style={{ flex: 1 }} />
      </View>
    </Modal>
  );
}
