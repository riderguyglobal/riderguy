import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import { ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

const METHODS = [
  { icon: 'wallet-outline', title: 'RiderGuy Wallet', body: 'Fast checkout for wallet orders.', action: 'Add Funds', href: '/(app)/wallet/add-funds' },
  { icon: 'phone-portrait-outline', title: 'Mobile Money', body: 'MTN, Telecel, and AirtelTigo through Paystack.', action: 'Use at Checkout' },
  { icon: 'card-outline', title: 'Card', body: 'Pay securely by card when a delivery requires online payment.', action: 'Use at Checkout' },
  { icon: 'business-outline', title: 'Bank Transfer', body: 'Supported inside Paystack checkout where available.', action: 'Use at Checkout' },
  { icon: 'cash-outline', title: 'Cash', body: 'Settle directly with the rider when cash is selected.', action: 'Available' },
];

export default function PaymentMethodsScreen() {
  const { api } = useAuth();
  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const { data } = await api.get('/wallets');
      return data.data ?? data;
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Payment Methods" subtitle="Ways to settle deliveries" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
          <View style={{ position: 'absolute', right: -44, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(10,185,87,0.18)' }} />
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Default rail</Text>
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1, marginTop: 8 }}>
            {walletQuery.isLoading ? '...' : formatCurrency(walletQuery.data?.balance ?? 0, 'GHS')}
          </Text>
          <Text style={{ color: '#D1D5DB', fontSize: 12, fontWeight: '700', marginTop: 8 }}>Wallet balance available for eligible deliveries.</Text>
        </View>

        <View style={{ marginTop: 16, gap: 12 }}>
          {METHODS.map((method) => (
            <TouchableOpacity
              key={method.title}
              activeOpacity={0.86}
              onPress={() => method.href ? router.push(method.href as any) : undefined}
              style={{ borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', flexDirection: 'row', alignItems: 'center', gap: 13, ...shadow.card }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: method.title === 'RiderGuy Wallet' ? colors.brandSoft : '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={method.icon as any} size={22} color={method.title === 'RiderGuy Wallet' ? colors.brandDark : colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '900' }}>{method.title}</Text>
                <Text style={{ color: colors.subtle, fontSize: 11, lineHeight: 16, marginTop: 3, fontWeight: '700' }}>{method.body}</Text>
              </View>
              {method.href ? (
                <Text style={{ color: colors.brandDark, fontSize: 11, fontWeight: '900' }}>{method.action}</Text>
              ) : (
                <View style={{ borderRadius: 999, backgroundColor: '#F8FAFC', paddingHorizontal: 9, paddingVertical: 5 }}>
                  <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900' }}>{method.action}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {walletQuery.isFetching && <ActivityIndicator color={colors.brand} style={{ marginTop: 20 }} />}
      </ScrollView>
    </SafeAreaView>
  );
}
