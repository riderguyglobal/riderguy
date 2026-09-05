import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { riderColors, riderFonts } from '@/lib/rider-design';

type NavigationKey = 'home' | 'deliveries' | 'earnings' | 'asset' | 'profile';

type NavigationItem = {
  key: NavigationKey;
  label: string;
  route?: string;
};

const CORE_ITEMS: NavigationItem[] = [
  { key: 'home', label: 'Home', route: '/(tabs)' },
  { key: 'deliveries', label: 'Deliveries', route: '/(tabs)/jobs' },
  { key: 'earnings', label: 'Earnings', route: '/(tabs)/earnings' },
];

function NavigationIcon({ item, active }: { item: NavigationItem; active: boolean }) {
  const color = active ? riderColors.greenDark : '#7D8480';
  const size = 23;
  if (item.key === 'deliveries') {
    return (
      <MaterialCommunityIcons
        name={active ? 'truck-delivery' : 'truck-delivery-outline'}
        size={size}
        color={color}
      />
    );
  }
  if (item.key === 'earnings') {
    return (
      <MaterialCommunityIcons name={active ? 'sack' : 'sack-outline'} size={size} color={color} />
    );
  }
  if (item.key === 'asset') {
    return (
      <MaterialCommunityIcons
        name={active ? 'motorbike-electric' : 'motorbike'}
        size={size}
        color={color}
      />
    );
  }
  return (
    <Ionicons
      name={
        item.key === 'home'
          ? active
            ? 'home'
            : 'home-outline'
          : active
            ? 'person'
            : 'person-outline'
      }
      size={size}
      color={color}
    />
  );
}

export function RiderBottomNavigation({
  active,
  includeAsset = false,
}: {
  active?: NavigationKey;
  includeAsset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const items: NavigationItem[] = [
    ...CORE_ITEMS,
    ...(includeAsset ? [{ key: 'asset' as const, label: 'Asset Financing' }] : []),
    { key: 'profile', label: 'Profile', route: '/(tabs)/account' },
  ];

  return (
    <View style={[styles.bar, { height: 61 + insets.bottom, paddingBottom: insets.bottom }]}>
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <TouchableOpacity
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            activeOpacity={0.78}
            disabled={!item.route}
            onPress={() => item.route && router.replace(item.route as never)}
            style={styles.item}
          >
            <NavigationIcon item={item} active={selected} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.label, selected ? styles.labelActive : null]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EDF2EF',
    backgroundColor: riderColors.white,
    paddingTop: 7,
  },
  item: {
    flex: 1,
    minWidth: 0,
    height: 53,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  label: {
    maxWidth: '100%',
    color: '#737A76',
    fontSize: 9.5,
    lineHeight: 12,
    fontFamily: riderFonts.medium,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelActive: { color: riderColors.greenDark, fontFamily: riderFonts.semibold, fontWeight: '900' },
});
