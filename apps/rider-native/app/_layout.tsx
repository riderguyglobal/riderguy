import '../src/globals.css';
import { useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { AuthProvider, initApiClient, useAuth } from '@riderguy/auth-native';
import { usePushNotifications } from '@/hooks/usePushNotifications';

SplashScreen.preventAutoHideAsync();

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 2, staleTime: 1000 * 60 * 5 },
    },
  });
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.myriderguy.com/api/v1';
initApiClient(API_URL);

function AppWithNotifications({ children }: { children: React.ReactNode }) {
  usePushNotifications();
  return <>{children}</>;
}

/** A new cache is selected synchronously for every account identity. */
function UserScopedQueryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const scopedQueryClient = useMemo(createQueryClient, [user?.id]);
  return <QueryClientProvider client={scopedQueryClient}>{children}</QueryClientProvider>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider expectedRole="RIDER">
        <UserScopedQueryProvider>
            <AppWithNotifications>
              <BottomSheetModalProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="auth/reset-password" />
                  <Stack.Screen name="auth/verify-email" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(app)" />
                </Stack>
                <StatusBar style="dark" />
                <Toast />
              </BottomSheetModalProvider>
            </AppWithNotifications>
        </UserScopedQueryProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
