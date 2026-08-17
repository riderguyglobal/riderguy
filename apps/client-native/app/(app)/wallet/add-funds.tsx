import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

const PRESETS = [20, 50, 100, 200, 500, 1000];

export default function AddFundsScreen() {
  const [amount, setAmount] = useState('100');
  const { api } = useAuth();
  const qc = useQueryClient();

  const numericAmount = useMemo(() => Number.parseFloat(amount || '0'), [amount]);
  const canSubmit = Number.isFinite(numericAmount) && numericAmount >= 1;

  const topup = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/wallets/topup', { amount: numericAmount });
      const body = data.data ?? data;
      const checkoutUrl = body.authorizationUrl ?? body.checkoutUrl;
      if (!checkoutUrl) throw new Error('Checkout link was not created');
      await WebBrowser.openBrowserAsync(checkoutUrl);
      if (!body.reference) return body;
      const verified = await api.get(`/wallets/topup/verify/${body.reference}`);
      return verified.data.data ?? verified.data;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      if (result?.status === 'success') {
        Toast.show({ type: 'success', text1: 'Wallet updated' });
        router.back();
      } else {
        Toast.show({ type: 'info', text1: 'Top-up pending', text2: 'We will update your wallet after confirmation.' });
      }
    },
    onError: (error: any) => {
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? error?.message ?? 'Could not start top-up' });
    },
  });

  const setCleanAmount = (value: string) => {
    setAmount(value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Add Funds" subtitle="Instant wallet top-up" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
          <View style={{ position: 'absolute', right: -46, top: -46, width: 152, height: 152, borderRadius: 76, backgroundColor: 'rgba(10,185,87,0.18)' }} />
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Top-up amount</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 8, marginRight: 8 }}>GHS</Text>
            <TextInput
              value={amount}
              onChangeText={setCleanAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={{ flex: 1, color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: -1, padding: 0 }}
            />
          </View>
          <Text style={{ color: '#D1D5DB', fontSize: 12, lineHeight: 18, marginTop: 12, fontWeight: '700' }}>
            Funds are added after Paystack confirms the transaction. You can close checkout and return here anytime.
          </Text>
        </View>

        <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900' }}>Quick amounts</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            {PRESETS.map((preset) => {
              const selected = numericAmount === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setAmount(String(preset))}
                  style={{ width: '30.5%', height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.brand : '#F8FAFC', borderWidth: 1, borderColor: selected ? colors.brand : '#EEF2F7' }}
                >
                  <Text style={{ color: selected ? '#fff' : colors.ink, fontSize: 12, fontWeight: '900' }}>{formatCurrency(preset, 'GHS')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, borderRadius: 18, backgroundColor: '#fff', padding: 14, borderWidth: 1, borderColor: '#EEF2F7' }}>
            <Ionicons name="phone-portrait-outline" size={22} color={colors.brandDark} />
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 10 }}>Mobile Money</Text>
            <Text style={{ color: colors.subtle, fontSize: 11, lineHeight: 16, marginTop: 3 }}>Supported by Paystack checkout.</Text>
          </View>
          <View style={{ flex: 1, borderRadius: 18, backgroundColor: '#fff', padding: 14, borderWidth: 1, borderColor: '#EEF2F7' }}>
            <Ionicons name="card-outline" size={22} color={colors.blue} />
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 10 }}>Card or Bank</Text>
            <Text style={{ color: colors.subtle, fontSize: 11, lineHeight: 16, marginTop: 3 }}>Use a secure hosted payment page.</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => topup.mutate()}
          disabled={!canSubmit || topup.isPending}
          style={{ marginTop: 18, height: 56, borderRadius: 18, backgroundColor: !canSubmit || topup.isPending ? '#D1D5DB' : colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...(!canSubmit || topup.isPending ? {} : shadow.brand) }}
        >
          {topup.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Continue to Paystack</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
