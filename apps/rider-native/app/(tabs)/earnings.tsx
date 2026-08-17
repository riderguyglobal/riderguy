import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, SectionList, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import Toast from 'react-native-toast-message';
import { BrandHeader, EmptyState, OverviewPanel, RiderButton, RiderCard, RiderTextField, SegmentedControl, WalletCard } from '@/components/rider-ui';
import { compactDate, riderColors } from '@/lib/rider-design';

type WithdrawMethod = 'MOBILE_MONEY' | 'BANK_TRANSFER';

export default function EarningsScreen() {
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<WithdrawMethod>('MOBILE_MONEY');
  const [destination, setDestination] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const { api, user } = useAuth();

  const { data: wallet, isLoading: walletLoading, refetch } = useQuery({
    queryKey: ['rider-wallet'],
    queryFn: async () => {
      const { data } = await api.get('/wallets');
      return data.data ?? data;
    },
  });

  const { data: txData, isLoading: txLoading, refetch: refetchTx } = useQuery({
    queryKey: ['rider-transactions'],
    queryFn: async () => {
      const { data } = await api.get('/wallets/transactions?limit=60');
      return (data.data ?? data) as any[];
    },
  });

  const { mutate: withdraw, isPending } = useMutation({
    mutationFn: async () => {
      await api.post('/wallets/withdraw', {
        amount: Number(amount),
        method,
        destination: destination.trim(),
        destinationName: destinationName.trim(),
        ...(method === 'BANK_TRANSFER' && bankCode.trim() ? { bankCode: bankCode.trim() } : {}),
      });
    },
    onSuccess: async () => {
      Toast.show({ type: 'success', text1: 'Withdrawal request submitted.' });
      setWithdrawalOpen(false);
      setAmount('');
      await Promise.all([refetch(), refetchTx()]);
    },
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Withdrawal failed.' }),
  });

  const sections = useMemo(() => {
    const grouped = (txData ?? []).reduce((acc: Record<string, any[]>, tx: any) => {
      const key = compactDate(tx.createdAt);
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(tx);
      return acc;
    }, {});
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [txData]);

  const canWithdraw = Number(amount) > 0 && destination.trim() && destinationName.trim();
  const currency = wallet?.currency ?? 'GHS';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.white }} edges={['top']}>
      <BrandHeader
        onMenu={() => router.push('/(tabs)/account')}
        onNotifications={() => router.push('/(app)/notifications')}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={walletLoading || txLoading} onRefresh={() => { refetch(); refetchTx(); }} tintColor={riderColors.green} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 14 }}>
            <View>
              <Text style={{ color: riderColors.ink, fontSize: 28, fontWeight: '900' }}>Earnings</Text>
              <Text style={{ color: riderColors.muted, fontSize: 13, fontWeight: '600', marginTop: 3 }}>Wallet, withdrawals, and earning history.</Text>
            </View>
            <WalletCard
              label="Available to Withdraw"
              balance={formatCurrency(Number(wallet?.balance ?? 0), currency)}
              loading={walletLoading}
              onCashOut={() => {
                setDestination((current) => current || user?.phone || '');
                setDestinationName((current) => current || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
                setWithdrawalOpen(true);
              }}
              onAddMoney={() => setWithdrawalOpen(true)}
              onHistory={() => refetchTx()}
            />
            <OverviewPanel
              title="Payout Overview"
              items={[
                { label: 'Earned', value: formatCurrency(Number(wallet?.totalEarned ?? 0), currency), icon: 'trending-up', tone: 'green' },
                { label: 'Withdrawn', value: formatCurrency(Number(wallet?.totalWithdrawn ?? 0), currency), icon: 'cash', tone: 'green' },
                { label: 'Transactions', value: String(txData?.length ?? 0), icon: 'receipt', tone: 'green' },
              ]}
            />

            <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '900', marginTop: 2 }}>Transaction log</Text>
          </View>
        }
        ListEmptyComponent={
          !txLoading ? (
            <EmptyState icon="receipt-outline" title="No transactions yet" body="Delivery earnings, bonuses, withdrawals, and adjustments will appear here." />
          ) : (
            <ActivityIndicator color={riderColors.green} style={{ paddingVertical: 50 }} />
          )
        }
        renderSectionHeader={({ section }) => (
          <Text style={{ color: riderColors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', paddingVertical: 8, backgroundColor: riderColors.surface }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const isDebit = Number(item.amount) < 0 || item.type === 'WITHDRAWAL';
          return (
            <RiderCard style={{ marginBottom: 8, padding: 13 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: isDebit ? riderColors.amberSoft : riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={isDebit ? 'arrow-up' : 'arrow-down'} size={18} color={isDebit ? riderColors.amber : riderColors.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '900' }}>{item.description ?? item.type}</Text>
                  <Text style={{ color: riderColors.muted, fontSize: 11, marginTop: 3 }}>
                    {new Date(item.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={{ color: isDebit ? riderColors.amber : riderColors.greenDark, fontSize: 14, fontWeight: '900' }}>
                  {isDebit ? '-' : '+'}{formatCurrency(Math.abs(Number(item.amount ?? 0)), item.currency ?? currency)}
                </Text>
              </View>
            </RiderCard>
          );
        }}
      />

      <Modal visible={withdrawalOpen} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,17,31,0.58)' }}>
          <View style={{ backgroundColor: riderColors.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>Cash out</Text>
                <Text style={{ color: riderColors.muted, fontSize: 12, marginTop: 2 }}>Minimum withdrawal rules are checked by the server.</Text>
              </View>
              <TouchableOpacity onPress={() => setWithdrawalOpen(false)} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: riderColors.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={21} color={riderColors.ink} />
              </TouchableOpacity>
            </View>

            <SegmentedControl
              value={method}
              onChange={setMethod}
              options={[
                { label: 'MoMo', value: 'MOBILE_MONEY' },
                { label: 'Bank', value: 'BANK_TRANSFER' },
              ]}
            />

            <View style={{ marginTop: 16 }}>
              <RiderTextField label="Amount" placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ''))} />
              <RiderTextField label={method === 'MOBILE_MONEY' ? 'Mobile money number' : 'Account number'} placeholder="+233 XX XXX XXXX" value={destination} onChangeText={setDestination} keyboardType={method === 'MOBILE_MONEY' ? 'phone-pad' : 'default'} />
              <RiderTextField label="Account name" placeholder="Name on account" value={destinationName} onChangeText={setDestinationName} />
              {method === 'BANK_TRANSFER' ? <RiderTextField label="Bank code" placeholder="Optional bank code" value={bankCode} onChangeText={setBankCode} /> : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {['50', '100', '200', 'All'].map((preset) => (
                <TouchableOpacity key={preset} onPress={() => setAmount(preset === 'All' ? String(Number(wallet?.balance ?? 0)) : preset)} style={{ flex: 1, borderWidth: 1, borderColor: riderColors.line, borderRadius: 13, paddingVertical: 10, alignItems: 'center', backgroundColor: riderColors.panelAlt }}>
                  <Text style={{ color: riderColors.ink, fontSize: 12, fontWeight: '900' }}>{preset === 'All' ? 'All' : formatCurrency(Number(preset), currency)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <RiderButton label="Submit withdrawal" icon="send" loading={isPending} disabled={!canWithdraw} onPress={() => withdraw()} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
