import { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { PinBoxes, RiderButton, RiderCard, RiderHeader, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

export default function RiderSetPinScreen() {
  const pathname = usePathname();
  const isChange = pathname.includes('change-pin');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const { api } = useAuth();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (newPin !== confirmPin) throw new Error('PINs do not match');
      if (isChange) await api.post('/auth/change-pin', { currentPin, newPin });
      else await api.post('/auth/set-pin', { pin: newPin });
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: isChange ? 'PIN changed.' : 'PIN set.' });
      router.back();
    },
    onError: (error: any) => Alert.alert('PIN failed', error?.response?.data?.error?.message ?? error?.message ?? 'Could not update PIN.'),
  });

  const ready = newPin.length === 6 && confirmPin.length === 6 && (!isChange || currentPin.length === 6);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title={isChange ? 'Change PIN' : 'Set PIN'} subtitle="Six digits for fast rider sign-in" canGoBack right={<StatusPill status={ready ? 'ONLINE' : 'PENDING'} label={ready ? 'Ready' : 'PIN'} />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <RiderCard dark style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: '#142942', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="lock-closed" size={24} color={riderColors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: riderColors.white, fontSize: 18, fontWeight: '900' }}>Keep dispatch access protected.</Text>
              <Text style={{ color: '#9fb0c4', fontSize: 13, lineHeight: 19, marginTop: 6 }}>Use a PIN only you know. Avoid repeated or obvious digits.</Text>
            </View>
          </View>
        </RiderCard>

        <RiderCard>
          {isChange ? (
            <>
              <Text style={{ color: riderColors.muted, fontWeight: '900', marginBottom: 6 }}>Current PIN</Text>
              <PinBoxes value={currentPin} onChange={setCurrentPin} secure={!showPin} />
            </>
          ) : null}
          <Text style={{ color: riderColors.muted, fontWeight: '900', marginTop: isChange ? 12 : 0, marginBottom: 6 }}>New PIN</Text>
          <PinBoxes value={newPin} onChange={setNewPin} secure={!showPin} />
          <Text style={{ color: riderColors.muted, fontWeight: '900', marginTop: 12, marginBottom: 6 }}>Confirm PIN</Text>
          <PinBoxes value={confirmPin} onChange={setConfirmPin} secure={!showPin} />
          <TouchableOpacity onPress={() => setShowPin((value) => !value)} style={{ alignItems: 'center', marginVertical: 12 }}>
            <Text style={{ color: riderColors.greenDark, fontWeight: '900' }}>{showPin ? 'Hide PIN' : 'Show PIN'}</Text>
          </TouchableOpacity>
          <RiderButton label={isChange ? 'Change PIN' : 'Set PIN'} icon="keypad" loading={isPending} disabled={!ready} onPress={() => mutate()} />
        </RiderCard>
      </ScrollView>
    </SafeAreaView>
  );
}
