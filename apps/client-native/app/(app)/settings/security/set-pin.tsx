import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuth } from '@riderguy/auth-native';
import { ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

function PinBoxes({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const ref = useRef<TextInput>(null);
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>{label}</Text>
      <TouchableOpacity activeOpacity={1} onPress={() => ref.current?.focus()}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, index) => {
            const filled = !!value[index];
            return (
              <View key={index} style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: filled ? colors.brandSoft : '#F8FAFC', borderWidth: 1.5, borderColor: filled ? colors.brand : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>{filled ? '*' : ''}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
        />
      </TouchableOpacity>
    </View>
  );
}

export default function SetPinScreen() {
  const pathname = usePathname();
  const isChange = pathname.includes('change-pin');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const { api } = useAuth();

  const pinReady = useMemo(() => {
    const base = newPin.length >= 4 && confirmPin.length >= 4 && newPin === confirmPin;
    return isChange ? base && currentPin.length >= 4 : base;
  }, [confirmPin, currentPin, isChange, newPin]);

  const submitPin = useMutation({
    mutationFn: async () => {
      if (newPin !== confirmPin) throw new Error('PINs do not match');
      if (isChange) {
        await api.post('/auth/change-pin', { currentPin, newPin });
      } else {
        await api.post('/auth/set-pin', { pin: newPin });
      }
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: isChange ? 'PIN changed' : 'PIN set' });
      router.back();
    },
    onError: (error: any) => {
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? error?.message ?? 'Could not update PIN' });
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title={isChange ? 'Change PIN' : 'Set PIN'} subtitle="Protect quick sign-in and wallet actions" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
          <View style={{ position: 'absolute', right: -42, top: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(245,158,11,0.20)' }} />
          <View style={{ width: 58, height: 58, borderRadius: 22, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="key-outline" size={27} color="#fff" />
          </View>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 18 }}>{isChange ? 'Update your PIN' : 'Create your PIN'}</Text>
          <Text style={{ color: '#D1D5DB', fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 8 }}>
            Use 4 to 6 digits. Avoid birthdays or numbers someone could guess.
          </Text>
        </View>

        <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          {isChange && <PinBoxes label="Current PIN" value={currentPin} onChange={setCurrentPin} />}
          <PinBoxes label="New PIN" value={newPin} onChange={setNewPin} />
          <PinBoxes label="Confirm New PIN" value={confirmPin} onChange={setConfirmPin} />
          {newPin && confirmPin && newPin !== confirmPin && (
            <View style={{ borderRadius: 16, backgroundColor: '#FEF2F2', padding: 12, flexDirection: 'row', gap: 9, marginBottom: 12 }}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.red} />
              <Text style={{ flex: 1, color: colors.red, fontSize: 12, fontWeight: '800' }}>The two PIN entries do not match yet.</Text>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => submitPin.mutate()}
            disabled={!pinReady || submitPin.isPending}
            style={{ height: 56, borderRadius: 18, backgroundColor: pinReady && !submitPin.isPending ? colors.brand : '#D1D5DB', alignItems: 'center', justifyContent: 'center', ...(!pinReady || submitPin.isPending ? {} : shadow.brand) }}
          >
            {submitPin.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>{isChange ? 'Change PIN' : 'Set PIN'}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
