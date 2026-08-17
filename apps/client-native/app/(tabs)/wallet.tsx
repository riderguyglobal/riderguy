import { useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import { EmptyState } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

function groupTransactions(rows: any[]) {
  const groups = rows.reduce((acc: Record<string, any[]>, tx: any) => {
    const key = new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(tx);
    return acc;
  }, {});
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

export default function WalletScreen() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const { api } = useAuth();

  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const { data } = await api.get('/wallets');
      return data.data ?? data;
    },
  });

  const txQuery = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: async () => {
      const { data } = await api.get('/wallets/transactions', { params: { limit: 50 } });
      return (data.data ?? data) as any[];
    },
  });

  const wallet = walletQuery.data;
  const transactions = txQuery.data ?? [];
  const sections = groupTransactions(transactions);
  const refreshing = walletQuery.isFetching || txQuery.isFetching;

  const refetchAll = () => {
    walletQuery.refetch();
    txQuery.refetch();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, backgroundColor: colors.surface }}>
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>Wallet</Text>
        <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: '700', marginTop: 3 }}>Pay faster, track every movement.</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={colors.brand} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        ListHeaderComponent={
          <View>
            <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
              <View style={{ position: 'absolute', right: -44, top: -34, width: 148, height: 148, borderRadius: 74, backgroundColor: 'rgba(10,185,87,0.20)' }} />
              <View style={{ position: 'absolute', right: 36, bottom: -44, width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '800' }}>Available Balance</Text>
                  <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1, marginTop: 4 }}>
                    {walletQuery.isLoading ? '...' : balanceVisible ? formatCurrency(wallet?.balance ?? 0, 'GHS') : '******'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setBalanceVisible((value) => !value)} style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginVertical: 18 }} />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={() => router.push('/(app)/wallet/add-funds')} style={{ flex: 1, height: 48, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Add Funds</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/(app)/settings/payment-methods')} style={{ flex: 1, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }}>
                  <Ionicons name="card-outline" size={17} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Methods</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 18 }}>
              <View style={{ flex: 1, borderRadius: 18, backgroundColor: '#fff', padding: 14, borderWidth: 1, borderColor: '#EEF2F7' }}>
                <Ionicons name="arrow-down-circle-outline" size={21} color={colors.brand} />
                <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', marginTop: 8, textTransform: 'uppercase' }}>Funded</Text>
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 2 }}>{formatCurrency(wallet?.totalFunded ?? wallet?.totalDeposited ?? 0, 'GHS')}</Text>
              </View>
              <View style={{ flex: 1, borderRadius: 18, backgroundColor: '#fff', padding: 14, borderWidth: 1, borderColor: '#EEF2F7' }}>
                <Ionicons name="receipt-outline" size={21} color={colors.blue} />
                <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', marginTop: 8, textTransform: 'uppercase' }}>Transactions</Text>
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 2 }}>{transactions.length}</Text>
              </View>
            </View>

            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 4 }}>Transaction Stream</Text>
          </View>
        }
        ListEmptyComponent={
          txQuery.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 50 }} />
          ) : (
            <EmptyState icon="receipt-outline" title="No transactions yet" body="Top up your wallet or pay for an order and your activity will appear here." />
          )
        }
        renderSectionHeader={({ section }) => (
          <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', paddingTop: 14, paddingBottom: 8, backgroundColor: colors.surface }}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const isCredit = ['CREDIT', 'DEPOSIT', 'TOPUP', 'REFUND'].includes(item.type);
          return (
            <View style={{ borderRadius: 18, backgroundColor: '#fff', padding: 14, marginBottom: 9, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
              <View style={{ width: 42, height: 42, borderRadius: 17, backgroundColor: isCredit ? colors.brandSoft : '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name={isCredit ? 'arrow-down-outline' : 'arrow-up-outline'} size={18} color={isCredit ? colors.brandDark : colors.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '900' }}>{item.description ?? item.type?.replace(/_/g, ' ')}</Text>
                <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 2 }}>{new Date(item.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={{ color: isCredit ? colors.brandDark : colors.ink, fontSize: 14, fontWeight: '900' }}>
                {isCredit ? '+' : '-'}{formatCurrency(Math.abs(item.amount ?? 0), 'GHS')}
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
