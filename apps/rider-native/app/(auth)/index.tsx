import { Image, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActionBand, RiderButton, RiderCard } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

const hero = require('../../assets/images/illustrations/rider-fleet.png');

export default function RiderLandingScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.white }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={riderColors.white} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={{ minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity activeOpacity={0.84} style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="menu" size={28} color={riderColors.ink} />
          </TouchableOpacity>
          <Text style={{ color: riderColors.greenDark, fontSize: 28, fontWeight: '900' }}>Riderguy</Text>
          <View style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="shield-checkmark-outline" size={25} color={riderColors.ink} />
          </View>
        </View>

        <View style={{ borderRadius: 18, backgroundColor: riderColors.green, overflow: 'hidden', marginTop: 6 }}>
          <View style={{ height: 256 }}>
            <Image source={hero} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            <View style={{ position: 'absolute', left: 16, top: 16, borderRadius: 999, backgroundColor: riderColors.white, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: riderColors.ink, fontSize: 12, fontWeight: '900' }}>RIDER APP</Text>
            </View>
          </View>
          <View style={{ padding: 18, backgroundColor: riderColors.green }}>
            <Text style={{ color: riderColors.ink, fontSize: 34, lineHeight: 38, fontWeight: '900' }}>
              Own the route. Earn with control.
            </Text>
            <Text style={{ color: riderColors.ink2, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 8 }}>
              Live offers, map-first delivery flow, fast payouts, training, and safety in one rider app.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          {[
            { icon: 'flash' as const, label: 'Live offers' },
            { icon: 'wallet' as const, label: 'Fast cashout' },
            { icon: 'shield-checkmark' as const, label: 'Safer flow' },
          ].map((item) => (
            <RiderCard key={item.label} style={{ flex: 1, minHeight: 86, padding: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={item.icon} size={22} color={riderColors.greenDark} />
              <Text style={{ color: riderColors.ink, fontSize: 11, fontWeight: '900', marginTop: 8, textAlign: 'center' }}>{item.label}</Text>
            </RiderCard>
          ))}
        </View>

        <View style={{ gap: 12, paddingTop: 16 }}>
          <RiderButton label="Sign In" icon="log-in" onPress={() => router.push('/(auth)/login')} />
          <RiderButton label="Become a Rider" icon="person-add" variant="ghost" onPress={() => router.push('/(auth)/register')} />
          <Text style={{ color: riderColors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>
            By continuing, you agree to RiderGuy rider terms and safety standards.
          </Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <ActionBand
            icon="radio"
            title="Dispatch ready"
            body="Go online, keep GPS active, receive targeted jobs, and complete proof from one native flow."
            onPress={() => router.push('/(auth)/login')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
