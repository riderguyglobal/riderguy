import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import Toast from 'react-native-toast-message';
import {
  BrandHeader,
  EmptyState,
  RiderButton,
  RiderCard,
  RouteSummary,
  StatusPill,
} from '@/components/rider-ui';
import { cleanLabel, riderColors, riderFonts, riderShadow } from '@/lib/rider-design';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { RiderNavigationMenu } from '@/components/rider-navigation-menu';

type DeliveryTab = 'active' | 'scheduled' | 'history';
type DateValue = string | Date | null | undefined;
type IoniconName = keyof typeof Ionicons.glyphMap;

type OrderRecord = {
  id: string;
  riderId?: string | null;
  orderNumber?: string | null;
  status?: string | null;
  pickupAddress?: string | null;
  pickupLatitude?: number | string | null;
  pickupLongitude?: number | string | null;
  pickupContactName?: string | null;
  pickupContactPhone?: string | null;
  dropoffAddress?: string | null;
  dropoffLatitude?: number | string | null;
  dropoffLongitude?: number | string | null;
  dropoffContactName?: string | null;
  dropoffContactPhone?: string | null;
  packageType?: string | null;
  distanceKm?: number | string | null;
  estimatedDurationMinutes?: number | string | null;
  totalPrice?: number | string | null;
  riderEarnings?: number | string | null;
  currency?: string | null;
  paymentMethod?: string | null;
  isScheduled?: boolean | null;
  scheduledAt?: DateValue;
  assignedAt?: DateValue;
  deliveredAt?: DateValue;
  cancelledAt?: DateValue;
  createdAt?: DateValue;
  updatedAt?: DateValue;
  client?: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  } | null;
};

type RiderProfile = {
  availability?: string | null;
  completionRate?: number | string | null;
  cancellationCount?: number | null;
};

const ACTIVE_STATUSES = new Set([
  'ASSIGNED',
  'PICKUP_EN_ROUTE',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DROPOFF',
]);
const TERMINAL_STATUSES = new Set([
  'DELIVERED',
  'FAILED',
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_RIDER',
  'CANCELLED_BY_ADMIN',
]);
const CANCELLED_STATUSES = new Set([
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_RIDER',
  'CANCELLED_BY_ADMIN',
]);
const PICKUP_STATUSES = new Set(['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP']);
const ACTIVE_STATUS_PRIORITY: Record<string, number> = {
  AT_DROPOFF: 6,
  IN_TRANSIT: 5,
  PICKED_UP: 4,
  AT_PICKUP: 3,
  PICKUP_EN_ROUTE: 2,
  ASSIGNED: 1,
};

const TABS: { value: DeliveryTab; label: string; icon: IoniconName }[] = [
  { value: 'active', label: 'Active', icon: 'bicycle-outline' },
  { value: 'scheduled', label: 'Scheduled', icon: 'calendar-outline' },
  { value: 'history', label: 'History', icon: 'time-outline' },
];

function normalizedStatus(order: OrderRecord) {
  return String(order.status ?? 'PENDING').toUpperCase();
}

function parsedTime(value: DateValue) {
  if (!value) return Number.NaN;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : Number.NaN;
}

function formatTime(value: DateValue) {
  const time = parsedTime(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: DateValue) {
  const time = parsedTime(value);
  if (!Number.isFinite(time)) return 'Date unavailable';
  return new Date(time).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: DateValue) {
  const date = formatDate(value);
  const time = formatTime(value);
  return time ? `${date} · ${time}` : date;
}

function isToday(value: DateValue) {
  const time = parsedTime(value);
  if (!Number.isFinite(time)) return false;
  const date = new Date(time);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isFutureScheduled(order: OrderRecord) {
  const time = parsedTime(order.scheduledAt);
  return order.isScheduled === true && Number.isFinite(time) && time > Date.now();
}

function nullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentageFromRatio(value: number | string | null | undefined) {
  const number = nullableNumber(value);
  if (number === null) return null;
  return Math.max(0, Math.min(100, number <= 1 ? number * 100 : number));
}

function orderAmount(order: OrderRecord) {
  // totalPrice is the Client charge, not Rider pay. Never present it as Rider earnings.
  const amount = nullableNumber(order.riderEarnings);
  if (amount === null) return 'Amount pending';
  return formatCurrency(amount, order.currency ?? 'GHS');
}

function orderTimestamp(order: OrderRecord) {
  if (normalizedStatus(order) === 'DELIVERED') {
    return order.deliveredAt ?? order.updatedAt ?? order.createdAt;
  }
  if (CANCELLED_STATUSES.has(normalizedStatus(order))) {
    return order.cancelledAt ?? order.updatedAt ?? order.createdAt;
  }
  return order.scheduledAt ?? order.assignedAt ?? order.createdAt;
}

function getErrorMessage(error: unknown, fallback: string) {
  const responseError = error as {
    response?: { data?: { error?: { message?: string }; message?: string } };
    message?: string;
  };
  return (
    responseError?.response?.data?.error?.message ??
    responseError?.response?.data?.message ??
    responseError?.message ??
    fallback
  );
}

function validCoordinate(
  value: number | string | null | undefined,
  minimum: number,
  maximum: number,
) {
  const coordinate = nullableNumber(value);
  return coordinate !== null && coordinate >= minimum && coordinate <= maximum ? coordinate : null;
}

function customerName(order: OrderRecord) {
  const recipient = order.dropoffContactName?.trim();
  if (recipient) return recipient;
  const clientName = [order.client?.firstName, order.client?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return clientName || 'Customer details pending';
}

function customerPhone(order: OrderRecord) {
  return (
    order.dropoffContactPhone?.trim() ||
    order.client?.phone?.trim() ||
    order.pickupContactPhone?.trim() ||
    ''
  );
}

function DeliveryTabs({
  value,
  onChange,
}: {
  value: DeliveryTab;
  onChange: (next: DeliveryTab) => void;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {TABS.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            activeOpacity={0.82}
            onPress={() => onChange(option.value)}
            style={styles.tab}
          >
            <View style={styles.tabLabelRow}>
              <Ionicons
                name={option.icon}
                size={20}
                color={selected ? riderColors.greenDark : riderColors.muted}
              />
              <Text style={[styles.tabText, selected ? styles.tabTextSelected : null]}>
                {option.label}
              </Text>
            </View>
            {selected ? <View style={styles.tabIndicator} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SectionHeading({
  title,
  count,
  actionLabel,
  onAction,
}: {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {typeof count === 'number' ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.82}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function RouteTimeline({
  order,
  pickupTime,
  dropoffTime,
}: {
  order: OrderRecord;
  pickupTime?: string | null;
  dropoffTime?: string | null;
}) {
  return (
    <View style={styles.timeline}>
      <View style={styles.timelineLine} />
      <View style={styles.timelineRow}>
        <View style={styles.timelineMarker}>
          <View style={styles.pickupDot} />
        </View>
        <View style={styles.timelineCopy}>
          <View style={styles.timelineLabelRow}>
            <Text style={styles.timelineLabel}>Pickup</Text>
            {pickupTime ? <Text style={styles.timelineTime}>{pickupTime}</Text> : null}
          </View>
          <Text style={styles.timelineAddress} numberOfLines={2}>
            {order.pickupAddress?.trim() || 'Pickup address unavailable'}
          </Text>
        </View>
      </View>
      <View style={styles.timelineRow}>
        <View style={styles.timelineMarker}>
          <Ionicons name="location" size={24} color={riderColors.greenDark} />
        </View>
        <View style={styles.timelineCopy}>
          <View style={styles.timelineLabelRow}>
            <Text style={styles.timelineLabel}>Drop-off</Text>
            {dropoffTime ? <Text style={styles.timelineTime}>{dropoffTime}</Text> : null}
          </View>
          <Text style={styles.timelineAddress} numberOfLines={2}>
            {order.dropoffAddress?.trim() || 'Drop-off address unavailable'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
  divider,
}: {
  icon: IoniconName;
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.summaryMetric, divider ? styles.summaryMetricDivider : null]}>
      <View style={styles.summaryMetricIcon}>
        <Ionicons name={icon} size={19} color={riderColors.greenDark} />
      </View>
      <View style={styles.summaryMetricCopy}>
        <Text style={styles.summaryMetricLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.summaryMetricValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function DeliveryAction({
  icon,
  label,
  onPress,
  primary,
  disabled,
}: {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      activeOpacity={0.84}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.deliveryAction,
        primary ? styles.deliveryActionPrimary : null,
        disabled ? styles.deliveryActionDisabled : null,
      ]}
    >
      <Ionicons name={icon} size={19} color={primary ? riderColors.white : riderColors.greenDark} />
      <Text style={[styles.deliveryActionText, primary ? styles.deliveryActionTextPrimary : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CurrentDeliveryCard({
  order,
  onOpen,
  onCall,
  onChat,
  onNavigate,
}: {
  order: OrderRecord;
  onOpen: () => void;
  onCall: () => void;
  onChat: () => void;
  onNavigate: () => void;
}) {
  const duration = nullableNumber(order.estimatedDurationMinutes);
  const scheduledTime = parsedTime(order.scheduledAt);
  const pickupTime = formatTime(order.scheduledAt);
  const dropoffTime =
    Number.isFinite(scheduledTime) && duration !== null
      ? formatTime(new Date(scheduledTime + duration * 60_000))
      : null;
  const phoneAvailable = customerPhone(order).length > 0;
  const navigationAvailable = Boolean(
    order.pickupAddress?.trim() ||
    order.dropoffAddress?.trim() ||
    (validCoordinate(order.pickupLatitude, -90, 90) !== null &&
      validCoordinate(order.pickupLongitude, -180, 180) !== null) ||
    (validCoordinate(order.dropoffLatitude, -90, 90) !== null &&
      validCoordinate(order.dropoffLongitude, -180, 180) !== null),
  );

  return (
    <RiderCard style={styles.currentCard}>
      <View style={styles.currentCardHeading}>
        <Text style={styles.currentCardTitle}>Current Delivery</Text>
        <StatusPill status={order.status} />
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Open delivery ${order.orderNumber ?? ''}`.trim()}
        activeOpacity={0.82}
        onPress={onOpen}
      >
        <View style={styles.orderSummaryRow}>
          <View style={styles.orderSummaryGroup}>
            <View style={styles.roundIcon}>
              <Ionicons name="cube-outline" size={22} color={riderColors.greenDark} />
            </View>
            <View>
              <Text style={styles.orderSummaryLabel}>Order ID</Text>
              <Text style={styles.orderSummaryValue} numberOfLines={1}>
                {order.orderNumber || 'Order number pending'}
              </Text>
            </View>
          </View>
          <View style={styles.paymentSummary}>
            <Text style={styles.orderSummaryLabel}>Payment</Text>
            <Text style={styles.paymentValue} numberOfLines={1}>
              {order.paymentMethod ? cleanLabel(order.paymentMethod) : 'Not provided'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={riderColors.soft} />
        </View>

        <View style={styles.divider} />
        <RouteTimeline order={order} pickupTime={pickupTime} dropoffTime={dropoffTime} />
      </TouchableOpacity>

      <View style={styles.divider} />
      <View style={styles.summaryMetrics}>
        <SummaryMetric icon="person-outline" label="Customer" value={customerName(order)} />
        <SummaryMetric icon="wallet-outline" label="Earnings" value={orderAmount(order)} divider />
        <SummaryMetric
          icon="time-outline"
          label="ETA"
          value={duration !== null ? `${Math.round(duration)} min` : 'Pending'}
          divider
        />
      </View>

      <View style={styles.deliveryActions}>
        <DeliveryAction
          icon="call-outline"
          label="Call"
          onPress={onCall}
          disabled={!phoneAvailable}
        />
        <DeliveryAction icon="chatbubble-ellipses-outline" label="Chat" onPress={onChat} />
        <DeliveryAction
          icon="navigate-outline"
          label="Navigate"
          onPress={onNavigate}
          primary
          disabled={!navigationAvailable}
        />
      </View>
    </RiderCard>
  );
}

function QueueCard({
  order,
  index,
  scheduled,
  onPress,
}: {
  order: OrderRecord;
  index: number;
  scheduled?: boolean;
  onPress: () => void;
}) {
  const timing = scheduled
    ? formatDateTime(order.scheduledAt)
    : cleanLabel(normalizedStatus(order));

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Open delivery ${order.orderNumber ?? ''}`.trim()}
      activeOpacity={0.86}
      onPress={onPress}
    >
      <RiderCard style={styles.queueCard}>
        <View style={styles.queueIndex}>
          <Text style={styles.queueIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.queueIdentity}>
          <Text style={styles.queueEyebrow}>Order ID</Text>
          <Text style={styles.queueOrderNumber} numberOfLines={1}>
            {order.orderNumber || 'Pending'}
          </Text>
        </View>
        <View style={styles.queueDivider} />
        <View style={styles.queueRoute}>
          <View style={styles.compactRouteRow}>
            <Ionicons name="ellipse-outline" size={16} color={riderColors.greenDark} />
            <Text style={styles.compactRouteText} numberOfLines={1}>
              {order.pickupAddress || 'Pickup unavailable'}
            </Text>
          </View>
          <View style={styles.compactRouteLine} />
          <View style={styles.compactRouteRow}>
            <Ionicons name="location" size={17} color={riderColors.greenDark} />
            <Text style={styles.compactRouteText} numberOfLines={1}>
              {order.dropoffAddress || 'Drop-off unavailable'}
            </Text>
          </View>
        </View>
        <View style={styles.queueMeta}>
          <StatusPill
            status={scheduled ? 'PENDING' : order.status}
            label={scheduled ? 'Scheduled' : undefined}
          />
          <Text style={styles.queueTime} numberOfLines={1}>
            {timing}
          </Text>
          <Text style={styles.queueAmount} numberOfLines={1}>
            {orderAmount(order)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={riderColors.soft} />
      </RiderCard>
    </TouchableOpacity>
  );
}

function AvailableRequestCard({
  order,
  claiming,
  onClaim,
}: {
  order: OrderRecord;
  claiming: boolean;
  onClaim: () => void;
}) {
  const distance = nullableNumber(order.distanceKm);
  const duration = nullableNumber(order.estimatedDurationMinutes);

  return (
    <RiderCard style={styles.requestCard}>
      <View style={styles.requestHeading}>
        <View style={styles.requestTitleGroup}>
          <View style={styles.roundIconSmall}>
            <Ionicons name="cube-outline" size={19} color={riderColors.greenDark} />
          </View>
          <View style={styles.requestTitleCopy}>
            <Text style={styles.requestEyebrow}>{cleanLabel(order.packageType)}</Text>
            <Text style={styles.requestOrderNumber} numberOfLines={1}>
              {order.orderNumber || 'Delivery request'}
            </Text>
          </View>
        </View>
        <Text style={styles.requestAmount} numberOfLines={1}>
          {orderAmount(order)}
        </Text>
      </View>

      <RouteSummary pickup={order.pickupAddress} dropoff={order.dropoffAddress} compact />

      <View style={styles.requestFooter}>
        <View style={styles.requestFacts}>
          <View style={styles.requestFact}>
            <Ionicons name="navigate-outline" size={15} color={riderColors.muted} />
            <Text style={styles.requestFactText}>
              {distance !== null ? `${distance.toFixed(1)} km` : 'Distance pending'}
            </Text>
          </View>
          <View style={styles.requestFact}>
            <Ionicons name="time-outline" size={15} color={riderColors.muted} />
            <Text style={styles.requestFactText}>
              {duration !== null ? `${Math.round(duration)} min` : 'ETA pending'}
            </Text>
          </View>
        </View>
        <RiderButton
          label={claiming ? 'Claiming' : 'Claim'}
          icon="flash"
          loading={claiming}
          disabled={claiming}
          onPress={onClaim}
          style={styles.claimButton}
        />
      </View>
    </RiderCard>
  );
}

function HistoryCard({ order, onPress }: { order: OrderRecord; onPress: () => void }) {
  const delivered = normalizedStatus(order) === 'DELIVERED';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Open delivery ${order.orderNumber ?? ''}`.trim()}
      activeOpacity={0.86}
      onPress={onPress}
    >
      <RiderCard style={styles.historyCard}>
        <View
          style={[
            styles.historyIcon,
            { backgroundColor: delivered ? riderColors.greenSoft : riderColors.redSoft },
          ]}
        >
          <Ionicons
            name={delivered ? 'checkmark' : 'close'}
            size={20}
            color={delivered ? riderColors.greenDark : riderColors.red}
          />
        </View>
        <View style={styles.historyCopy}>
          <View style={styles.historyHeading}>
            <Text style={styles.historyOrder} numberOfLines={1}>
              {order.orderNumber || 'Delivery'}
            </Text>
            <Text style={styles.historyAmount} numberOfLines={1}>
              {orderAmount(order)}
            </Text>
          </View>
          <Text style={styles.historyRoute} numberOfLines={1}>
            {order.pickupAddress || 'Pickup unavailable'} →{' '}
            {order.dropoffAddress || 'Drop-off unavailable'}
          </Text>
          <View style={styles.historyFooter}>
            <Text style={styles.historyDate}>{formatDateTime(orderTimestamp(order))}</Text>
            <StatusPill status={order.status} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={riderColors.soft} />
      </RiderCard>
    </TouchableOpacity>
  );
}

function StatItem({
  icon,
  label,
  value,
  tone = 'green',
  divider,
}: {
  icon: IoniconName;
  label: string;
  value: string;
  tone?: 'green' | 'red';
  divider?: boolean;
}) {
  const isRed = tone === 'red';
  return (
    <View style={[styles.statItem, divider ? styles.statDivider : null]}>
      <View
        style={[
          styles.statIcon,
          { backgroundColor: isRed ? riderColors.redSoft : riderColors.greenSoft },
        ]}
      >
        <Ionicons name={icon} size={18} color={isRed ? riderColors.red : riderColors.greenDark} />
      </View>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function InlineNotice({
  icon,
  title,
  body,
  tone = 'neutral',
  onRetry,
}: {
  icon: IoniconName;
  title: string;
  body: string;
  tone?: 'neutral' | 'error';
  onRetry?: () => void;
}) {
  const error = tone === 'error';
  return (
    <View style={[styles.notice, error ? styles.noticeError : null]}>
      <View style={[styles.noticeIcon, error ? styles.noticeIconError : null]}>
        <Ionicons name={icon} size={19} color={error ? riderColors.red : riderColors.greenDark} />
      </View>
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.noticeBody}>{body}</Text>
      </View>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} activeOpacity={0.82} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <RiderCard style={styles.loadingCard}>
      <ActivityIndicator color={riderColors.greenDark} />
      <Text style={styles.loadingText}>{label}</Text>
    </RiderCard>
  );
}

function EmptyCard({
  icon,
  title,
  body,
  action,
}: {
  icon: IoniconName;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <RiderCard style={styles.emptyCard}>
      <EmptyState icon={icon} title={title} body={body} action={action} />
    </RiderCard>
  );
}

export default function JobsScreen() {
  const [tab, setTab] = useState<DeliveryTab>('active');
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { api } = useAuth();
  const qc = useQueryClient();
  const { unreadCount } = useUnreadNotifications();
  const isFocused = useIsFocused();

  const profileQuery = useQuery<RiderProfile | null>({
    queryKey: ['rider-profile'],
    queryFn: async () => {
      const { data } = await api.get('/riders/profile');
      return (data.data ?? data) as RiderProfile | null;
    },
    enabled: isFocused,
    staleTime: 30_000,
  });

  const canReceiveRequests =
    String(profileQuery.data?.availability ?? '').toUpperCase() === 'ONLINE';

  const availableQuery = useQuery<OrderRecord[]>({
    queryKey: ['jobs-available'],
    queryFn: async () => {
      const { data } = await api.get('/orders/available');
      const payload = data.data ?? data;
      return Array.isArray(payload) ? (payload as OrderRecord[]) : [];
    },
    enabled: isFocused && tab === 'active' && canReceiveRequests,
    refetchInterval: isFocused && tab === 'active' && canReceiveRequests ? 10_000 : false,
    retry: false,
  });

  const ordersQuery = useQuery<OrderRecord[]>({
    queryKey: ['jobs-active'],
    queryFn: async () => {
      const { data } = await api.get('/orders?scope=rider&limit=100');
      const payload = data.data ?? data;
      return Array.isArray(payload) ? (payload as OrderRecord[]) : [];
    },
    enabled: isFocused,
    refetchInterval: isFocused && tab === 'active' ? 30_000 : false,
  });

  const allOrders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const activeSummaries = useMemo(
    () =>
      allOrders
        .filter((order) => ACTIVE_STATUSES.has(normalizedStatus(order)))
        .sort((left, right) => {
          const priority =
            (ACTIVE_STATUS_PRIORITY[normalizedStatus(right)] ?? 0) -
            (ACTIVE_STATUS_PRIORITY[normalizedStatus(left)] ?? 0);
          if (priority !== 0) return priority;
          return parsedTime(left.assignedAt) - parsedTime(right.assignedAt);
        }),
    [allOrders],
  );
  const currentSummary = activeSummaries[0] ?? null;

  // The list endpoint carries every field needed by queue/history cards. Poll only the
  // current order's full detail so contact and navigation actions stay live without an
  // N-request batch on every refresh interval.
  const currentDetailQuery = useQuery<OrderRecord | null>({
    queryKey: ['order', currentSummary?.id],
    queryFn: async () => {
      if (!currentSummary) return null;
      const { data } = await api.get(`/orders/${currentSummary.id}`);
      const payload = data.data ?? data;
      return payload && typeof payload === 'object' ? (payload as OrderRecord) : null;
    },
    enabled: isFocused && Boolean(currentSummary),
    refetchInterval: isFocused && tab === 'active' && currentSummary ? 10_000 : false,
    retry: false,
  });

  const hydratedOrders = useMemo(() => {
    const currentDetail = currentDetailQuery.data;
    return allOrders.map((order) =>
      currentDetail?.id === order.id ? { ...order, ...currentDetail } : order,
    );
  }, [allOrders, currentDetailQuery.data]);

  const activeOrders = useMemo(
    () =>
      hydratedOrders
        .filter(
          (order) => !TERMINAL_STATUSES.has(normalizedStatus(order)) && !isFutureScheduled(order),
        )
        .sort((left, right) => {
          const priority =
            (ACTIVE_STATUS_PRIORITY[normalizedStatus(right)] ?? 0) -
            (ACTIVE_STATUS_PRIORITY[normalizedStatus(left)] ?? 0);
          if (priority !== 0) return priority;
          return parsedTime(left.assignedAt) - parsedTime(right.assignedAt);
        }),
    [hydratedOrders],
  );

  const scheduledOrders = useMemo(
    () =>
      hydratedOrders
        .filter(isFutureScheduled)
        .sort((left, right) => parsedTime(left.scheduledAt) - parsedTime(right.scheduledAt)),
    [hydratedOrders],
  );

  const historyOrders = useMemo(
    () =>
      hydratedOrders
        .filter((order) => TERMINAL_STATUSES.has(normalizedStatus(order)))
        .sort(
          (left, right) => parsedTime(orderTimestamp(right)) - parsedTime(orderTimestamp(left)),
        ),
    [hydratedOrders],
  );

  const currentOrder = activeOrders[0] ?? null;
  const queuedOrders = useMemo(
    () => [...activeOrders.slice(1), ...scheduledOrders],
    [activeOrders, scheduledOrders],
  );
  const availableOrders = availableQuery.data ?? [];

  const acceptJob = useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.post(`/orders/${orderId}/accept`);
      return (data.data ?? data) as OrderRecord;
    },
    onSuccess: async (order) => {
      Toast.show({ type: 'success', text1: 'Job accepted.' });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['jobs-available'] }),
        qc.invalidateQueries({ queryKey: ['jobs-active'] }),
        qc.invalidateQueries({ queryKey: ['rider-jobs-live-details'] }),
        qc.invalidateQueries({ queryKey: ['rider-jobs-recent'] }),
      ]);
      router.push(`/(app)/jobs/${order.id}` as never);
    },
    onError: (error: unknown) =>
      Toast.show({
        type: 'error',
        text1: getErrorMessage(error, 'Could not accept job.'),
      }),
  });

  const openOrder = (order: OrderRecord) => {
    router.push(`/(app)/jobs/${order.id}` as never);
  };

  const confirmAccept = (order: OrderRecord) => {
    if (acceptJob.isPending) return;
    Alert.alert(
      'Accept delivery?',
      `${order.pickupAddress || 'Pickup location pending'}\n${orderAmount(order)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => acceptJob.mutate(order.id) },
      ],
    );
  };

  const callCustomer = async (order: OrderRecord) => {
    const phone = customerPhone(order).replace(/[^\d+]/g, '');
    if (!phone) {
      Toast.show({ type: 'info', text1: 'Customer phone is not available.' });
      return;
    }
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open the phone app.' });
    }
  };

  const openChat = (order: OrderRecord) => {
    router.push({
      pathname: '/(app)/chat/[orderId]' as never,
      params: { orderId: order.id },
    });
  };

  const navigateToOrder = async (order: OrderRecord) => {
    const pickupTarget = PICKUP_STATUSES.has(normalizedStatus(order));
    const latitude = validCoordinate(
      pickupTarget ? order.pickupLatitude : order.dropoffLatitude,
      -90,
      90,
    );
    const longitude = validCoordinate(
      pickupTarget ? order.pickupLongitude : order.dropoffLongitude,
      -180,
      180,
    );
    const address = pickupTarget ? order.pickupAddress : order.dropoffAddress;

    if (latitude === null || longitude === null) {
      if (!address?.trim()) {
        Toast.show({ type: 'info', text1: 'Navigation details are not available yet.' });
        return;
      }
      try {
        await Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
        );
      } catch {
        Toast.show({ type: 'error', text1: 'Could not open navigation.' });
      }
      return;
    }

    const appUrl = Platform.select({
      ios: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`,
      android: `google.navigation:q=${latitude},${longitude}`,
    });
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

    try {
      const canOpen = appUrl ? await Linking.canOpenURL(appUrl) : false;
      await Linking.openURL(canOpen && appUrl ? appUrl : fallback);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open navigation.' });
    }
  };

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const refreshes: Promise<unknown>[] = [ordersQuery.refetch(), profileQuery.refetch()];
    if (tab === 'active' && canReceiveRequests) refreshes.push(availableQuery.refetch());
    if (currentSummary) refreshes.push(currentDetailQuery.refetch());
    await Promise.allSettled(refreshes);
    setRefreshing(false);
  };

  const deliveryDataLoading =
    ordersQuery.isLoading || (Boolean(currentSummary) && currentDetailQuery.isLoading);
  const currentDetailUnavailable = Boolean(currentSummary) && currentDetailQuery.isError;
  const profile = profileQuery.data;
  const todayTrips = hydratedOrders.filter((order) =>
    isToday(order.assignedAt ?? order.createdAt),
  ).length;
  const completedToday = hydratedOrders.filter(
    (order) => normalizedStatus(order) === 'DELIVERED' && isToday(order.deliveredAt),
  ).length;
  const cancellationCount = nullableNumber(profile?.cancellationCount);
  const completionRate = percentageFromRatio(profile?.completionRate);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <BrandHeader
        onMenu={() => setMenuOpen(true)}
        onNotifications={() => router.push('/(app)/notifications' as never)}
        unread={unreadCount > 0}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={riderColors.greenDark}
            colors={[riderColors.greenDark]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.pageHeading}>
          <Text style={styles.pageTitle}>Deliveries</Text>
          <Text style={styles.pageSubtitle}>Manage your jobs, routes, and requests.</Text>
        </View>

        <DeliveryTabs value={tab} onChange={setTab} />

        {currentDetailUnavailable ? (
          <InlineNotice
            icon="information-circle-outline"
            title="Current delivery details are still syncing"
            body="The route remains available, but contact or navigation details may be limited until refresh completes."
            onRetry={() => void currentDetailQuery.refetch()}
          />
        ) : null}

        {tab === 'active' ? (
          <View style={styles.tabContent}>
            {deliveryDataLoading ? (
              <LoadingCard label="Loading your active deliveries…" />
            ) : ordersQuery.isError && allOrders.length === 0 ? (
              <EmptyCard
                icon="cloud-offline-outline"
                title="Active deliveries unavailable"
                body={getErrorMessage(
                  ordersQuery.error,
                  'We could not load your deliveries. Check your connection and retry.',
                )}
                action={
                  <RiderButton
                    label="Retry"
                    variant="light"
                    onPress={() => void ordersQuery.refetch()}
                  />
                }
              />
            ) : currentOrder ? (
              <CurrentDeliveryCard
                order={currentOrder}
                onOpen={() => openOrder(currentOrder)}
                onCall={() => void callCustomer(currentOrder)}
                onChat={() => openChat(currentOrder)}
                onNavigate={() => void navigateToOrder(currentOrder)}
              />
            ) : (
              <EmptyCard
                icon="bicycle-outline"
                title="No delivery in progress"
                body="When you claim a request, its route and delivery actions will appear here."
              />
            )}

            <View style={styles.sectionBlock}>
              <SectionHeading
                title="Upcoming Deliveries"
                count={queuedOrders.length}
                actionLabel={scheduledOrders.length > 0 ? 'View all' : undefined}
                onAction={scheduledOrders.length > 0 ? () => setTab('scheduled') : undefined}
              />
              {queuedOrders.length > 0 ? (
                <View style={styles.cardStack}>
                  {queuedOrders.map((order, index) => (
                    <QueueCard
                      key={order.id}
                      order={order}
                      index={index}
                      scheduled={isFutureScheduled(order)}
                      onPress={() => openOrder(order)}
                    />
                  ))}
                </View>
              ) : (
                <InlineNotice
                  icon="calendar-outline"
                  title="One delivery at a time"
                  body="RiderGuy assigns one active delivery at a time. Scheduled client orders become claimable requests when released."
                />
              )}
            </View>

            <RiderCard style={styles.statsCard}>
              <View style={styles.statsRow}>
                <StatItem
                  icon="briefcase-outline"
                  label="Today’s trips"
                  value={String(todayTrips)}
                />
                <StatItem
                  icon="checkmark"
                  label="Completed"
                  value={String(completedToday)}
                  divider
                />
                <StatItem
                  icon="close"
                  label="Cancellations"
                  value={cancellationCount !== null ? String(cancellationCount) : '—'}
                  tone="red"
                  divider
                />
                <StatItem
                  icon="shield-checkmark-outline"
                  label="Completion rate"
                  value={completionRate !== null ? `${Math.round(completionRate)}%` : '—'}
                  divider
                />
              </View>
            </RiderCard>

            <View style={styles.sectionBlock}>
              <SectionHeading title="Available Requests" count={availableOrders.length} />
              {profileQuery.isLoading ? (
                <LoadingCard label="Checking your availability…" />
              ) : profileQuery.isError ? (
                <InlineNotice
                  icon="cloud-offline-outline"
                  title="Availability unavailable"
                  body="We could not confirm whether you can receive requests. Tap to retry."
                  tone="error"
                  onRetry={() => void profileQuery.refetch()}
                />
              ) : !canReceiveRequests ? (
                <InlineNotice
                  icon="radio-outline"
                  title="Go online to receive requests"
                  body="Use the Home screen to go online, then return here to claim nearby work."
                />
              ) : availableQuery.isLoading ? (
                <LoadingCard label="Checking for nearby delivery requests…" />
              ) : availableQuery.isError ? (
                <InlineNotice
                  icon="cloud-offline-outline"
                  title="Request feed unavailable"
                  body={getErrorMessage(
                    availableQuery.error,
                    'We could not refresh nearby requests. Please try again.',
                  )}
                  tone="error"
                  onRetry={() => void availableQuery.refetch()}
                />
              ) : availableOrders.length > 0 ? (
                <View style={styles.cardStack}>
                  {availableOrders.map((order) => (
                    <AvailableRequestCard
                      key={order.id}
                      order={order}
                      claiming={acceptJob.isPending && acceptJob.variables === order.id}
                      onClaim={() => confirmAccept(order)}
                    />
                  ))}
                </View>
              ) : (
                <InlineNotice
                  icon="radio-outline"
                  title="No nearby requests right now"
                  body={'You’re online. New requests will appear here automatically.'}
                  onRetry={() => void availableQuery.refetch()}
                />
              )}
            </View>
          </View>
        ) : null}

        {tab === 'scheduled' ? (
          <View style={styles.tabContent}>
            <SectionHeading title="Scheduled Deliveries" count={scheduledOrders.length} />
            {deliveryDataLoading ? (
              <LoadingCard label="Loading scheduled deliveries…" />
            ) : ordersQuery.isError && allOrders.length === 0 ? (
              <EmptyCard
                icon="cloud-offline-outline"
                title="Scheduled deliveries unavailable"
                body={getErrorMessage(
                  ordersQuery.error,
                  'We could not load scheduled deliveries. Please retry.',
                )}
                action={
                  <RiderButton
                    label="Retry"
                    variant="light"
                    onPress={() => void ordersQuery.refetch()}
                  />
                }
              />
            ) : scheduledOrders.length > 0 ? (
              <View style={styles.cardStack}>
                {scheduledOrders.map((order, index) => (
                  <QueueCard
                    key={order.id}
                    order={order}
                    index={index}
                    scheduled
                    onPress={() => openOrder(order)}
                  />
                ))}
              </View>
            ) : (
              <EmptyCard
                icon="calendar-outline"
                title="No scheduled deliveries"
                body="Rider reservations are not currently assigned in advance. Scheduled client orders appear as claimable requests when their release time arrives."
              />
            )}
          </View>
        ) : null}

        {tab === 'history' ? (
          <View style={styles.tabContent}>
            <SectionHeading title="Delivery History" count={historyOrders.length} />
            {ordersQuery.isLoading ? (
              <LoadingCard label="Loading delivery history…" />
            ) : ordersQuery.isError && allOrders.length === 0 ? (
              <EmptyCard
                icon="cloud-offline-outline"
                title="Delivery history unavailable"
                body={getErrorMessage(
                  ordersQuery.error,
                  'We could not load your delivery history. Please retry.',
                )}
                action={
                  <RiderButton
                    label="Retry"
                    variant="light"
                    onPress={() => void ordersQuery.refetch()}
                  />
                }
              />
            ) : historyOrders.length > 0 ? (
              <View style={styles.cardStack}>
                {historyOrders.map((order) => (
                  <HistoryCard key={order.id} order={order} onPress={() => openOrder(order)} />
                ))}
              </View>
            ) : (
              <EmptyCard
                icon="time-outline"
                title="No delivery history yet"
                body="Completed, cancelled, or failed deliveries will be recorded here."
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      <RiderNavigationMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: riderColors.white,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 34,
  },
  pageHeading: {
    marginBottom: 18,
  },
  pageTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.bold,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  pageSubtitle: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 3,
  },
  tabs: {
    minHeight: 62,
    flexDirection: 'row',
    backgroundColor: riderColors.white,
    borderWidth: 1,
    borderColor: riderColors.line,
    borderRadius: 16,
    marginBottom: 18,
    overflow: 'hidden',
    ...riderShadow,
  },
  tab: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tabText: {
    color: riderColors.muted,
    fontFamily: riderFonts.medium,
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextSelected: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontWeight: '900',
  },
  tabIndicator: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: riderColors.greenDark,
  },
  tabContent: {
    gap: 18,
  },
  currentCard: {
    padding: 16,
  },
  currentCardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  currentCardTitle: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.bold,
    fontSize: 18,
    fontWeight: '900',
  },
  orderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderSummaryGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  roundIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: riderColors.greenSoft,
  },
  orderSummaryLabel: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 11,
  },
  orderSummaryValue: {
    maxWidth: 130,
    color: riderColors.ink,
    fontFamily: riderFonts.bold,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  paymentSummary: {
    maxWidth: '36%',
    alignItems: 'flex-end',
  },
  paymentValue: {
    color: riderColors.ink,
    fontFamily: riderFonts.semibold,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: riderColors.line,
    marginVertical: 15,
  },
  timeline: {
    position: 'relative',
    gap: 14,
  },
  timelineLine: {
    position: 'absolute',
    top: 17,
    bottom: 18,
    left: 11,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderLeftColor: riderColors.green,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  timelineMarker: {
    width: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: riderColors.white,
  },
  pickupDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: riderColors.greenDark,
    backgroundColor: riderColors.white,
  },
  timelineCopy: {
    flex: 1,
  },
  timelineLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timelineLabel: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontSize: 12,
    fontWeight: '900',
  },
  timelineTime: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontSize: 11,
    fontWeight: '900',
  },
  timelineAddress: {
    color: riderColors.ink,
    fontFamily: riderFonts.semibold,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 3,
  },
  summaryMetrics: {
    flexDirection: 'row',
  },
  summaryMetric: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 6,
  },
  summaryMetricDivider: {
    borderLeftWidth: 1,
    borderLeftColor: riderColors.line,
  },
  summaryMetricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: riderColors.greenSoft,
  },
  summaryMetricCopy: {
    flex: 1,
    minWidth: 0,
  },
  summaryMetricLabel: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 9,
  },
  summaryMetricValue: {
    color: riderColors.ink,
    fontFamily: riderFonts.semibold,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 2,
  },
  deliveryActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  deliveryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: riderColors.line,
    backgroundColor: riderColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deliveryActionPrimary: {
    backgroundColor: riderColors.greenDark,
    borderColor: riderColors.greenDark,
  },
  deliveryActionDisabled: {
    opacity: 0.42,
  },
  deliveryActionText: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontSize: 11,
    fontWeight: '900',
  },
  deliveryActionTextPrimary: {
    color: riderColors.white,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeading: {
    minHeight: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.bold,
    fontSize: 17,
    fontWeight: '900',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: riderColors.greenSoft,
  },
  countText: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontSize: 10,
    fontWeight: '900',
  },
  sectionAction: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontSize: 12,
    fontWeight: '900',
  },
  cardStack: {
    gap: 10,
  },
  queueCard: {
    minHeight: 104,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  queueIndex: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: riderColors.greenSoft,
  },
  queueIndexText: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.bold,
    fontSize: 18,
    fontWeight: '900',
  },
  queueIdentity: {
    width: 68,
  },
  queueEyebrow: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 9,
  },
  queueOrderNumber: {
    color: riderColors.ink,
    fontFamily: riderFonts.semibold,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
  },
  queueDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: riderColors.line,
  },
  queueRoute: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    position: 'relative',
  },
  compactRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactRouteLine: {
    position: 'absolute',
    left: 7,
    top: 14,
    bottom: 14,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderLeftColor: riderColors.green,
  },
  compactRouteText: {
    flex: 1,
    color: riderColors.ink,
    fontFamily: riderFonts.medium,
    fontSize: 10,
    fontWeight: '700',
  },
  queueMeta: {
    width: 88,
    alignItems: 'flex-end',
    gap: 3,
  },
  queueTime: {
    maxWidth: 88,
    color: riderColors.greenDark,
    fontFamily: riderFonts.medium,
    fontSize: 9,
    fontWeight: '800',
  },
  queueAmount: {
    maxWidth: 88,
    color: riderColors.ink,
    fontFamily: riderFonts.semibold,
    fontSize: 10,
    fontWeight: '900',
  },
  requestCard: {
    padding: 15,
  },
  requestHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 13,
  },
  requestTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  roundIconSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: riderColors.greenSoft,
  },
  requestTitleCopy: {
    flex: 1,
  },
  requestEyebrow: {
    color: riderColors.muted,
    fontFamily: riderFonts.medium,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  requestOrderNumber: {
    color: riderColors.ink,
    fontFamily: riderFonts.semibold,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  requestAmount: {
    maxWidth: '42%',
    color: riderColors.greenDark,
    fontFamily: riderFonts.bold,
    fontSize: 17,
    fontWeight: '900',
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
  },
  requestFacts: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  requestFact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestFactText: {
    color: riderColors.muted,
    fontFamily: riderFonts.medium,
    fontSize: 10,
    fontWeight: '700',
  },
  claimButton: {
    minHeight: 40,
    minWidth: 104,
    borderRadius: 13,
    paddingHorizontal: 13,
  },
  historyCard: {
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  historyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  historyHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyOrder: {
    flex: 1,
    color: riderColors.ink,
    fontFamily: riderFonts.semibold,
    fontSize: 13,
    fontWeight: '900',
  },
  historyAmount: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontSize: 12,
    fontWeight: '900',
  },
  historyRoute: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 10,
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyDate: {
    flex: 1,
    color: riderColors.soft,
    fontFamily: riderFonts.medium,
    fontSize: 9,
  },
  statsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 15,
  },
  statItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: riderColors.line,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  statLabel: {
    minHeight: 27,
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
  statValue: {
    color: riderColors.ink,
    fontFamily: riderFonts.bold,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  notice: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: riderColors.line,
    borderRadius: 16,
    backgroundColor: riderColors.greenMist,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
  },
  noticeError: {
    backgroundColor: '#FFF8F7',
    borderColor: '#F9D6D1',
  },
  noticeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: riderColors.greenSoft,
  },
  noticeIconError: {
    backgroundColor: riderColors.redSoft,
  },
  noticeCopy: {
    flex: 1,
  },
  noticeTitle: {
    color: riderColors.ink,
    fontFamily: riderFonts.semibold,
    fontSize: 12,
    fontWeight: '900',
  },
  noticeBody: {
    color: riderColors.muted,
    fontFamily: riderFonts.regular,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  retryButton: {
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: riderColors.line,
    backgroundColor: riderColors.white,
  },
  retryText: {
    color: riderColors.greenDark,
    fontFamily: riderFonts.semibold,
    fontSize: 10,
    fontWeight: '900',
  },
  loadingCard: {
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: riderColors.muted,
    fontFamily: riderFonts.medium,
    fontSize: 11,
  },
  emptyCard: {
    padding: 0,
    overflow: 'hidden',
  },
});
