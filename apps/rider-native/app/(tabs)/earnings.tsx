import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency, MIN_WITHDRAWAL_AMOUNT } from '@riderguy/utils';
import Toast from 'react-native-toast-message';
import {
  BrandHeader,
  EmptyState,
  RiderButton,
  RiderCard,
  RiderTextField,
  SegmentedControl,
  StatusPill,
} from '@/components/rider-ui';
import { cleanLabel, riderColors, riderFonts, riderShadow } from '@/lib/rider-design';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { RiderNavigationMenu } from '@/components/rider-navigation-menu';
import { riderContactPhone } from '@/lib/rider-contact';

const walletArt = require('../../assets/images/illustrations/rider-wallet-v2.png');

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

type EarningsPeriod = 'THIS_WEEK' | 'LAST_WEEK';

type WalletTransaction = {
  id: string;
  type: string;
  amount: number | string;
  balanceAfter?: number | string;
  currency?: string | null;
  description?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  createdAt: string;
};

type ResolvedPayout = {
  accountNumber: string;
  accountName: string;
  bankId?: number | string;
};

type PeriodSummary = {
  start: Date;
  end: Date;
  total: number;
  baseFare: number;
  tips: number;
  incentives: number;
  other: number;
  daily: { label: string; amount: number }[];
};

const PERIOD_OPTIONS: { value: EarningsPeriod; label: string }[] = [
  { value: 'THIS_WEEK', label: 'This Week' },
  { value: 'LAST_WEEK', label: 'Last Week' },
];

const PERIOD_EARNING_TYPES = new Set(['DELIVERY_EARNING', 'TIP', 'BONUS', 'REFERRAL_COMMISSION']);

// Ghana remains on UTC year-round. Financial periods must not move with a
// travelling rider's device timezone or an incorrectly configured handset.
function startOfGhanaDay(value: Date) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function startOfGhanaWeek(value: Date) {
  const date = startOfGhanaDay(value);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function getPeriodBounds(period: EarningsPeriod, now = new Date()) {
  const thisWeek = startOfGhanaWeek(now);
  const start = new Date(thisWeek);
  if (period === 'LAST_WEEK') start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

function summarizePeriod(transactions: WalletTransaction[], period: EarningsPeriod): PeriodSummary {
  const { start, end } = getPeriodBounds(period);
  const daily = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    return {
      label: day.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }).slice(0, 3),
      amount: 0,
    };
  });
  let baseFare = 0;
  let tips = 0;
  let incentives = 0;
  let other = 0;

  for (const transaction of transactions) {
    const createdAt = new Date(transaction.createdAt);
    const amount = Number(transaction.amount ?? 0);
    if (
      Number.isNaN(createdAt.getTime()) ||
      createdAt < start ||
      createdAt >= end ||
      amount <= 0 ||
      !PERIOD_EARNING_TYPES.has(transaction.type)
    ) {
      continue;
    }

    const bucket = Math.floor(
      (startOfGhanaDay(createdAt).getTime() - start.getTime()) / 86_400_000,
    );
    if (daily[bucket]) daily[bucket].amount += amount;
    if (transaction.type === 'DELIVERY_EARNING') baseFare += amount;
    else if (transaction.type === 'TIP') tips += amount;
    else if (transaction.type === 'BONUS') incentives += amount;
    else other += amount;
  }

  return {
    start,
    end,
    total: baseFare + tips + incentives + other,
    baseFare,
    tips,
    incentives,
    other,
    daily,
  };
}

function formatDateRange(start: Date, exclusiveEnd: Date) {
  const end = new Date(exclusiveEnd);
  end.setUTCDate(end.getUTCDate() - 1);
  const startLabel = start.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const endLabel = end.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${startLabel} – ${endLabel}`;
}

function formatOnlineDuration(startedAt?: string | null, online?: boolean, now = Date.now()) {
  if (!online || !startedAt) return 'Offline';
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return 'Online';
  const minutes = Math.max(0, Math.floor((now - started) / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

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
  const [period, setPeriod] = useState<EarningsPeriod>('THIS_WEEK');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [earningsVisible, setEarningsVisible] = useState(true);
  const [walletVisible, setWalletVisible] = useState(true);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showAllWithdrawals, setShowAllWithdrawals] = useState(false);
  const [resolvedPayoutKey, setResolvedPayoutKey] = useState<string | null>(null);
  const [withdrawalRequestId, setWithdrawalRequestId] = useState(() => Crypto.randomUUID());
  const [withdrawalAttempted, setWithdrawalAttempted] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const { api, user } = useAuth();
  const { unreadCount } = useUnreadNotifications();

  const openCashOut = useCallback(() => {
    if (withdrawalAttempted) {
      setWithdrawalOpen(true);
      return;
    }
    const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
    const verifiedPhone = riderContactPhone(user?.phone);
    setMethod('MOBILE_MONEY');
    setBankCode('');
    setDestination(normalizeGhanaMobileMoneyNumber(verifiedPhone ?? ''));
    setDestinationName((current) => current || fullName);
    setResolvedPayoutKey(null);
    setWithdrawalRequestId(Crypto.randomUUID());
    setWithdrawalOpen(true);
  }, [user?.firstName, user?.lastName, user?.phone, withdrawalAttempted]);

  useEffect(() => {
    if (action !== 'cash-out') return;
    openCashOut();
    router.setParams({ action: '' });
  }, [action, openCashOut]);

  const {
    data: wallet,
    isLoading: walletLoading,
    isError: walletError,
    isRefetching: walletRefetching,
    refetch,
  } = useQuery({
    queryKey: ['rider-wallet'],
    queryFn: async () => {
      const { data } = await api.get('/wallets');
      // A valid wallet response may explicitly contain `data: null` for an
      // account whose wallet has not been created yet. Preserve that null
      // instead of mistaking the response envelope for a wallet object.
      return data && typeof data === 'object' && 'data' in data ? data.data : data;
    },
  });

  const {
    data: txData,
    isLoading: txLoading,
    isError: txError,
    isRefetching: txRefetching,
    refetch: refetchTx,
  } = useQuery({
    queryKey: ['rider-transactions'],
    queryFn: async () => {
      const earliestRequired = startOfGhanaWeek(new Date());
      earliestRequired.setUTCDate(earliestRequired.getUTCDate() - 14);
      const transactions: WalletTransaction[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const { data } = await api.get(`/wallets/transactions?limit=100&page=${page}`);
        const rows = data.data ?? data;
        if (!Array.isArray(rows)) break;
        transactions.push(...(rows as WalletTransaction[]));
        totalPages = Math.max(1, Number(data.pagination?.totalPages ?? 1));
        const oldest = rows[rows.length - 1] as WalletTransaction | undefined;
        if (!oldest || Date.parse(oldest.createdAt) < earliestRequired.getTime()) break;
        page += 1;
      } while (page <= totalPages);

      return transactions;
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

  const resolvePayout = useMutation<
    ResolvedPayout,
    unknown,
    { accountNumber: string; bankCode: string; key: string }
  >({
    mutationFn: async ({ accountNumber, bankCode }) => {
      const { data } = await api.post('/payments/resolve-account', { accountNumber, bankCode });
      return (data.data ?? data) as ResolvedPayout;
    },
    onSuccess: (result, variables) => {
      setDestinationName(result.accountName);
      setResolvedPayoutKey(variables.key);
      Toast.show({ type: 'success', text1: 'Payout account verified.' });
    },
    onError: (error: any) => {
      setResolvedPayoutKey(null);
      Toast.show({
        type: 'error',
        text1:
          error?.response?.data?.error?.message ??
          'Could not verify this payout account. Check the details and retry.',
      });
    },
  });

  const { mutate: withdraw, isPending } = useMutation({
    mutationFn: async () => {
      await api.post('/wallets/withdraw', {
        requestId: withdrawalRequestId,
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
      setResolvedPayoutKey(null);
      setWithdrawalAttempted(false);
      setWithdrawalRequestId(Crypto.randomUUID());
      await Promise.all([refetch(), refetchTx(), refetchWithdrawals()]);
    },
    onError: async (error: any) => {
      const status = Number(error?.response?.status);
      const definitelyRejected = Number.isFinite(status) && status >= 400 && status < 500;
      if (definitelyRejected) {
        setWithdrawalAttempted(false);
        setWithdrawalRequestId(Crypto.randomUUID());
      }
      await Promise.allSettled([refetch(), refetchTx(), refetchWithdrawals()]);
      Toast.show({
        type: 'error',
        text1:
          error?.response?.data?.error?.message ??
          'Cash-out confirmation was interrupted. Your wallet was refreshed.',
        text2: definitelyRejected
          ? 'Correct the details and submit a new request.'
          : 'Retrying this same request cannot debit your wallet twice.',
      });
    },
  });

  const {
    data: riderProfile,
    isError: riderProfileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['rider-profile'],
    queryFn: async () => {
      const { data } = await api.get('/riders/profile');
      return data.data ?? data;
    },
    enabled: Boolean(user?.id),
    retry: false,
  });

  const transactions = useMemo(
    () => (Array.isArray(txData) ? (txData as WalletTransaction[]) : []),
    [txData],
  );
  const summary = useMemo(() => summarizePeriod(transactions, period), [period, transactions]);
  const comparisonSummary = useMemo(() => {
    if (period === 'THIS_WEEK') return summarizePeriod(transactions, 'LAST_WEEK');
    const { start } = getPeriodBounds('LAST_WEEK');
    const previousStart = new Date(start);
    previousStart.setUTCDate(previousStart.getUTCDate() - 7);
    const previousEnd = new Date(start);
    const scoped = transactions.filter((transaction) => {
      const createdAt = new Date(transaction.createdAt);
      return createdAt >= previousStart && createdAt < previousEnd;
    });
    return {
      ...summarizePeriod(scoped, 'LAST_WEEK'),
      total: scoped.reduce((total, transaction) => {
        const amount = Number(transaction.amount ?? 0);
        return amount > 0 && PERIOD_EARNING_TYPES.has(transaction.type) ? total + amount : total;
      }, 0),
    };
  }, [period, transactions]);
  const comparisonPercent =
    comparisonSummary.total > 0
      ? Math.round(((summary.total - comparisonSummary.total) / comparisonSummary.total) * 100)
      : summary.total > 0
        ? 100
        : 0;
  const today = startOfGhanaDay(new Date());
  const todayEnd = new Date(today);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  const todayTransactions = transactions.filter((transaction) => {
    const createdAt = new Date(transaction.createdAt);
    return createdAt >= today && createdAt < todayEnd;
  });
  const todayTips = todayTransactions
    .filter((transaction) => transaction.type === 'TIP' && Number(transaction.amount) > 0)
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const todayTotal = todayTransactions
    .filter(
      (transaction) => PERIOD_EARNING_TYPES.has(transaction.type) && Number(transaction.amount) > 0,
    )
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const todayDeliveries = todayTransactions.filter(
    (transaction) => transaction.type === 'DELIVERY_EARNING' && Number(transaction.amount) > 0,
  ).length;
  const isOnline = ['ONLINE', 'ON_DELIVERY'].includes(
    String(riderProfile?.availability ?? '').toUpperCase(),
  );

  useEffect(() => {
    setNowMs(Date.now());
    if (!isOnline) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [isOnline]);

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
  const payoutKey = `${method}:${bankCode}:${normalizedDestination}`;
  const payoutResolved = resolvedPayoutKey === payoutKey && destinationName.trim().length >= 2;
  const walletBalance = wallet ? Number(wallet.balance) : null;
  const canWithdraw =
    Number.isFinite(withdrawalAmount) &&
    withdrawalAmount >= MIN_WITHDRAWAL_AMOUNT &&
    walletBalance !== null &&
    Number.isFinite(walletBalance) &&
    withdrawalAmount <= walletBalance &&
    destinationValid &&
    payoutResolved &&
    providerSelected &&
    !providersQuery.isLoading &&
    !walletError;
  const currency = wallet?.currency ?? 'GHS';

  const changeMethod = (nextMethod: WithdrawMethod) => {
    if (nextMethod === method || withdrawalAttempted) return;
    setMethod(nextMethod);
    setBankCode('');
    setResolvedPayoutKey(null);
    setDestinationName('');
    setDestination(
      nextMethod === 'MOBILE_MONEY'
        ? normalizeGhanaMobileMoneyNumber(riderContactPhone(user?.phone) ?? '')
        : '',
    );
  };

  const verifyPayoutAccount = () => {
    if (!providerSelected || !destinationValid || resolvePayout.isPending) return;
    resolvePayout.mutate({
      accountNumber: normalizedDestination,
      bankCode: bankCode.trim(),
      key: payoutKey,
    });
  };

  const confirmWithdrawal = () => {
    if (!canWithdraw) return;
    const provider = providers.find((item) => item.code === bankCode);
    Alert.alert(
      'Confirm cash out',
      `${formatCurrency(withdrawalAmount, currency)} will be sent to ${destinationName.trim()} at ${provider?.name ?? 'your selected provider'} (${maskPayoutDestination(normalizedDestination)}).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm cash out',
          onPress: () => {
            setWithdrawalAttempted(true);
            withdraw();
          },
        },
      ],
    );
  };

  const explainPaymentMethods = () => {
    Alert.alert(
      'Payment methods',
      'For your security, RiderGuy verifies the Mobile Money or bank account each time you cash out. Unverified payout details are not saved.',
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Set up cash out', onPress: openCashOut },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.white }} edges={['top']}>
      <BrandHeader
        onMenu={() => setMenuOpen(true)}
        onNotifications={() => router.push('/(app)/notifications')}
        unread={unreadCount > 0}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={walletRefetching || txRefetching || withdrawalsRefetching}
            onRefresh={() => {
              void Promise.all([refetch(), refetchTx(), refetchWithdrawals(), refetchProfile()]);
            }}
            tintColor={riderColors.green}
          />
        }
        contentContainerStyle={earningsStyles.content}
      >
        <View style={earningsStyles.headingRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={earningsStyles.pageTitle}>Earnings</Text>
            <Text style={earningsStyles.pageSubtitle}>
              Track your earnings and wallet activity.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Earnings period: ${PERIOD_OPTIONS.find((option) => option.value === period)?.label}`}
            accessibilityState={{ expanded: periodMenuOpen }}
            activeOpacity={0.82}
            onPress={() => setPeriodMenuOpen(true)}
            style={earningsStyles.periodButton}
          >
            <Ionicons name="calendar-clear-outline" size={18} color={riderColors.greenDark} />
            <Text style={earningsStyles.periodButtonText}>
              {PERIOD_OPTIONS.find((option) => option.value === period)?.label}
            </Text>
            <Ionicons name="chevron-down" size={16} color={riderColors.muted} />
          </TouchableOpacity>
        </View>

        {txError ? (
          <FinancialDataError
            title="Earnings are unavailable"
            body="We could not load your transaction ledger. Tap to retry; unavailable totals are never shown as zero."
            onRetry={() => void refetchTx()}
          />
        ) : (
          <EarningsHero
            currency={currency}
            summary={summary}
            comparisonPercent={comparisonPercent}
            visible={earningsVisible}
            onToggleVisible={() => setEarningsVisible((current) => !current)}
            loading={txLoading}
          />
        )}

        <View style={earningsStyles.metricCard}>
          <EarningsMetric
            icon="wallet-outline"
            label="Today's Earnings"
            value={txLoading ? '…' : txError ? '—' : formatCurrency(todayTotal, currency)}
          />
          <View style={earningsStyles.metricDivider} />
          <EarningsMetric
            icon="cash-outline"
            label="Today's Tips"
            value={txLoading ? '…' : txError ? '—' : formatCurrency(todayTips, currency)}
          />
          <View style={earningsStyles.metricDivider} />
          <EarningsMetric
            icon="star-outline"
            label="Deliveries"
            value={txLoading ? '…' : txError ? '—' : String(todayDeliveries)}
          />
          <View style={earningsStyles.metricDivider} />
          <EarningsMetric
            icon="time-outline"
            label="Current Session"
            value={
              riderProfileError
                ? '—'
                : formatOnlineDuration(riderProfile?.sessionStartedAt, isOnline, nowMs)
            }
          />
        </View>

        {!txError ? (
          <View style={earningsStyles.panel}>
            <View style={earningsStyles.panelHeading}>
              <Text style={earningsStyles.panelTitle}>Earnings Breakdown</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Refresh earnings details"
                onPress={() => void refetchTx()}
              >
                <Text style={earningsStyles.panelAction}>Refresh</Text>
              </TouchableOpacity>
            </View>
            <BreakdownRow
              label="Base Fare"
              amount={summary.baseFare}
              currency={currency}
              tone="#71CE99"
            />
            <BreakdownRow label="Tips" amount={summary.tips} currency={currency} tone="#9BDBB6" />
            <BreakdownRow
              label="Incentives"
              amount={summary.incentives}
              currency={currency}
              tone="#BDE7CE"
            />
            <BreakdownRow
              label="Other Earnings"
              amount={summary.other}
              currency={currency}
              tone="#D6F0E1"
            />
            <View style={earningsStyles.breakdownTotal}>
              <Text style={earningsStyles.breakdownTotalLabel}>Total Earnings</Text>
              <Text style={earningsStyles.breakdownTotalValue}>
                {earningsVisible ? formatCurrency(summary.total, currency) : '••••••'}
              </Text>
            </View>
          </View>
        ) : null}

        {walletError ? (
          <FinancialDataError
            title="Wallet balance is unavailable"
            body="Cash-out actions stay locked until your authoritative wallet balance loads."
            onRetry={() => void refetch()}
          />
        ) : null}

        <WalletPanel
          balance={
            walletLoading
              ? 'Loading…'
              : walletError || !wallet
                ? 'Unavailable'
                : formatCurrency(Number(wallet.balance), currency)
          }
          loading={walletLoading}
          visible={walletVisible}
          onToggleVisible={() => setWalletVisible((current) => !current)}
          onAddMoney={() => router.push('/(app)/wallet/add-funds' as any)}
          onCashOut={openCashOut}
          onHistory={() => {
            setShowAllTransactions(true);
            void refetchTx();
          }}
          onPaymentMethods={explainPaymentMethods}
        />

        <View style={earningsStyles.transactionsCard}>
          <View style={[earningsStyles.panelHeading, earningsStyles.transactionsHeading]}>
            <Text style={earningsStyles.panelTitle}>Recent Transactions</Text>
            {transactions.length > 3 ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: showAllTransactions }}
                onPress={() => setShowAllTransactions((current) => !current)}
              >
                <Text style={earningsStyles.panelAction}>
                  {showAllTransactions ? 'Show less' : 'View recent'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {txLoading ? (
            <ActivityIndicator color={riderColors.green} style={{ paddingVertical: 32 }} />
          ) : txError ? (
            <FinancialDataError
              compact
              title="Transactions unavailable"
              body="Tap to retry your wallet history."
              onRetry={() => void refetchTx()}
            />
          ) : transactions.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No transactions yet"
              body="Delivery earnings, tips, withdrawals, and adjustments will appear here."
            />
          ) : (
            (showAllTransactions ? transactions : transactions.slice(0, 3)).map(
              (transaction, index, shown) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  currency={currency}
                  divided={index < shown.length - 1}
                />
              ),
            )
          )}
        </View>

        <View style={earningsStyles.payoutSection}>
          <View style={earningsStyles.panelHeading}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={earningsStyles.panelTitle}>Cash-out Requests</Text>
              <Text style={earningsStyles.payoutSubtitle}>Track review and payment status.</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Refresh cash-out requests"
              onPress={() => void refetchWithdrawals()}
              style={earningsStyles.refreshButton}
            >
              <Ionicons name="refresh" size={17} color={riderColors.greenDark} />
            </TouchableOpacity>
          </View>

          {withdrawalsLoading ? (
            <ActivityIndicator color={riderColors.green} style={{ paddingVertical: 28 }} />
          ) : withdrawalsError ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Retry cash-out requests"
              onPress={() => void refetchWithdrawals()}
              style={earningsStyles.errorNotice}
            >
              <Text style={earningsStyles.errorTitle}>Payout status unavailable</Text>
              <Text style={earningsStyles.errorBody}>Tap to retry.</Text>
            </TouchableOpacity>
          ) : withdrawals.length === 0 ? (
            <View style={earningsStyles.emptyPayout}>
              <Text style={earningsStyles.emptyPayoutTitle}>No cash-out requests yet</Text>
              <Text style={earningsStyles.emptyPayoutBody}>
                Your first request will appear here with its live status.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: 9 }}>
              {(showAllWithdrawals ? withdrawals : withdrawals.slice(0, 3)).map((request) => (
                <WithdrawalCard key={request.id} request={request} currency={currency} />
              ))}
              {withdrawals.length > 3 ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAllWithdrawals }}
                  onPress={() => setShowAllWithdrawals((current) => !current)}
                  style={earningsStyles.showMoreButton}
                >
                  <Text style={earningsStyles.panelAction}>
                    {showAllWithdrawals
                      ? 'Show latest 3'
                      : `View latest ${withdrawals.length} requests`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={periodMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPeriodMenuOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setPeriodMenuOpen(false)}
          style={earningsStyles.periodBackdrop}
        >
          <View style={earningsStyles.periodMenu}>
            <Text style={earningsStyles.periodMenuTitle}>Earnings period</Text>
            {PERIOD_OPTIONS.map((option) => {
              const selected = option.value === period;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  activeOpacity={0.82}
                  onPress={() => {
                    setPeriod(option.value);
                    setPeriodMenuOpen(false);
                  }}
                  style={[
                    earningsStyles.periodOption,
                    selected ? earningsStyles.periodOptionSelected : null,
                  ]}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={19}
                    color={selected ? riderColors.greenDark : riderColors.soft}
                  />
                  <Text
                    style={[
                      earningsStyles.periodOptionText,
                      selected ? earningsStyles.periodOptionTextSelected : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={withdrawalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!isPending) setWithdrawalOpen(false);
        }}
      >
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
                  accessibilityRole="button"
                  accessibilityLabel="Close cash out"
                  disabled={isPending}
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
                disabled={withdrawalAttempted || isPending}
                options={[
                  { label: 'MoMo', value: 'MOBILE_MONEY' },
                  { label: 'Bank', value: 'BANK_TRANSFER' },
                ]}
              />

              {withdrawalAttempted && !isPending ? (
                <View style={earningsStyles.idempotencyNotice}>
                  <Ionicons name="shield-checkmark" size={18} color={riderColors.greenDark} />
                  <Text style={earningsStyles.idempotencyNoticeText}>
                    Retrying keeps the same protected request and cannot debit this cash out twice.
                  </Text>
                </View>
              ) : null}

              <View style={{ marginTop: 16 }}>
                <RiderTextField
                  label="Amount"
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  editable={!withdrawalAttempted}
                  value={amount}
                  onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ''))}
                />
                <Text
                  style={{
                    color: riderColors.muted,
                    fontSize: 10.5,
                    lineHeight: 15,
                    marginTop: -8,
                    marginBottom: 13,
                  }}
                >
                  Minimum cash out: {formatCurrency(MIN_WITHDRAWAL_AMOUNT, currency)}
                </Text>

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
                          disabled={withdrawalAttempted}
                          onPress={() => {
                            setBankCode(provider.code);
                            setDestinationName('');
                            setResolvedPayoutKey(null);
                          }}
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
                  editable={!withdrawalAttempted}
                  onChangeText={(value) => {
                    setDestination(value);
                    setDestinationName('');
                    setResolvedPayoutKey(null);
                  }}
                  keyboardType={method === 'MOBILE_MONEY' ? 'phone-pad' : 'number-pad'}
                />
                <RiderTextField
                  label={
                    method === 'MOBILE_MONEY' ? 'Name registered with network' : 'Name on account'
                  }
                  placeholder="Account holder name"
                  value={destinationName}
                  onChangeText={setDestinationName}
                  editable={false}
                />
                <RiderButton
                  label={payoutResolved ? 'Account verified' : 'Verify payout account'}
                  icon={payoutResolved ? 'checkmark-circle' : 'shield-checkmark-outline'}
                  variant="light"
                  loading={resolvePayout.isPending}
                  disabled={!providerSelected || !destinationValid || payoutResolved}
                  onPress={verifyPayoutAccount}
                  style={{ marginBottom: 14 }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['50', '100', '200', 'All'].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    accessibilityRole="button"
                    disabled={walletError || !wallet || withdrawalAttempted}
                    onPress={() =>
                      setAmount(preset === 'All' ? String(Number(wallet?.balance)) : preset)
                    }
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: riderColors.line,
                      borderRadius: 13,
                      paddingVertical: 10,
                      alignItems: 'center',
                      backgroundColor:
                        walletError || !wallet ? riderColors.line : riderColors.panelAlt,
                    }}
                  >
                    <Text style={{ color: riderColors.ink, fontSize: 12, fontWeight: '900' }}>
                      {preset === 'All' ? 'All' : formatCurrency(Number(preset), currency)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <RiderButton
                label={withdrawalAttempted ? 'Retry protected cash out' : 'Review cash out'}
                icon="send"
                loading={isPending}
                disabled={!canWithdraw}
                onPress={confirmWithdrawal}
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
      <RiderNavigationMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}

function FinancialDataError({
  body,
  compact = false,
  onRetry,
  title,
}: {
  body: string;
  compact?: boolean;
  onRetry: () => void;
  title: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body} Tap to retry.`}
      activeOpacity={0.82}
      onPress={onRetry}
      style={[earningsStyles.financialError, compact ? earningsStyles.financialErrorCompact : null]}
    >
      <View style={earningsStyles.financialErrorIcon}>
        <Ionicons name="cloud-offline-outline" size={22} color={riderColors.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={earningsStyles.financialErrorTitle}>{title}</Text>
        <Text style={earningsStyles.financialErrorBody}>{body}</Text>
      </View>
      <Ionicons name="refresh" size={20} color={riderColors.greenDark} />
    </TouchableOpacity>
  );
}

function EarningsHero({
  currency,
  summary,
  comparisonPercent,
  visible,
  onToggleVisible,
  loading,
}: {
  currency: string;
  summary: PeriodSummary;
  comparisonPercent: number;
  visible: boolean;
  onToggleVisible: () => void;
  loading: boolean;
}) {
  const chartWidth = 320;
  const chartHeight = 86;
  const horizontalPadding = 14;
  const verticalPadding = 12;
  const maxAmount = Math.max(...summary.daily.map((day) => day.amount), 1);
  const points = summary.daily.map((day, index) => ({
    x: horizontalPadding + (index * (chartWidth - horizontalPadding * 2)) / 6,
    y:
      chartHeight -
      verticalPadding -
      (day.amount / maxAmount) * (chartHeight - verticalPadding * 2),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const comparisonPositive = comparisonPercent >= 0;

  return (
    <View style={earningsStyles.heroCard}>
      <View style={earningsStyles.heroGlowLarge} />
      <View style={earningsStyles.heroGlowSmall} />
      <View style={earningsStyles.heroTopRow}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide total earnings' : 'Show total earnings'}
            accessibilityState={{ expanded: visible }}
            activeOpacity={0.82}
            onPress={onToggleVisible}
            style={earningsStyles.heroLabelRow}
          >
            <Text style={earningsStyles.heroLabel}>Total Earnings</Text>
            <Ionicons
              name={visible ? 'eye-outline' : 'eye-off-outline'}
              size={16}
              color={riderColors.white}
            />
          </TouchableOpacity>
          {loading ? (
            <ActivityIndicator
              color={riderColors.white}
              style={{ alignSelf: 'flex-start', marginTop: 9 }}
            />
          ) : (
            <Text style={earningsStyles.heroAmount} numberOfLines={1}>
              {visible ? formatCurrency(summary.total, currency) : '••••••'}
            </Text>
          )}
          <Text style={earningsStyles.heroDate}>{formatDateRange(summary.start, summary.end)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={earningsStyles.changePill}>
            <Ionicons
              name={comparisonPositive ? 'caret-up' : 'caret-down'}
              size={11}
              color={comparisonPositive ? '#087A4B' : riderColors.red}
            />
            <Text
              style={[
                earningsStyles.changeValue,
                !comparisonPositive ? { color: riderColors.red } : null,
              ]}
            >
              {Math.abs(comparisonPercent)}%
            </Text>
          </View>
          <Text style={earningsStyles.changeCaption}>vs prior week</Text>
        </View>
      </View>

      <View style={earningsStyles.chartWrap} accessibilityLabel="Seven day earnings chart">
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <Line
            x1={horizontalPadding}
            y1={chartHeight - verticalPadding}
            x2={chartWidth - horizontalPadding}
            y2={chartHeight - verticalPadding}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1}
          />
          <Path
            d={path}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point, index) => (
            <Circle
              key={`${summary.daily[index]?.label}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === points.length - 1 ? 4.8 : 3.4}
              fill="#FFFFFF"
              stroke={index === points.length - 1 ? 'rgba(255,255,255,0.28)' : '#FFFFFF'}
              strokeWidth={index === points.length - 1 ? 5 : 0}
            />
          ))}
        </Svg>
        <View style={earningsStyles.chartLabels}>
          {summary.daily.map((day) => (
            <Text key={day.label} style={earningsStyles.chartLabel}>
              {day.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function EarningsMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={earningsStyles.metricItem}>
      <View style={earningsStyles.metricIcon}>
        <Ionicons name={icon} size={18} color={riderColors.greenDark} />
      </View>
      <Text style={earningsStyles.metricLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={earningsStyles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function BreakdownRow({
  label,
  amount,
  currency,
  tone,
}: {
  label: string;
  amount: number;
  currency: string;
  tone: string;
}) {
  return (
    <View style={earningsStyles.breakdownRow}>
      <View style={[earningsStyles.breakdownDot, { backgroundColor: tone }]} />
      <Text style={earningsStyles.breakdownLabel}>{label}</Text>
      <Text style={earningsStyles.breakdownAmount}>{formatCurrency(amount, currency)}</Text>
    </View>
  );
}

function WalletPanel({
  balance,
  loading,
  visible,
  onToggleVisible,
  onAddMoney,
  onCashOut,
  onHistory,
  onPaymentMethods,
}: {
  balance: string;
  loading: boolean;
  visible: boolean;
  onToggleVisible: () => void;
  onAddMoney: () => void;
  onCashOut: () => void;
  onHistory: () => void;
  onPaymentMethods: () => void;
}) {
  return (
    <View style={earningsStyles.walletPanel}>
      <Image source={walletArt} resizeMode="contain" style={earningsStyles.walletDecoration} />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide wallet balance' : 'Show wallet balance'}
        accessibilityState={{ expanded: visible }}
        activeOpacity={0.82}
        onPress={onToggleVisible}
        style={earningsStyles.walletTitleRow}
      >
        <Text style={earningsStyles.walletTitle}>Wallet Balance</Text>
        <Ionicons
          name={visible ? 'eye-outline' : 'eye-off-outline'}
          size={17}
          color={riderColors.muted}
        />
      </TouchableOpacity>
      {loading ? (
        <ActivityIndicator
          color={riderColors.green}
          style={{ alignSelf: 'flex-start', marginTop: 9 }}
        />
      ) : (
        <Text style={earningsStyles.walletBalance}>{visible ? balance : '••••••'}</Text>
      )}
      <Text style={earningsStyles.availableLabel}>Available Balance</Text>
      <View style={earningsStyles.walletDivider} />
      <View style={earningsStyles.walletActions}>
        <WalletPanelAction icon="cash-outline" label="Add Money" onPress={onAddMoney} />
        <WalletPanelAction icon="share-outline" label="Cash Out" onPress={onCashOut} divided />
        <WalletPanelAction
          icon="receipt-outline"
          label="Recent Transactions"
          onPress={onHistory}
          divided
        />
        <WalletPanelAction
          icon="card-outline"
          label="Payment Methods"
          onPress={onPaymentMethods}
          divided
        />
      </View>
    </View>
  );
}

function WalletPanelAction({
  icon,
  label,
  onPress,
  divided,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  divided?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.8}
      onPress={onPress}
      style={[earningsStyles.walletAction, divided ? earningsStyles.walletActionDivided : null]}
    >
      <Ionicons name={icon} size={20} color={riderColors.greenDark} />
      <Text style={earningsStyles.walletActionLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function TransactionRow({
  transaction,
  currency,
  divided,
}: {
  transaction: WalletTransaction;
  currency: string;
  divided: boolean;
}) {
  const amount = Number(transaction.amount ?? 0);
  const debit =
    amount < 0 || ['WITHDRAWAL', 'PENALTY', 'COMMISSION_DEDUCTION'].includes(transaction.type);
  const title = transaction.description?.trim() || cleanLabel(transaction.type);
  const icon = transaction.type === 'TIP' ? 'star' : debit ? 'arrow-up' : 'arrow-down';
  const date = new Date(transaction.createdAt);
  const dateLabel = Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${debit ? 'minus' : 'plus'} ${formatCurrency(Math.abs(amount), transaction.currency ?? currency)}`}
      activeOpacity={0.78}
      onPress={() =>
        Alert.alert(
          title,
          `${dateLabel}\n${cleanLabel(transaction.type)}${transaction.balanceAfter !== undefined ? `\nBalance after: ${formatCurrency(Number(transaction.balanceAfter), transaction.currency ?? currency)}` : ''}`,
        )
      }
      style={[earningsStyles.transactionRow, divided ? earningsStyles.transactionRowDivided : null]}
    >
      <View
        style={[earningsStyles.transactionIcon, debit ? earningsStyles.transactionIconDebit : null]}
      >
        <Ionicons name={icon} size={18} color={debit ? riderColors.red : riderColors.greenDark} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={earningsStyles.transactionTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={earningsStyles.transactionDate} numberOfLines={1}>
          {dateLabel}
        </Text>
      </View>
      <Text
        style={[
          earningsStyles.transactionAmount,
          debit ? earningsStyles.transactionAmountDebit : null,
        ]}
      >
        {debit ? '-' : '+'} {formatCurrency(Math.abs(amount), transaction.currency ?? currency)}
      </Text>
      <Ionicons name="chevron-forward" size={17} color={riderColors.soft} />
    </TouchableOpacity>
  );
}

function WithdrawalCard({ request, currency }: { request: WithdrawalRequest; currency: string }) {
  const copy = WITHDRAWAL_STATUS_COPY[request.status] ?? {
    label: cleanLabel(request.status),
    message: 'RiderGuy Finance is updating this payout request.',
  };
  const hasDecisionReason =
    (request.status === 'FAILED' || request.status === 'CANCELLED') &&
    Boolean(request.failureReason?.trim());

  return (
    <RiderCard style={{ padding: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={earningsStyles.withdrawalTitle}>
            {formatCurrency(Number(request.amount), request.currency || currency)} cash-out
          </Text>
          <Text style={earningsStyles.withdrawalDestination}>
            {request.method === 'MOBILE_MONEY' ? 'Mobile Money' : 'Bank transfer'} to{' '}
            {request.destinationName} ({maskPayoutDestination(request.destination)})
          </Text>
        </View>
        <StatusPill status={withdrawalTone(request.status)} label={copy.label} />
      </View>
      <Text style={earningsStyles.withdrawalMessage}>{copy.message}</Text>
      {hasDecisionReason ? (
        <View style={earningsStyles.withdrawalReason}>
          <Text style={earningsStyles.withdrawalReasonLabel}>Reason</Text>
          <Text style={earningsStyles.withdrawalReasonText}>{request.failureReason}</Text>
        </View>
      ) : null}
      <Text style={earningsStyles.withdrawalDate}>
        Requested{' '}
        {new Date(request.createdAt).toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
      </Text>
    </RiderCard>
  );
}

const earningsStyles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 34 },
  headingRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 5,
    paddingBottom: 12,
  },
  pageTitle: {
    color: riderColors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: riderFonts.extrabold,
    fontWeight: '900',
  },
  pageSubtitle: {
    color: riderColors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  periodButton: {
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CFE9DB',
    backgroundColor: riderColors.white,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...riderShadow,
  },
  periodButtonText: {
    color: riderColors.greenDark,
    fontSize: 11.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
  },
  heroCard: {
    height: 196,
    borderRadius: 13,
    backgroundColor: '#15965D',
    paddingHorizontal: 14,
    paddingTop: 14,
    overflow: 'hidden',
    ...riderShadow,
  },
  heroGlowLarge: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -70,
    top: -130,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroGlowSmall: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    left: -100,
    bottom: -125,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  heroLabel: {
    color: riderColors.white,
    fontSize: 12,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
  },
  heroAmount: {
    color: riderColors.white,
    fontSize: 27,
    lineHeight: 33,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
    marginTop: 3,
  },
  heroDate: { color: '#E0F7EA', fontSize: 10.5, fontFamily: riderFonts.medium, marginTop: 1 },
  changePill: {
    minHeight: 27,
    borderRadius: 8,
    backgroundColor: '#E6F7ED',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  changeValue: {
    color: '#087A4B',
    fontSize: 11,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
  changeCaption: { color: '#E0F7EA', fontSize: 9, fontFamily: riderFonts.regular, marginTop: 4 },
  chartWrap: { marginTop: 8 },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginTop: -3,
  },
  chartLabel: {
    width: 34,
    textAlign: 'center',
    color: '#F0FFF7',
    fontSize: 9,
    fontFamily: riderFonts.medium,
  },
  metricCard: {
    minHeight: 102,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EDF1EF',
    backgroundColor: riderColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
    paddingHorizontal: 6,
    ...riderShadow,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 3,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: riderColors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    minHeight: 26,
    color: riderColors.muted,
    fontSize: 8.5,
    lineHeight: 12,
    fontFamily: riderFonts.regular,
    textAlign: 'center',
    marginTop: 5,
  },
  metricValue: {
    color: riderColors.ink,
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
    textAlign: 'center',
  },
  metricDivider: { width: 1, height: 60, backgroundColor: riderColors.line },
  panel: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EDF1EF',
    backgroundColor: riderColors.white,
    padding: 14,
    marginTop: 11,
    ...riderShadow,
  },
  panelHeading: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: riderColors.ink,
    fontSize: 14,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  panelAction: {
    color: riderColors.greenDark,
    fontSize: 10.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
  },
  breakdownRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center' },
  breakdownDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  breakdownLabel: { flex: 1, color: '#282C2A', fontSize: 11.5, fontFamily: riderFonts.regular },
  breakdownAmount: {
    color: '#242825',
    fontSize: 11.5,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
  },
  breakdownTotal: {
    minHeight: 43,
    borderTopWidth: 1,
    borderTopColor: riderColors.line,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  breakdownTotalLabel: {
    color: riderColors.ink,
    fontSize: 13.5,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  breakdownTotalValue: {
    color: riderColors.greenDark,
    fontSize: 13.5,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  walletPanel: {
    minHeight: 185,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EDF1EF',
    backgroundColor: riderColors.white,
    padding: 14,
    marginTop: 11,
    overflow: 'hidden',
    ...riderShadow,
  },
  walletDecoration: { position: 'absolute', width: 94, height: 86, right: 6, top: 5 },
  walletTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  walletTitle: {
    color: riderColors.ink,
    fontSize: 14,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  walletBalance: {
    color: riderColors.ink,
    fontSize: 23,
    lineHeight: 29,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
    marginTop: 7,
    maxWidth: '68%',
  },
  availableLabel: {
    color: riderColors.muted,
    fontSize: 10.5,
    fontFamily: riderFonts.regular,
    marginTop: 1,
  },
  walletDivider: { height: 1, backgroundColor: riderColors.line, marginTop: 13 },
  walletActions: { flex: 1, flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  walletAction: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 3,
  },
  walletActionDivided: { borderLeftWidth: 1, borderLeftColor: riderColors.line },
  walletActionLabel: {
    color: '#232724',
    fontSize: 8.8,
    lineHeight: 12,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
    textAlign: 'center',
  },
  transactionsCard: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EDF1EF',
    backgroundColor: riderColors.white,
    marginTop: 11,
    overflow: 'hidden',
    ...riderShadow,
  },
  transactionsHeading: { paddingHorizontal: 14, paddingTop: 10 },
  transactionRow: {
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  transactionRowDivided: { borderBottomWidth: 1, borderBottomColor: '#EEF2F0' },
  transactionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: riderColors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionIconDebit: { backgroundColor: riderColors.redSoft },
  transactionTitle: {
    color: riderColors.ink,
    fontSize: 11.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
  transactionDate: {
    color: riderColors.muted,
    fontSize: 9.5,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  transactionAmount: {
    color: riderColors.greenDark,
    fontSize: 11.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
  transactionAmountDebit: { color: riderColors.ink },
  payoutSection: { marginTop: 14 },
  payoutSubtitle: {
    color: riderColors.muted,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: riderColors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorNotice: {
    minHeight: 60,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F4C3BE',
    backgroundColor: riderColors.redSoft,
    padding: 12,
    justifyContent: 'center',
    marginTop: 8,
  },
  errorTitle: {
    color: riderColors.red,
    fontSize: 11.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
  errorBody: { color: '#9F241B', fontSize: 10, fontFamily: riderFonts.regular, marginTop: 2 },
  financialError: {
    minHeight: 78,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F1C5C1',
    backgroundColor: riderColors.redSoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  financialErrorCompact: {
    borderWidth: 0,
    borderTopWidth: 1,
    borderTopColor: '#F1C5C1',
    borderRadius: 0,
    marginTop: 8,
  },
  financialErrorIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: riderColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  financialErrorTitle: {
    color: riderColors.ink,
    fontSize: 11.5,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  financialErrorBody: {
    color: '#8F3029',
    fontSize: 9.5,
    lineHeight: 14,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  emptyPayout: {
    minHeight: 64,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: riderColors.line,
    backgroundColor: riderColors.panelAlt,
    padding: 12,
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyPayoutTitle: {
    color: riderColors.ink,
    fontSize: 11.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
  emptyPayoutBody: {
    color: riderColors.muted,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  showMoreButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  withdrawalTitle: {
    color: riderColors.ink,
    fontSize: 12,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
  withdrawalDestination: {
    color: riderColors.muted,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  withdrawalMessage: {
    color: riderColors.muted,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: riderFonts.regular,
    marginTop: 7,
  },
  withdrawalReason: {
    borderRadius: 11,
    backgroundColor: riderColors.redSoft,
    padding: 9,
    marginTop: 7,
  },
  withdrawalReasonLabel: {
    color: '#9F241B',
    fontSize: 9,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  withdrawalReasonText: {
    color: riderColors.ink,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: riderFonts.regular,
    marginTop: 2,
  },
  withdrawalDate: {
    color: riderColors.soft,
    fontSize: 9,
    fontFamily: riderFonts.regular,
    marginTop: 7,
  },
  periodBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,15,10,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  periodMenu: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: riderColors.white,
    padding: 16,
    ...riderShadow,
  },
  periodMenuTitle: {
    color: riderColors.ink,
    fontSize: 16,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
    marginBottom: 10,
  },
  periodOption: {
    minHeight: 52,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
  },
  periodOptionSelected: { backgroundColor: riderColors.greenSoft },
  periodOptionText: {
    color: riderColors.ink,
    fontSize: 13,
    fontFamily: riderFonts.medium,
    fontWeight: '600',
  },
  periodOptionTextSelected: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
  idempotencyNotice: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CAE7D7',
    backgroundColor: riderColors.greenSoft,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  idempotencyNoticeText: {
    flex: 1,
    color: riderColors.greenDark,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: riderFonts.medium,
    fontWeight: '700',
  },
});
