import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '@/design/client';

export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <View style={{ minHeight: 58, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onBack ?? (() => router.back())}
        style={{ width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', marginRight: 10 }}
      >
        <Ionicons name="arrow-back" size={20} color={colors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.2 }}>{title}</Text>
        {!!subtitle && <Text style={{ color: colors.subtle, fontSize: 10.5, marginTop: 1, fontWeight: '600' }}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function ClientBrandHeader({
  onMenu,
  onNotifications,
  unread,
  right,
}: {
  onMenu?: () => void;
  onNotifications?: () => void;
  unread?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={{ height: 70, paddingHorizontal: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <TouchableOpacity onPress={onMenu} activeOpacity={0.84} style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="menu" size={28} color={colors.ink} />
      </TouchableOpacity>
      <Text style={{ position: 'absolute', left: 88, right: 88, textAlign: 'center', color: colors.brandDark, fontSize: 28, fontWeight: '900' }}>Riderguy</Text>
      {right ? (
        <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
      ) : (
        <TouchableOpacity onPress={onNotifications} activeOpacity={0.84} style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="notifications-outline" size={26} color={colors.ink} />
          {unread ? <View style={{ position: 'absolute', top: 8, right: 7, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.red, borderWidth: 2, borderColor: '#fff' }} /> : null}
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ServiceCard({
  icon,
  title,
  body,
  onPress,
  image,
  tone = colors.brandSoft,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress?: () => void;
  image?: ReactNode;
  tone?: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{ flex: 1, minHeight: 104, borderRadius: 16, backgroundColor: tone, padding: 13, borderWidth: 1, borderColor: colors.line }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        {image ?? (
          <View style={{ width: 36, height: 36, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={20} color={colors.brandDark} />
          </View>
        )}
        <Text style={{ flex: 1, color: colors.ink, fontSize: 13, fontWeight: '900' }}>{title}</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.brandDark} />
      </View>
      <Text style={{ marginTop: 8, color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: '600' }}>{body}</Text>
    </TouchableOpacity>
  );
}

export function StatusBadge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <View style={{ borderRadius: 999, backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ color: text, fontSize: 10, fontWeight: '900' }}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 70, paddingHorizontal: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Ionicons name={icon} size={30} color="#D1D5DB" />
      </View>
      <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'center' }}>{title}</Text>
      {!!body && <Text style={{ color: colors.subtle, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 }}>{body}</Text>}
      {!!action && !!onPress && (
        <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={{ marginTop: 16, borderRadius: 999, backgroundColor: colors.brand, paddingHorizontal: 18, paddingVertical: 10, ...shadow.brand }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function RoutePair({
  pickup,
  dropoff,
  compact,
}: {
  pickup?: string;
  dropoff?: string;
  compact?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', paddingTop: 4 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} />
        <View style={{ flex: 1, minHeight: compact ? 22 : 34, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB', marginVertical: 4 }} />
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink }} />
      </View>
      <View style={{ flex: 1, gap: compact ? 8 : 12 }}>
        <View>
          <Text style={{ color: colors.subtle, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' }}>Pickup</Text>
          <Text style={{ color: colors.ink, fontSize: compact ? 12 : 13, fontWeight: '800', marginTop: 2 }} numberOfLines={compact ? 1 : 2}>{pickup || 'Pickup address'}</Text>
        </View>
        <View>
          <Text style={{ color: colors.subtle, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' }}>Dropoff</Text>
          <Text style={{ color: colors.ink, fontSize: compact ? 12 : 13, fontWeight: '800', marginTop: 2 }} numberOfLines={compact ? 1 : 2}>{dropoff || 'Dropoff address'}</Text>
        </View>
      </View>
    </View>
  );
}
