import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import { RoutePair, ScreenHeader, StatusBadge } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';
import { getOrderStatus, normalizeOrderTotal } from '@/lib/client-design';

function MoneyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
      <Text style={{ color: strong ? colors.ink : colors.muted, fontSize: strong ? 14 : 12, fontWeight: strong ? '900' : '700' }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: strong ? 16 : 13, fontWeight: '900' }}>{value}</Text>
    </View>
  );
}

export default function OrderPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const qc = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data ?? data;
    },
  });

  const payment = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/payments/initialize', { orderId: id });
      const body = data.data ?? data;
      const checkoutUrl = body.authorizationUrl ?? body.checkoutUrl;
      if (!checkoutUrl) throw new Error('Payment link was not created');
      await WebBrowser.openBrowserAsync(checkoutUrl);
      if (!body.reference) return body;
      const verified = await api.get(`/payments/verify/${body.reference}`);
      return verified.data.data ?? verified.data;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      if (result?.status === 'success') {
        Toast.show({ type: 'success', text1: 'Payment confirmed' });
        router.back();
      } else {
        Toast.show({ type: 'info', text1: 'Payment window closed', text2: 'We will update the order after confirmation.' });
      }
    },
    onError: (error: any) => {
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? error?.message ?? 'Payment failed' });
    },
  });

  const order = orderQuery.data;
  const status = getOrderStatus(order?.status);
  const total = normalizeOrderTotal(order);
  const alreadyPaid = order?.paymentStatus === 'COMPLETED';
  const isCash = order?.paymentMethod === 'CASH';
  const fee = Number(order?.serviceFee ?? 0);
  const subtotal = Math.max(0, total - fee);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Settle Payment" subtitle={order?.orderNumber ? `Order ${order.orderNumber}` : 'Secure checkout'} />

      {orderQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
            <View style={{ position: 'absolute', right: -48, top: -42, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(10,185,87,0.18)' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Amount Due</Text>
                <Text style={{ color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1, marginTop: 6 }}>
                  {formatCurrency(total, 'GHS')}
                </Text>
              </View>
              <StatusBadge
                label={alreadyPaid ? 'Paid' : isCash ? 'Cash' : 'Due'}
                bg={alreadyPaid ? colors.brand : isCash ? colors.amber : '#fff'}
                text={alreadyPaid ? '#fff' : colors.ink}
              />
            </View>
            <Text style={{ color: '#D1D5DB', fontSize: 12, lineHeight: 18, marginTop: 16, fontWeight: '700' }}>
              {alreadyPaid
                ? 'This order has already been settled.'
                : isCash
                  ? 'Cash orders are completed with your rider at dropoff.'
                  : 'Pay securely with card, mobile money, bank transfer, or a saved Paystack channel.'}
            </Text>
          </View>

          <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
            <RoutePair pickup={order?.pickupAddress} dropoff={order?.dropoffAddress} compact />
          </View>

          <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
            <MoneyRow label="Delivery subtotal" value={formatCurrency(subtotal, 'GHS')} />
            <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
            <MoneyRow label="Service fee" value={formatCurrency(fee, 'GHS')} />
            {!!order?.promoDiscount && (
              <>
                <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
                <MoneyRow label="Promo savings" value={`-${formatCurrency(order.promoDiscount, 'GHS')}`} />
              </>
            )}
            <View style={{ height: 1, backgroundColor: '#E5E7EB' }} />
            <MoneyRow label="Total" value={formatCurrency(total, 'GHS')} strong />
          </View>

          <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900' }}>Payment rail</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              {[
                { icon: 'phone-portrait-outline', label: 'MoMo' },
                { icon: 'card-outline', label: 'Card' },
                { icon: 'business-outline', label: 'Bank' },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF2F7', alignItems: 'center', paddingVertical: 13 }}>
                  <Ionicons name={item.icon as any} size={19} color={colors.brandDark} />
                  <Text style={{ color: colors.ink, fontSize: 11, fontWeight: '900', marginTop: 7 }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ marginTop: 14, borderRadius: 18, backgroundColor: '#EFF6FF', padding: 14, flexDirection: 'row', gap: 10 }}>
            <Ionicons name="lock-closed-outline" size={18} color="#1D4ED8" />
            <Text style={{ flex: 1, color: '#1E40AF', fontSize: 12, lineHeight: 18, fontWeight: '700' }}>
              Checkout opens in a secure Paystack window. After payment, return here and we will verify the reference.
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => payment.mutate()}
            disabled={payment.isPending || alreadyPaid || isCash || !order}
            style={{
              marginTop: 16,
              height: 56,
              borderRadius: 18,
              backgroundColor: payment.isPending || alreadyPaid || isCash ? '#D1D5DB' : colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              ...(payment.isPending || alreadyPaid || isCash ? {} : shadow.brand),
            }}
          >
            {payment.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="shield-checkmark-outline" size={19} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>
                  {alreadyPaid ? 'Already Paid' : isCash ? 'Cash Payment' : 'Pay Securely'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: '700' }}>{status.label}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
