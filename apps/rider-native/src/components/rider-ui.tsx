import { useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { riderColors, riderShadow, statusTone, cleanLabel } from '@/lib/rider-design';

type IconName = keyof typeof Ionicons.glyphMap;

export function RiderHeader({
  title,
  eyebrow,
  subtitle,
  canGoBack,
  right,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  canGoBack?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {canGoBack ? (
        <IconButton icon="arrow-back" onPress={() => router.back()} style={{ marginRight: 10 }} />
      ) : null}
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={{ marginLeft: 10 }}>{right}</View> : null}
    </View>
  );
}

export function BrandHeader({
  title = 'Riderguy',
  onMenu,
  onNotifications,
  unread,
  right,
}: {
  title?: string;
  onMenu?: () => void;
  onNotifications?: () => void;
  unread?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.brandHeader}>
      <TouchableOpacity
        onPress={onMenu}
        activeOpacity={0.82}
        style={styles.brandHeaderButton}
      >
        <Ionicons name="menu" size={28} color={riderColors.ink} />
      </TouchableOpacity>
      <Text style={styles.brandWordmark}>{title}</Text>
      {right ? (
        <View style={styles.brandHeaderRight}>{right}</View>
      ) : (
        <TouchableOpacity
          onPress={onNotifications}
          activeOpacity={0.82}
          style={styles.brandHeaderButton}
        >
          <Ionicons name="notifications-outline" size={26} color={riderColors.ink} />
          {unread ? <View style={styles.unreadDot} /> : null}
        </TouchableOpacity>
      )}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  style,
  color = riderColors.ink,
  disabled,
}: {
  icon: IconName;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.iconButton, disabled ? { opacity: 0.45 } : null, style]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </TouchableOpacity>
  );
}

export function WalletCard({
  label = 'Wallet Balance',
  balance,
  loading,
  onAddMoney,
  onCashOut,
  onHistory,
}: {
  label?: string;
  balance: string;
  loading?: boolean;
  onAddMoney?: () => void;
  onCashOut?: () => void;
  onHistory?: () => void;
}) {
  return (
    <View style={styles.walletCard}>
      <View style={styles.walletGlow} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.walletLabel}>{label}</Text>
        <Ionicons name="eye-outline" size={18} color={riderColors.white} />
      </View>
      <Text style={styles.walletBalance} numberOfLines={1}>
        {loading ? '...' : balance}
      </Text>
      <View style={styles.walletDivider} />
      <View style={styles.walletActions}>
        <WalletAction icon="cash-outline" label="Add Money" onPress={onAddMoney} />
        <WalletAction icon="share-outline" label="Cash Out" onPress={onCashOut} />
        <WalletAction icon="receipt-outline" label="History" onPress={onHistory} />
      </View>
    </View>
  );
}

function WalletAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={styles.walletAction}>
      <Ionicons name={icon} size={19} color={riderColors.white} />
      <Text style={styles.walletActionText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export function RiderCard({
  children,
  style,
  dark,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}) {
  return (
    <View style={[styles.card, dark ? styles.darkCard : null, style]}>
      {children}
    </View>
  );
}

export function RiderButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  variant?: 'primary' | 'dark' | 'ghost' | 'danger' | 'light';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const variantStyle = {
    primary: styles.primaryButton,
    dark: styles.darkButton,
    ghost: styles.ghostButton,
    danger: styles.dangerButton,
    light: styles.lightButton,
  }[variant];
  const labelStyle = {
    primary: styles.primaryButtonText,
    dark: styles.primaryButtonText,
    ghost: styles.ghostButtonText,
    danger: styles.dangerButtonText,
    light: styles.lightButtonText,
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.86}
      style={[styles.button, variantStyle, disabled || loading ? styles.disabled : null, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' || variant === 'light' ? riderColors.ink : riderColors.white} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {icon ? <Ionicons name={icon} size={18} color={(labelStyle as TextStyle).color as string} /> : null}
          <Text style={labelStyle}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function StatusPill({ status, label }: { status?: string | null; label?: string }) {
  const tone = statusTone(status ?? label);
  return (
    <View style={[styles.pill, { backgroundColor: tone.background, borderColor: tone.border }]}>
      <Text style={[styles.pillText, { color: tone.color }]}>{label ?? cleanLabel(status)}</Text>
    </View>
  );
}

export function OverviewPanel({
  title,
  actionLabel,
  onAction,
  items,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  items: Array<{ icon: IconName; label: string; value: string; tone?: 'green' | 'blue' | 'amber' | 'red' | 'violet' | 'dark' }>;
}) {
  return (
    <RiderCard style={{ padding: 0, overflow: 'hidden' }}>
      <View style={styles.panelTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {actionLabel ? (
          <TouchableOpacity onPress={onAction} activeOpacity={0.82}>
            <Text style={styles.sectionAction}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.overviewRow}>
        {items.map((item, index) => (
          <View
            key={`${item.label}-${item.value}`}
            style={[
              styles.overviewItem,
              index < items.length - 1 ? styles.overviewDivider : null,
            ]}
          >
            <MetricIcon icon={item.icon} tone={item.tone ?? 'green'} />
            <Text style={styles.overviewLabel}>{item.label}</Text>
            <Text style={styles.overviewValue} numberOfLines={1}>{item.value}</Text>
          </View>
        ))}
      </View>
    </RiderCard>
  );
}

export function ActionBand({
  icon,
  title,
  body,
  actionLabel,
  onPress,
  buttonLabel,
  buttonIcon,
}: {
  icon: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onPress?: () => void;
  buttonLabel?: string;
  buttonIcon?: IconName;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.86}
      accessibilityLabel={actionLabel}
      style={styles.actionBand}
    >
      <View style={styles.actionBandIcon}>
        <Ionicons name={icon} size={28} color={riderColors.greenDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionBandTitle}>{title}</Text>
        {body ? <Text style={styles.actionBandBody}>{body}</Text> : null}
      </View>
      {buttonLabel ? (
        <View style={styles.actionBandButton}>
          <Text style={styles.actionBandButtonText}>{buttonLabel}</Text>
          {buttonIcon ? <Ionicons name={buttonIcon} size={17} color={riderColors.greenDark} /> : null}
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={22} color={riderColors.muted} />
      )}
    </TouchableOpacity>
  );
}

export function RecommendationTile({
  icon,
  title,
  body,
  tone = 'green',
  onPress,
}: {
  icon: IconName;
  title: string;
  body: string;
  tone?: 'green' | 'blue' | 'amber' | 'violet';
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={styles.recommendationTile}>
      <MetricIcon icon={icon} tone={tone} size={56} iconSize={26} />
      <Text style={styles.recommendationTitle} numberOfLines={2}>{title}</Text>
      <Text style={styles.recommendationBody} numberOfLines={3}>{body}</Text>
      <Ionicons name="chevron-forward" size={18} color={riderColors.muted} style={{ alignSelf: 'flex-end', marginTop: 5 }} />
    </TouchableOpacity>
  );
}

export function SettingsListItem({
  icon,
  title,
  body,
  onPress,
}: {
  icon: IconName;
  title: string;
  body?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={styles.settingsItem}>
      <View style={styles.settingsIcon}>
        <Ionicons name={icon} size={22} color={riderColors.greenDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsTitle}>{title}</Text>
        {body ? <Text style={styles.settingsBody}>{body}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={riderColors.muted} />
    </TouchableOpacity>
  );
}

function MetricIcon({
  icon,
  tone,
  size = 46,
  iconSize = 23,
}: {
  icon: IconName;
  tone: 'green' | 'blue' | 'amber' | 'red' | 'violet' | 'dark';
  size?: number;
  iconSize?: number;
}) {
  const toneMap = {
    green: [riderColors.greenSoft, riderColors.greenDark],
    blue: [riderColors.blueSoft, riderColors.blue],
    amber: [riderColors.amberSoft, '#B77908'],
    red: [riderColors.redSoft, riderColors.red],
    violet: [riderColors.violetSoft, riderColors.violet],
    dark: ['#101814', riderColors.white],
  } as const;
  const [backgroundColor, color] = toneMap[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={iconSize} color={color} />
    </View>
  );
}

export function MetricTile({
  label,
  value,
  icon,
  tone = 'green',
  style,
}: {
  label: string;
  value: string;
  icon?: IconName;
  tone?: 'green' | 'blue' | 'amber' | 'red' | 'violet' | 'dark';
  style?: StyleProp<ViewStyle>;
}) {
  const toneMap = {
    green: [riderColors.greenSoft, riderColors.greenDark],
    blue: [riderColors.blueSoft, riderColors.blue],
    amber: [riderColors.amberSoft, '#9a5f05'],
    red: [riderColors.redSoft, riderColors.red],
    violet: [riderColors.violetSoft, riderColors.violet],
    dark: ['#142033', riderColors.white],
  } as const;
  const [background, color] = toneMap[tone];
  return (
    <View style={[styles.metricTile, style]}>
      <View style={[styles.metricIcon, { backgroundColor: background }]}>
        {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function RouteSummary({
  pickup,
  dropoff,
  compact,
}: {
  pickup?: string | null;
  dropoff?: string | null;
  compact?: boolean;
}) {
  return (
    <View style={{ gap: compact ? 7 : 10 }}>
      <RoutePoint color={riderColors.green} label="Pickup" value={pickup ?? 'Pickup not set'} compact={compact} />
      <RoutePoint color={riderColors.red} label="Dropoff" value={dropoff ?? 'Dropoff not set'} compact={compact} square />
    </View>
  );
}

function RoutePoint({
  color,
  label,
  value,
  square,
  compact,
}: {
  color: string;
  label: string;
  value: string;
  square?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View style={[styles.routeDot, square ? { borderRadius: 4 } : null, { borderColor: color, backgroundColor: `${color}18` }]} />
      <View style={{ flex: 1 }}>
        {!compact ? <Text style={styles.routeLabel}>{label}</Text> : null}
        <Text style={styles.routeValue} numberOfLines={compact ? 1 : 2}>{value}</Text>
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={riderColors.soft} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {action ? <View style={{ marginTop: 14, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function ProgressBar({ progress, color = riderColors.green }: { progress: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: color }]} />
    </View>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active ? styles.segmentActive : null]}
            activeOpacity={0.82}
          >
            <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function RiderTextField({
  label,
  inputStyle,
  containerStyle,
  ...props
}: TextInputProps & {
  label?: string;
  inputStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginBottom: 14 }, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#9ba8b8"
        {...props}
        style={[styles.input, inputStyle]}
      />
    </View>
  );
}

export function PinBoxes({
  value,
  onChange,
  length = 6,
  secure,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  secure?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <TouchableOpacity onPress={() => ref.current?.focus()} activeOpacity={1}>
      <View style={styles.pinRow}>
        {Array.from({ length }).map((_, index) => {
          const active = value.length === index;
          const filled = !!value[index];
          return (
            <View key={index} style={[styles.pinBox, active || filled ? styles.pinBoxActive : null]}>
              <Text style={styles.pinText}>{secure && filled ? '*' : value[index] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hiddenInput}
        autoFocus
      />
    </TouchableOpacity>
  );
}

export const styles = StyleSheet.create({
  header: {
    minHeight: 74,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: riderColors.white,
    borderBottomWidth: 1,
    borderBottomColor: riderColors.line,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandHeader: {
    height: 70,
    paddingHorizontal: 18,
    backgroundColor: riderColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandHeaderRight: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  brandWordmark: {
    position: 'absolute',
    left: 88,
    right: 88,
    textAlign: 'center',
    color: riderColors.greenDark,
    fontSize: 28,
    fontWeight: '900',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: riderColors.red,
    borderWidth: 2,
    borderColor: riderColors.white,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: riderColors.greenDark,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: riderColors.ink,
  },
  headerSubtitle: {
    fontSize: 12,
    color: riderColors.muted,
    marginTop: 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: riderColors.panelAlt,
    borderWidth: 1,
    borderColor: riderColors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: riderColors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: riderColors.line,
    ...riderShadow,
  },
  darkCard: {
    backgroundColor: riderColors.ink,
    borderColor: '#182337',
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: riderColors.green,
  },
  darkButton: {
    backgroundColor: riderColors.ink,
  },
  ghostButton: {
    backgroundColor: riderColors.white,
    borderWidth: 1,
    borderColor: riderColors.line,
  },
  dangerButton: {
    backgroundColor: riderColors.redSoft,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  lightButton: {
    backgroundColor: riderColors.panelAlt,
    borderWidth: 1,
    borderColor: riderColors.line,
  },
  disabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: riderColors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  ghostButtonText: {
    color: riderColors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  dangerButtonText: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '900',
  },
  lightButtonText: {
    color: riderColors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  walletCard: {
    minHeight: 168,
    borderRadius: 14,
    padding: 18,
    backgroundColor: riderColors.greenDark,
    overflow: 'hidden',
    ...riderShadow,
  },
  walletGlow: {
    position: 'absolute',
    right: -28,
    top: 22,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  walletLabel: {
    color: riderColors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  walletBalance: {
    color: riderColors.white,
    fontSize: 37,
    fontWeight: '900',
    marginTop: 18,
  },
  walletDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginTop: 18,
    marginBottom: 12,
  },
  walletActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletAction: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.22)',
  },
  walletActionText: {
    color: riderColors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  panelTitleRow: {
    minHeight: 50,
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: riderColors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionAction: {
    color: riderColors.greenDark,
    fontSize: 13,
    fontWeight: '900',
  },
  overviewRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 16,
    paddingTop: 8,
  },
  overviewItem: {
    flex: 1,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  overviewDivider: {
    borderRightWidth: 1,
    borderRightColor: riderColors.line,
  },
  overviewLabel: {
    color: riderColors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 11,
    textAlign: 'center',
  },
  overviewValue: {
    color: riderColors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'center',
  },
  actionBand: {
    minHeight: 94,
    borderRadius: 14,
    backgroundColor: riderColors.greenMist,
    borderWidth: 1,
    borderColor: '#D6EEE4',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionBandIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: riderColors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBandTitle: {
    color: riderColors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  actionBandBody: {
    color: riderColors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  actionBandButton: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: riderColors.white,
    borderWidth: 1,
    borderColor: riderColors.line,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBandButtonText: {
    color: riderColors.greenDark,
    fontSize: 13,
    fontWeight: '900',
  },
  recommendationTile: {
    flex: 1,
    minHeight: 164,
    borderRadius: 14,
    backgroundColor: riderColors.white,
    borderWidth: 1,
    borderColor: riderColors.line,
    padding: 12,
    alignItems: 'center',
    ...riderShadow,
  },
  recommendationTitle: {
    color: riderColors.ink,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },
  recommendationBody: {
    color: riderColors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
    textAlign: 'center',
  },
  settingsItem: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: riderColors.line,
  },
  settingsIcon: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: riderColors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  settingsTitle: {
    color: riderColors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  settingsBody: {
    color: riderColors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  metricTile: {
    flex: 1,
    minHeight: 112,
    backgroundColor: riderColors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: riderColors.line,
    padding: 13,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: riderColors.ink,
  },
  metricLabel: {
    fontSize: 11,
    color: riderColors.muted,
    marginTop: 3,
    fontWeight: '700',
  },
  routeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    marginTop: 3,
  },
  routeLabel: {
    fontSize: 10,
    color: riderColors.soft,
    textTransform: 'uppercase',
    fontWeight: '900',
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 13,
    color: riderColors.ink,
    fontWeight: '700',
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 54,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: riderColors.panelAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: riderColors.line,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '900',
    color: riderColors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: riderColors.muted,
    textAlign: 'center',
  },
  progressTrack: {
    height: 9,
    borderRadius: 99,
    backgroundColor: '#dce4ee',
    overflow: 'hidden',
  },
  progressFill: {
    height: 9,
    borderRadius: 99,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#e7eef6',
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: riderColors.white,
    ...riderShadow,
  },
  segmentText: {
    color: riderColors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: riderColors.ink,
  },
  fieldLabel: {
    fontSize: 11,
    color: riderColors.muted,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  input: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: riderColors.line,
    backgroundColor: riderColors.white,
    paddingHorizontal: 14,
    color: riderColors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  pinRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginVertical: 10,
  },
  pinBox: {
    width: 44,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: riderColors.line,
    backgroundColor: riderColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxActive: {
    borderColor: riderColors.green,
    backgroundColor: riderColors.greenSoft,
  },
  pinText: {
    color: riderColors.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});
