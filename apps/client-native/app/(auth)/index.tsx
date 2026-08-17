import { ImageBackground, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '@/design/client';

const hero = require('../../assets/images/branding/hero-mobile.png');

export default function LandingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.black} />
      <ImageBackground
        source={hero}
        resizeMode="cover"
        style={{ flex: 1 }}
        imageStyle={{ opacity: 0.98 }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                  riderguy
                </Text>
                <View style={{ borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
                    CLIENT
                  </Text>
                </View>
              </View>

              <View>
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', lineHeight: 37, letterSpacing: -1 }}>
                    Send packages fast.
                  </Text>
                  <Text style={{ marginTop: 8, color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 21, fontWeight: '500' }}>
                    Fast. Reliable. Secure. Real-time tracking from pickup to delivery.
                  </Text>
                </View>

                <View style={{ gap: 12, paddingBottom: 8 }}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => router.push('/(auth)/login')}
                    style={{
                      height: 52,
                      borderRadius: radius.lg,
                      backgroundColor: colors.brand,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 8,
                      ...shadow.brand,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={17} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => router.push('/(auth)/register')}
                    style={{
                      height: 52,
                      borderRadius: radius.lg,
                      borderWidth: 1.5,
                      borderColor: 'rgba(255,255,255,0.45)',
                      backgroundColor: 'rgba(255,255,255,0.10)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Create Account</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </ImageBackground>
    </View>
  );
}
