import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@riderguy/auth-native';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { riderColors } from '@/lib/rider-design';

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: riderColors.ink }}>
        <ActivityIndicator size="large" color={riderColors.green} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)" />;

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
          height: 78,
          paddingTop: 9,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Deliveries', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'file-tray-full' : 'file-tray-full-outline'} size={size} color={color} /> }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={size} color={color} /> }} />
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ title: 'Profile', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} /> }} />
    </Tabs>
  );
}
