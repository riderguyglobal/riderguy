import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="quick-send" options={{ presentation: 'modal' }} />
      <Stack.Screen name="orders/[id]" />
      <Stack.Screen name="orders/[id]/tracking" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="orders/[id]/rate" />
      <Stack.Screen name="orders/[id]/payment" />
      <Stack.Screen name="wallet/add-funds" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="saved-addresses" />
      <Stack.Screen name="favorite-riders" />
      <Stack.Screen name="promos" />
      <Stack.Screen name="safety-center" />
      <Stack.Screen name="rider-genius" />
      <Stack.Screen name="scheduled" />
      <Stack.Screen name="track" />
      <Stack.Screen name="book-ride" />
      <Stack.Screen name="chat/[orderId]" />
      <Stack.Screen name="settings/profile" />
      <Stack.Screen name="settings/payment-methods" />
      <Stack.Screen name="settings/notifications" />
      <Stack.Screen name="settings/security/set-pin" />
      <Stack.Screen name="settings/security/change-pin" />
      <Stack.Screen name="settings/help" />
      <Stack.Screen name="settings/about" />
      <Stack.Screen name="settings/delete-account" />
    </Stack>
  );
}
