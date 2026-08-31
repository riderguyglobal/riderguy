import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@riderguy/auth-native';
import { View, ActivityIndicator } from 'react-native';

export default function AuthLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (isAuthenticated) {
    const activated = user?.riderProfile?.onboardingStatus === 'ACTIVATED' && user.riderProfile.isVerified;
    return <Redirect href={activated ? '/(tabs)' : '/(app)/onboarding'} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="recovery" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="forgot-pin" />
    </Stack>
  );
}
