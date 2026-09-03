import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import Toast from 'react-native-toast-message';
import {
  BrandHeader,
  EmptyState,
  OverviewPanel,
  RiderButton,
  RiderCard,
  RiderTextField,
  SegmentedControl,
  StatusPill,
  WalletCard,
} from '@/components/rider-ui';
import { cleanLabel, compactDate, riderColors } from '@/lib/rider-design';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { RiderNavigationMenu } from '@/components/rider-navigation-menu';

type WithdrawMethod = 'MOBILE_MONEY' | 'BANK_TRANSFER';

type PayoutProvider = {
  name: string;
  code: string;
  type: string;
  currency: string;
};

type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

type WithdrawalRequest = {
  id: string;
  amount: number | string;
  currency: string;
  method: WithdrawMethod;
  destination: string;
  destinationName: string;
  status: WithdrawalStatus;
  processedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

const WITHDRAWAL_STATUS_COPY: Record<WithdrawalStatus, { label: string; message: string }> = {
  PENDING: {
    label: 'Awaiting review',
    message: 'RiderGuy Finance is reviewing this cash-out request.',
  },
  PROCESSING: {
    label: 'Processing',
    message: 'Your payout has been sent to the payment provider for processing.',
  },
  COMPLETED: {
    label: 'Paid',
    message: 'The payment provider confirmed this payout.',
  },
  FAILED: {
    label: 'Failed',
    message: 'The payout could not be completed. The amount has been returned to your wallet.',
  },
  CANCELLED: {
    label: 'Not approved',
    message:
      'RiderGuy Finance did not approve this request. The amount has been returned to your wallet.',
  },
};

function withdrawalTone(status: WithdrawalStatus) {
  if (status === 'CANCELLED') return 'REJECTED';
  if (status === 'PROCESSING') return 'UNDER_REVIEW';
  return status;
}

function maskPayoutDestination(destination: string) {
  const compact = destination.replace(/\s/g, '');
  if (compact.length <= 4) return compact;
  return `****${compact.slice(-4)}`;
}

function normalizeGhanaMobileMoneyNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('233')) {
    const nationalNumber = digits.slice(3);
    if (/^\d{9}$/.test(nationalNumber)) return `0${nationalNumber}`;
    if (/^0\d{9}$/.test(nationalNumber)) return nationalNumber;
  }
  if (/^\d{9}$/.test(digits)) return `0${digits}`;
  return digits;
}

function isSupportedGhanaProvider(
  provider: unknown,
  expectedType: string,
): provider is PayoutProvider {
  if (!provider || typeof provider !== 'object') return false;
  const candidate = provider as Partial<PayoutProvider>;
  return (
    typeof candidate.name === 'string' &&
    candidate.name.trim().toLowerCase() !== 'bank of ghana' &&
    typeof candidate.code === 'string' &&
    candidate.code.trim().length > 0 &&
    candidate.type?.toLowerCase() === expectedType &&
    candidate.currency?.toUpperCase() === 'GHS'
  );
}

export default function EarningsScreen() {
  const { action } = useLocalSearchParams<{ action?: string }>();
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<WithdrawMethod>('MOBILE_MONEY');
  const [destination, setDestination] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllWithdrawals, setShowAllWithdrawals] = useState(false);
  const { api, user } = useAuth();
  const { unreadCount } = useUnreadNotifications();

  const openCashOut = useCallback(() => {
    const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
    setMethod('MOBILE_MONEY');
    setBankCode('');
    setDestination(normalizeGhanaMobileMoneyNumber(user?.phone ?? ''));
    setDestinationName((current) => current || fullName);
    setWithdrawalOpen(true);
  }, [user?.firstName, user?.lastName, user?.phone]);

  useEffect(() => {
    if (action !== 'cash-out') return;
    openCashOut();
    router.setParams({ action: '' });
  }, [action, openCashOut]);

  const {
    data: wallet,
    isLoading: walletLoading,
    isRefetching: walletRefetching,
    refetch,
  } = useQuery({
    queryKey: ['rider-wallet'],
    queryFn: async () => {
      const { data } = await api.get('/wallets');
      return data.data ?? data;
    },
  });

  const {
    data: txData,
    isLoading: txLoading,
    isRefetching: txRefetching,
    refetch: refetchTx,
  } = useQuery({
    queryKey: ['rider-transactions'],
    queryFn: async () => {
      const { data } = await api.get('/wallets/transactions?limit=60');
      return (data.data ?? data) as any[];
    },
  });

  const {
    data: withdrawals = [],
    isLoading: withdrawalsLoading,
    isError: withdrawalsError,
    isRefetching: withdrawalsRefetching,
    refetch: refetchWithdrawals,
  } = useQuery<WithdrawalRequest[]>({
    queryKey: ['rider-withdrawals', user?.id],
    queryFn: async () => {
      const { data } = await api.get('/payments/withdrawals?limit=20');
      const requests = data.data ?? data;
      return Array.isArray(requests) ? (requests as WithdrawalRequest[]) : [];
    },
    enabled: Boolean(user?.id),
  });

  const payoutType = method === 'MOBILE_MONEY' ? 'mobile_money' : 'ghipss';
  const providersQuery = useQuery<PayoutProvider[]>({
    queryKey: ['ghana-payout-providers', payoutType],
    queryFn: async () => {
      const { data } = await api.get(`/payments/banks?type=${payoutType}`);
      const providers = data.data ?? data;
      if (!Array.isArray(providers)) return [];
      return providers.filter((provider) => isSupportedGhanaProvider(provider, payoutType));
    },
    enabled: withdrawalOpen,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const providers = providersQuery.data ?? [];

  const { mutate: withdraw, isPending } = useMutation({
    mutationFn: async () => {
      await api.post('/wallets/withdraw', {
        amount: Number(amount),
        method,
        destination:
          method === 'MOBILE_MONEY'
            ? normalizeGhanaMobileMoneyNumber(destination)
            : destination.replace(/[\s-]/g, ''),
        destinationName: destinationName.trim(),
        bankCode: bankCode.trim(),
      });
    },
    onSuccess: async () => {
      Toast.show({ type: 'success', text1: 'Withdrawal request submitted.' });
      setWithdrawalOpen(false);
      setAmount('');
      setBankCode('');
      setDestination('');
      setDestinationName('');
      await Promise.all([refetch(), refetchTx(), refetchWithdrawals()]);
    },
    onError: (error: any) =>
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.error?.message ?? 'Withdrawal failed.',
      }),
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

  const withdrawalAmount = Number(amount);
  const normalizedDestination =
    method === 'MOBILE_MONEY'
      ? normalizeGhanaMobileMoneyNumber(destination)
      : destination.replace(/[\s-]/g, '');
  const destinationValid =
    method === 'MOBILE_MONEY'
      ? /^0\d{9}$/.test(normalizedDestination)
      : /^\d{6,20}$/.test(normalizedDestination);
  const providerSelected = providers.some((provider) => provider.code === bankCode);
  const canWithdraw =
    Number.isFinite(withdrawalAmount) &&
    withdrawalAmount > 0 &&
    withdrawalAmount <= Number(wallet?.balance ?? 0) &&
    destinationValid &&
    destinationName.trim().length >= 2 &&
    providerSelected &&
    !providersQuery.isLoading;
  const currency = wallet?.currency ?? 'GHS';

  const changeMethod = (nextMethod: WithdrawMethod) => {
    if (nextMethod === method) return;
    setMethod(nextMethod);
    setBankCode('');
    setDestination(
      nextMethod === 'MOBILE_MONEY' ? normalizeGhanaMobileMoneyNumber(user?.phone ?? '') : '',
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.white }} edges={['top']}>
      <BrandHeader
        onMenu={() => setMenuOpen(true)}
        onNotifications={() => router.push('/(app)/notifications')}
        unread={unreadCount > 0}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={walletRefetching || txRefetching || withdrawalsRefetching}
            onRefresh={() => {
              void Promise.all([refetch(), refetchTx(), refetchWithdrawals()]);
            }}
            tintColor={riderColors.green}
          />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 14 }}>
            <View>
              <Text style={{ color: riderColors.ink, fontSize: 28, fontWeight: '900' }}>
                Earnings
              </Text>
              <Text
                style={{ color: riderColors.muted, fontSize: 13, fontWeight: '600', marginTop: 3 }}
              >
                Wallet, withdrawals, and earning history.
              </Text>
            </View>
            <WalletCard
              label="Available to Withdraw"
              balance={formatCurrency(Number(wallet?.balance ?? 0), currency)}
              loading={walletLoading}
              onCashOut={openCashOut}
              onAddMoney={() => router.push('/(app)/wallet/add-funds' as any)}
              onHistory={() => {
                void Promise.all([refetchTx(), refetchWithdrawals()]);
              }}
            />
            <OverviewPanel
              title="Payout Overview"
              items={[
                {
                  label: 'Earned',
                  value: formatCurrency(Number(wallet?.totalEarned ?? 0), currency),
                  icon: 'trending-up',
                  tone: 'green',
                },
                {
                  label: 'Withdrawn',
                  value: formatCurrency(Number(wallet?.totalWithdrawn ?? 0), currency),
                  icon: 'cash',
                  tone: 'green',
                },
                {
                  label: 'Transactions',
                  value: String(txData?.length ?? 0),
                  icon: 'receipt',
                  tone: 'green',
                },
              ]}
            />

            <View style={{ marginTop: 4 }}>
              <View
                style={{
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '900' }}>
                    Payout requests
                  </Text>
                  <Text
                    style={{
                      color: riderColors.muted,
                      fontSize: 11.5,
                      lineHeight: 17,
                      marginTop: 2,
                    }}
                  >
                    Track every cash-out from review through payment.
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Refresh payout requests"
                  onPress={() => void refetchWithdrawals()}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: riderColors.greenSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="refresh" size={19} color={riderColors.greenDark} />
                </TouchableOpacity>
              </View>

              {withdrawalsLoading ? (
                <View style={{ minHeight: 82, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={riderColors.green} />
                </View>
              ) : withdrawalsError ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => void refetchWithdrawals()}
                  style={{
                    minHeight: 64,
                    borderRadius: 15,
                    borderWidth: 1,
                    borderColor: riderColors.red,
                    backgroundColor: riderColors.redSoft,
                    padding: 12,
                    justifyContent: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: riderColors.red, fontSize: 12, fontWeight: '900' }}>
                    Payout status unavailable
                  </Text>
                  <Text style={{ color: '#9F241B', fontSize: 10.5, lineHeight: 16, marginTop: 2 }}>
                    Tap to retry. Your wallet transaction history is still shown below.
                  </Text>
                </TouchableOpacity>
              ) : withdrawals.length === 0 ? (
                <View
                  style={{
                    minHeight: 64,
                    borderRadius: 15,
                    borderWidth: 1,
                    borderColor: riderColors.line,
                    backgroundColor: riderColors.panelAlt,
                    padding: 12,
                    justifyContent: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: riderColors.ink, fontSize: 12, fontWeight: '900' }}>
                    No cash-out requests yet
                  </Text>
                  <Text
                    style={{
                      color: riderColors.muted,
                      fontSize: 10.5,
                      lineHeight: 16,
                      marginTop: 2,
                    }}
                  >
                    Your first request will appear here with its live status.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8, marginTop: 8 }}>
                  {(showAllWithdrawals ? withdrawals : withdrawals.slice(0, 4)).map((request) => {
                    const copy = WITHDRAWAL_STATUS_COPY[request.status] ?? {
                      label: cleanLabel(request.status),
                      message: 'RiderGuy Finance is updating this payout request.',
                    };
                    const hasDecisionReason =
                      (request.status === 'FAILED' || request.status === 'CANCELLED') &&
                      Boolean(request.failureReason?.trim());
                    return (
                      <RiderCard key={request.id} style={{ padding: 13 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{ color: riderColors.ink, fontSize: 13, fontWeight: '900' }}
                            >
                              {formatCurrency(Number(request.amount), request.currency || currency)}{' '}
                              cash-out
                            </Text>
                            <Text
                              style={{
                                color: riderColors.muted,
                                fontSize: 10.5,
                                lineHeight: 16,
                                marginTop: 2,
                              }}
                            >
                              {request.method === 'MOBILE_MONEY' ? 'Mobile Money' : 'Bank transfer'}{' '}
                              to {request.destinationName} (
                              {maskPayoutDestination(request.destination)})
                            </Text>
                          </View>
                          <StatusPill status={withdrawalTone(request.status)} label={copy.label} />
                        </View>
                        <Text
                          style={{
                            color: riderColors.muted,
                            fontSize: 10.5,
                            lineHeight: 16,
                            marginTop: 8,
                          }}
                        >
                          {copy.message}
                        </Text>
                        {hasDecisionReason ? (
                          <View
                            style={{
                              borderRadius: 12,
                              backgroundColor: riderColors.redSoft,
                              padding: 10,
                              marginTop: 8,
                            }}
                          >
                            <Text
                              style={{
                                color: '#9F241B',
                                fontSize: 10,
                                fontWeight: '900',
                                textTransform: 'uppercase',
                              }}
                            >
                              Reason
                            </Text>
                            <Text
                              style={{
                                color: riderColors.ink,
                                fontSize: 10.5,
                                lineHeight: 16,
                                marginTop: 2,
                              }}
                            >
                              {request.failureReason}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={{ color: riderColors.soft, fontSize: 9.5, marginTop: 8 }}>
                          Requested{' '}
                          {new Date(request.createdAt).toLocaleString('en-GB', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Text>
                      </RiderCard>
                    );
                  })}
                  {withdrawals.length > 4 ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showAllWithdrawals }}
                      onPress={() => setShowAllWithdrawals((current) => !current)}
                      style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text
                        style={{ color: riderColors.greenDark, fontSize: 11.5, fontWeight: '900' }}
                      >
                        {showAllWithdrawals
                          ? 'Show latest 4'
                          : `Show all ${withdrawals.length} payout requests`}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>

            <Text style={{ color: riderColors.ink, fontSize: 17, fontWeight: '900', marginTop: 2 }}>
              Transaction log
            </Text>
          </View>
        }
        ListEmptyComponent={
          !txLoading ? (
            <EmptyState
              icon="receipt-outline"
              title="No transactions yet"
              body="Delivery earnings, bonuses, withdrawals, and adjustments will appear here."
            />
          ) : (
            <ActivityIndicator color={riderColors.green} style={{ paddingVertical: 50 }} />
          )
        }
        renderSectionHeader={({ section }) => (
          <Text
            style={{
              color: riderColors.muted,
              fontSize: 11,
              fontWeight: '900',
              textTransform: 'uppercase',
              paddingVertical: 8,
              backgroundColor: riderColors.surface,
            }}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const isDebit = Number(item.amount) < 0 || item.type === 'WITHDRAWAL';
          return (
            <RiderCard style={{ marginBottom: 8, padding: 13 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 15,
                    backgroundColor: isDebit ? riderColors.amberSoft : riderColors.greenSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={isDebit ? 'arrow-up' : 'arrow-down'}
                    size={18}
                    color={isDebit ? riderColors.amber : riderColors.greenDark}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 13, fontWeight: '900' }}>
                    {item.description ?? item.type}
                  </Text>
                  <Text style={{ color: riderColors.muted, fontSize: 11, marginTop: 3 }}>
                    {new Date(item.createdAt).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text
                  style={{
                    color: isDebit ? riderColors.amber : riderColors.greenDark,
                    fontSize: 14,
                    fontWeight: '900',
                  }}
                >
                  {isDebit ? '-' : '+'}
                  {formatCurrency(Math.abs(Number(item.amount ?? 0)), item.currency ?? currency)}
                </Text>
              </View>
            </RiderCard>
          );
        }}
      />

      <Modal visible={withdrawalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,17,31,0.58)' }}
        >
          <SafeAreaView
            edges={['bottom']}
            style={{
              maxHeight: '92%',
              backgroundColor: riderColors.white,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
            }}
          >
            <ScrollView
              contentContainerStyle={{ padding: 18 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>
                    Cash out
                  </Text>
                  <Text style={{ color: riderColors.muted, fontSize: 12, marginTop: 2 }}>
                    Choose a verified Ghana payout provider.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setWithdrawalOpen(false)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: riderColors.panelAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={21} color={riderColors.ink} />
                </TouchableOpacity>
              </View>

              <SegmentedControl
                value={method}
                onChange={changeMethod}
                options={[
                  { label: 'MoMo', value: 'MOBILE_MONEY' },
                  { label: 'Bank', value: 'BANK_TRANSFER' },
                ]}
              />

              <View style={{ marginTop: 16 }}>
                <RiderTextField
                  label="Amount"
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ''))}
                />

                <Text
                  style={{
                    color: riderColors.ink,
                    fontSize: 12,
                    fontWeight: '800',
                    marginBottom: 8,
                  }}
                >
                  {method === 'MOBILE_MONEY' ? 'Mobile Money network' : 'Bank'}
                </Text>
                {providersQuery.isLoading ? (
                  <View
                    style={{
                      minHeight: 58,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <ActivityIndicator color={riderColors.green} />
                  </View>
                ) : providersQuery.isError ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => providersQuery.refetch()}
                    style={{
                      minHeight: 54,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: riderColors.red,
                      backgroundColor: riderColors.redSoft,
                      padding: 12,
                      justifyContent: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <Text style={{ color: riderColors.red, fontSize: 12, fontWeight: '800' }}>
                      Could not load providers. Tap to retry.
                    </Text>
                  </TouchableOpacity>
                ) : providers.length === 0 ? (
                  <View
                    style={{
                      minHeight: 54,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: riderColors.line,
                      backgroundColor: riderColors.panelAlt,
                      padding: 12,
                      justifyContent: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <Text style={{ color: riderColors.muted, fontSize: 12, fontWeight: '700' }}>
                      No supported providers are available right now.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
                  >
                    {providers.map((provider) => {
                      const selected = provider.code === bankCode;
                      return (
                        <TouchableOpacity
                          key={`${provider.type}-${provider.code}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setBankCode(provider.code)}
                          activeOpacity={0.82}
                          style={{
                            minHeight: 46,
                            maxWidth: 210,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: selected ? riderColors.green : riderColors.line,
                            backgroundColor: selected ? riderColors.greenSoft : riderColors.white,
                            paddingHorizontal: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{
                              color: selected ? riderColors.greenDark : riderColors.ink,
                              fontSize: 12,
                              fontWeight: '800',
                            }}
                          >
                            {provider.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                <RiderTextField
                  label={method === 'MOBILE_MONEY' ? 'Mobile Money number' : 'Account number'}
                  placeholder={method === 'MOBILE_MONEY' ? '0XX XXX XXXX' : 'Account number'}
                  value={destination}
                  onChangeText={setDestination}
                  keyboardType={method === 'MOBILE_MONEY' ? 'phone-pad' : 'number-pad'}
                />
                <RiderTextField
                  label={
                    method === 'MOBILE_MONEY' ? 'Name registered with network' : 'Name on account'
                  }
                  placeholder="Account holder name"
                  value={destinationName}
                  onChangeText={setDestinationName}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['50', '100', '200', 'All'].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    onPress={() =>
                      setAmount(preset === 'All' ? String(Number(wallet?.balance ?? 0)) : preset)
                    }
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: riderColors.line,
                      borderRadius: 13,
                      paddingVertical: 10,
                      alignItems: 'center',
                      backgroundColor: riderColors.panelAlt,
                    }}
                  >
                    <Text style={{ color: riderColors.ink, fontSize: 12, fontWeight: '900' }}>
                      {preset === 'All' ? 'All' : formatCurrency(Number(preset), currency)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <RiderButton
                label="Submit withdrawal"
                icon="send"
                loading={isPending}
                disabled={!canWithdraw}
                onPress={() => withdraw()}
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
      <RiderNavigationMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}
