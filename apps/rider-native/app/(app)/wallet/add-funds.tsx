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
import { RiderCard, RiderHeader } from '@/components/rider-ui';
import { riderColors, riderShadow } from '@/lib/rider-design';

const PRESETS = [20, 50, 100, 200, 500, 1000];

export default function AddRiderFundsScreen() {
  const [amount, setAmount] = useState('100');
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const numericAmount = useMemo(() => Number.parseFloat(amount || '0'), [amount]);
  const canSubmit = Number.isFinite(numericAmount) && numericAmount >= 1 && numericAmount <= 50_000;

  const topup = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/wallets/topup', { amount: numericAmount });
      const body = data.data ?? data;
      const checkoutUrl = body.authorizationUrl ?? body.checkoutUrl;
      if (!checkoutUrl) throw new Error('Secure checkout could not be created.');
      const parsedCheckoutUrl = new URL(checkoutUrl);
      if (parsedCheckoutUrl.protocol !== 'https:' || parsedCheckoutUrl.hostname !== 'checkout.paystack.com') {
        throw new Error('The payment provider returned an invalid checkout link.');
      }

      await WebBrowser.openBrowserAsync(parsedCheckoutUrl.toString(), {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
      });

      if (!body.reference) return { status: 'pending' };
      const verification = await api.get(`/wallets/topup/verify/${encodeURIComponent(body.reference)}`);
      return verification.data.data ?? verification.data;
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rider-wallet'] }),
        queryClient.invalidateQueries({ queryKey: ['rider-transactions'] }),
      ]);

      if (result?.status === 'success') {
        Toast.show({ type: 'success', text1: 'Wallet updated', text2: `${formatCurrency(numericAmount, 'GHS')} was added.` });
        router.back();
        return;
      }

      Toast.show({
        type: 'info',
        text1: 'Payment confirmation pending',
        text2: 'Your wallet will update automatically after Paystack confirms payment.',
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.error?.message ?? error?.message ?? 'Could not start wallet top-up.',
      });
    },
  });

  const setCleanAmount = (value: string) => {
    setAmount(value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }} edges={['top', 'bottom']}>
      <RiderHeader title="Add money" subtitle="Secure wallet top-up with Paystack" canGoBack />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ borderRadius: 24, backgroundColor: riderColors.ink, padding: 20, overflow: 'hidden', ...riderShadow }}>
          <View style={{ position: 'absolute', right: -45, top: -45, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(64,190,137,0.22)' }} />
          <Text style={{ color: '#B6C0BA', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Top-up amount</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 }}>
            <Text style={{ color: riderColors.white, fontSize: 20, fontWeight: '900', marginBottom: 8, marginRight: 8 }}>GHS</Text>
            <TextInput
              value={amount}
              onChangeText={setCleanAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.35)"
              accessibilityLabel="Top-up amount in Ghana cedis"
              style={{ flex: 1, color: riderColors.white, fontSize: 43, fontWeight: '900', letterSpacing: -1, padding: 0 }}
            />
          </View>
          <Text style={{ color: '#D8E1DC', fontSize: 12, lineHeight: 18, marginTop: 12, fontWeight: '600' }}>
            Paystack confirms each payment before funds are added. RiderGuy never sees or stores your card or Mobile Money PIN.
          </Text>
        </View>

        <RiderCard style={{ marginTop: 16 }}>
          <Text style={{ color: riderColors.ink, fontSize: 15, fontWeight: '900' }}>Quick amounts</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            {PRESETS.map((preset) => {
              const selected = numericAmount === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setAmount(String(preset))}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{ width: '30.5%', height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? riderColors.greenDark : riderColors.panelAlt, borderWidth: 1, borderColor: selected ? riderColors.greenDark : riderColors.line }}
                >
                  <Text style={{ color: selected ? riderColors.white : riderColors.ink, fontSize: 11, fontWeight: '900' }}>{formatCurrency(preset, 'GHS')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </RiderCard>

        <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
          <PaymentMethod icon="phone-portrait-outline" title="Mobile Money" body="Choose a supported network at checkout." />
          <PaymentMethod icon="card-outline" title="Card or bank" body="Pay on Paystack's secure hosted page." />
        </View>

        {!canSubmit && amount ? (
          <Text style={{ color: riderColors.red, fontSize: 12, fontWeight: '700', marginTop: 12 }}>
            Enter an amount from GHS 1 to GHS 50,000.
          </Text>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => topup.mutate()}
          disabled={!canSubmit || topup.isPending}
          accessibilityRole="button"
          style={{ marginTop: 18, height: 56, borderRadius: 17, backgroundColor: !canSubmit || topup.isPending ? '#BFC7C3' : riderColors.greenDark, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
        >
          {topup.isPending ? (
            <ActivityIndicator color={riderColors.white} />
          ) : (
            <>
              <Ionicons name="lock-closed-outline" size={18} color={riderColors.white} />
              <Text style={{ color: riderColors.white, fontSize: 15, fontWeight: '900' }}>Continue to secure checkout</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PaymentMethod({
  body,
  icon,
  title,
}: {
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <RiderCard style={{ flex: 1, minHeight: 120, padding: 14 }}>
      <Ionicons name={icon} size={22} color={riderColors.greenDark} />
      <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '900', marginTop: 10 }}>{title}</Text>
      <Text style={{ color: riderColors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }}>{body}</Text>
    </RiderCard>
  );
}
