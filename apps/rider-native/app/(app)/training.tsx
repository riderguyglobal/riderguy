import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

const MODULES = [
  { id: '1', title: 'Road discipline', desc: 'Lane choices, defensive riding, night visibility', duration: '15 min', icon: 'shield-outline', done: true, color: riderColors.greenSoft },
  { id: '2', title: 'Customer handoff', desc: 'Calls, PIN flow, payment confirmation, proof', duration: '12 min', icon: 'people-outline', done: true, color: riderColors.blueSoft },
  { id: '3', title: 'Route mastery', desc: 'Maps, ETA, geofence arrival, detours', duration: '10 min', icon: 'navigate-outline', done: false, color: riderColors.amberSoft },
  { id: '4', title: 'Fragile packages', desc: 'Packing checks and safe transport habits', duration: '8 min', icon: 'cube-outline', done: false, color: riderColors.violetSoft },
  { id: '5', title: 'Incident response', desc: 'Disputes, cancellations, support escalation', duration: '10 min', icon: 'alert-circle-outline', done: false, color: riderColors.redSoft },
];

export default function TrainingScreen() {
  const completed = MODULES.filter((module) => module.done).length;
  const progress = (completed / MODULES.length) * 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Training center" subtitle="Practical modules for better deliveries" canGoBack right={<StatusPill status="ONLINE" label={`${completed}/${MODULES.length}`} />} />
      <FlatList
        data={MODULES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        ListHeaderComponent={
          <RiderCard dark style={{ marginBottom: 2 }}>
            <Text style={{ color: riderColors.white, fontSize: 20, fontWeight: '900' }}>Skill stack</Text>
            <Text style={{ color: '#9fb0c4', fontSize: 13, lineHeight: 19, marginTop: 7 }}>
              Short modules built around actual rider moments: road, customer, package, payment, and support.
            </Text>
            <View style={{ marginTop: 16 }}>
              <ProgressBar progress={progress} color={riderColors.green} />
            </View>
          </RiderCard>
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.84}>
            <RiderCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: item.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon as any} size={24} color={riderColors.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>{item.title}</Text>
                  <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }} numberOfLines={2}>{item.desc}</Text>
                  <Text style={{ color: riderColors.soft, fontSize: 11, fontWeight: '800', marginTop: 5 }}>{item.duration}</Text>
                </View>
                <Ionicons name={item.done ? 'checkmark-circle' : 'play-circle-outline'} size={26} color={item.done ? riderColors.greenDark : riderColors.soft} />
              </View>
            </RiderCard>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
