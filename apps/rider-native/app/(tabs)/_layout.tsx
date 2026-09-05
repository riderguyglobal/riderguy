import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@riderguy/auth-native';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { riderColors, riderFonts } from '@/lib/rider-design';
import { useRiderOnboardingGate } from '@/hooks/useRiderOnboardingGate';
import { RiderAccessCheckUnavailable } from '@/components/rider-access-check';

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const onboarding = useRiderOnboardingGate();
  const insets = useSafeAreaInsets();

  if (isLoading || (isAuthenticated && onboarding.isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: riderColors.ink }}>
        <ActivityIndicator size="large" color={riderColors.green} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)" />;
  if (onboarding.isError || !onboarding.hasAuthoritativeStatus) {
    return <RiderAccessCheckUnavailable isRetrying={onboarding.isFetching} onRetry={() => void onboarding.refetch()} />;
  }
  if (!onboarding.isActivated) return <Redirect href="/(app)/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: riderColors.greenDark,
        tabBarInactiveTintColor: '#808782',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#EDF2EF',
          backgroundColor: riderColors.white,
          height: 62 + insets.bottom,
          paddingTop: 9,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: riderFonts.medium, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Deliveries', tabBarIcon: ({ color, size, focused }) => <MaterialCommunityIcons name={focused ? 'truck-delivery' : 'truck-delivery-outline'} size={size} color={color} /> }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color, size, focused }) => <MaterialCommunityIcons name={focused ? 'sack' : 'sack-outline'} size={size} color={color} /> }} />
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ title: 'Profile', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} /> }} />
    </Tabs>
  );
}
