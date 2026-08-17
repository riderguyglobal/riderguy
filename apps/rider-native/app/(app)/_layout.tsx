import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@riderguy/auth-native';
import { riderColors } from '@/lib/rider-design';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: riderColors.surface }}>
        <ActivityIndicator size="large" color={riderColors.green} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="jobs/[id]" />
      <Stack.Screen name="jobs/[id]/proof" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chat/[orderId]" />
      <Stack.Screen name="job-offer" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="gamification" />
      <Stack.Screen name="training" />
      <Stack.Screen name="cancellations" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="onboarding/index" />
      <Stack.Screen name="onboarding/documents" />
      <Stack.Screen name="onboarding/selfie" />
      <Stack.Screen name="onboarding/vehicle" />
      <Stack.Screen name="onboarding/vehicle-photos" />
      <Stack.Screen name="community/chat/[roomId]" />
      <Stack.Screen name="community/forum" />
      <Stack.Screen name="community/events" />
      <Stack.Screen name="community/mentorship" />
      <Stack.Screen name="settings/profile" />
      <Stack.Screen name="settings/security/set-pin" />
      <Stack.Screen name="settings/security/change-pin" />
      <Stack.Screen name="settings/about" />
      <Stack.Screen name="settings/delete-account" />
    </Stack>
  );
}
