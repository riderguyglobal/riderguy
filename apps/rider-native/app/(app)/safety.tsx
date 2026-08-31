import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ActionBand, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

const SAFETY_GUIDES = [
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Before every trip',
    body: 'Check your helmet, brakes, tyres, lights, phone charge, and delivery bag before going online.',
  },
  {
    icon: 'navigate-outline' as const,
    title: 'Ride defensively',
    body: 'Follow road rules, keep a safe distance, avoid phone use while moving, and stop safely before checking the route.',
  },
  {
    icon: 'alert-circle-outline' as const,
    title: 'If an incident happens',
    body: 'Move to safety when possible, contact emergency services when needed, then notify RiderGuy support with the delivery details.',
  },
];

export default function SafetyCenterScreen() {
  const callEmergencyServices = () => {
    Alert.alert(
      'Call emergency services?',
      'Use this only for an urgent safety or medical emergency in Ghana.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call 112', style: 'destructive', onPress: () => Linking.openURL('tel:112') },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader
        title="Safety Center"
        subtitle="Guidance and help for every delivery"
        canGoBack
        right={<StatusPill status="ONLINE" label="Ready" />}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <RiderCard dark style={{ marginBottom: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: riderColors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Ionicons name="shield-checkmark" size={29} color={riderColors.white} />
          </View>
          <Text style={{ color: riderColors.white, fontSize: 21, fontWeight: '900' }}>Ride safe. Deliver safe.</Text>
          <Text style={{ color: '#B8C8BF', fontSize: 13, lineHeight: 19, marginTop: 7 }}>
            Your safety comes before a delivery. Stop the trip and get help whenever conditions become unsafe.
          </Text>
        </RiderCard>

        <View style={{ gap: 10, marginBottom: 14 }}>
          {SAFETY_GUIDES.map((guide) => (
            <RiderCard key={guide.title} style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={guide.icon} size={22} color={riderColors.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>{guide.title}</Text>
                  <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{guide.body}</Text>
                </View>
              </View>
            </RiderCard>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          <ActionBand
            icon="school"
            title="Safety training"
            body="Review road discipline and incident-response modules."
            buttonLabel="Open"
            buttonIcon="arrow-forward"
            onPress={() => router.push('/(app)/training')}
          />

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => Linking.openURL('mailto:hello@myriderguy.com?subject=RiderGuy%20Rider%20Safety%20Support')}
            style={{ minHeight: 58, borderRadius: 16, backgroundColor: riderColors.white, borderWidth: 1, borderColor: riderColors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 12 }}
          >
            <Ionicons name="headset" size={23} color={riderColors.greenDark} />
            <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900', flex: 1 }}>Contact RiderGuy safety support</Text>
            <Ionicons name="open-outline" size={18} color={riderColors.soft} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={callEmergencyServices}
            style={{ minHeight: 58, borderRadius: 16, backgroundColor: riderColors.redSoft, borderWidth: 1, borderColor: '#FECACA', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 12 }}
          >
            <Ionicons name="call" size={23} color={riderColors.red} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: riderColors.red, fontSize: 14, fontWeight: '900' }}>Emergency services</Text>
              <Text style={{ color: '#9F3030', fontSize: 11, marginTop: 2 }}>Call Ghana emergency number 112</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={riderColors.red} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
