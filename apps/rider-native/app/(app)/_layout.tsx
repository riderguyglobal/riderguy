import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@riderguy/auth-native';
import { riderColors } from '@/lib/rider-design';
import { useRiderOnboardingGate } from '@/hooks/useRiderOnboardingGate';
import { RiderAccessCheckUnavailable } from '@/components/rider-access-check';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const onboarding = useRiderOnboardingGate();

  if (isLoading || (isAuthenticated && onboarding.isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: riderColors.surface }}>
        <ActivityIndicator size="large" color={riderColors.green} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)" />;
  if (onboarding.isError || !onboarding.hasAuthoritativeStatus) {
    return <RiderAccessCheckUnavailable isRetrying={onboarding.isFetching} onRetry={() => void onboarding.refetch()} />;
  }

  const isOnboardingRoute = pathname.includes('/onboarding')
    || pathname.includes('/training')
    || pathname.includes('/asset-financing');
  const isVehicleManagementRoute = pathname.endsWith('/onboarding/vehicle')
    || pathname.endsWith('/onboarding/vehicle-photos');
  if (!onboarding.isActivated && !isOnboardingRoute) {
    return <Redirect href="/(app)/onboarding" />;
  }
  if (onboarding.isActivated && pathname.includes('/onboarding') && !isVehicleManagementRoute) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="jobs/[id]" />
      <Stack.Screen name="jobs/[id]/proof" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chat/[orderId]" />
      <Stack.Screen name="job-offer" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="gamification" />
      <Stack.Screen name="training" />
      <Stack.Screen name="safety" />
      <Stack.Screen name="asset-financing" />
      <Stack.Screen name="cancellations" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="wallet/add-funds" />
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
