import { Alert, ImageBackground, Linking, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActionBand, RiderButton, RiderCard } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

const hero = require('../../assets/images/illustrations/rider-sign-in-hero.png');

export default function RiderLandingScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.white }} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={riderColors.white} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="Open sign-in menu"
            onPress={() => Alert.alert(
              'RiderGuy Rider',
              'Choose where you want to go.',
              [
                { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
                { text: 'Become a Rider', onPress: () => router.push('/(auth)/register') },
                { text: 'Cancel', style: 'cancel' },
              ],
            )}
            style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="menu" size={28} color={riderColors.ink} />
          </TouchableOpacity>
          <Text style={{ color: riderColors.greenDark, fontSize: 28, fontWeight: '900' }}>Riderguy</Text>
          <TouchableOpacity
            activeOpacity={0.84}
            accessibilityRole="link"
            accessibilityLabel="Read about RiderGuy rider safety"
            onPress={() => void Linking.openURL('https://myriderguy.com/for-riders')}
            style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="shield-checkmark-outline" size={25} color={riderColors.ink} />
          </TouchableOpacity>
        </View>

        <View style={{ borderRadius: 18, backgroundColor: riderColors.green, overflow: 'hidden', marginTop: 4 }}>
          <ImageBackground source={hero} resizeMode="cover" style={{ width: '100%', aspectRatio: 1.5 }} />
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, backgroundColor: riderColors.green }}>
            <Text style={{ color: riderColors.ink, fontSize: 29, lineHeight: 33, fontWeight: '900' }}>
              {'Prioritise Your Safety & Earn -'}
            </Text>
            <Text style={{ color: riderColors.ink2, fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 6 }}>
              Training, Insurance, Fast Pay-outs, 24hr Support
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          {[
            { icon: 'flash' as const, label: 'Live Offers' },
            { icon: 'map' as const, label: 'Map' },
            { icon: 'apps' as const, label: 'One App' },
          ].map((item) => (
            <RiderCard key={item.label} style={{ flex: 1, minHeight: 72, padding: 10, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={item.icon} size={20} color={riderColors.greenDark} />
              <Text style={{ color: riderColors.ink, fontSize: 11, fontWeight: '900', marginTop: 6, textAlign: 'center' }}>{item.label}</Text>
            </RiderCard>
          ))}
        </View>

        <View style={{ gap: 10, paddingTop: 14 }}>
          <RiderButton label="Sign In" icon="log-in" onPress={() => router.push('/(auth)/login')} />
          <RiderButton label="Become a Rider" icon="person-add" variant="ghost" onPress={() => router.push('/(auth)/register')} />
          <Text style={{ color: riderColors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>
            By continuing, you agree to RiderGuy rider terms and safety standards.
          </Text>
        </View>

        <View style={{ marginTop: 12 }}>
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
