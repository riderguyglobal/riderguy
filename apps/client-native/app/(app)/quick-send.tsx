import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import { colors, shadow } from '@/design/client';
import { PACKAGE_TYPES, PAYMENT_METHODS, SCHEDULE_TYPES } from '@/lib/client-design';

type LocationValue = {
  address: string;
  latitude?: number;
  longitude?: number;
};

type LocationDetails = {
  location: LocationValue;
  contactName: string;
  contactPhone: string;
  notes: string;
};

type Suggestion = {
  id?: string;
  placeId?: string;
  text?: string;
  placeName?: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
};

const midsection = require('../../assets/images/illustrations/midsection.png');
const LOCATION_TIMEOUT_MS = 8000;

function emptyDetails(): LocationDetails {
  return { location: { address: '' }, contactName: '', contactPhone: '', notes: '' };
}

function hasCoordinates(location: LocationValue) {
  return Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
}

async function getUsablePosition() {
  const current = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
  ]).catch(() => null);

  if (current) return current;

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 5 * 60 * 1000,
    requiredAccuracy: 1000,
  }).catch(() => null);

  if (lastKnown) return lastKnown;

  throw new Error('Could not detect your location.');
}

function computeScheduledAt(scheduleType: string, time: string) {
  if (scheduleType === 'NOW') return null;
  const [hourRaw, minuteRaw] = time.split(':').map(Number);
  const date = new Date();
  if (scheduleType === 'NEXT_DAY' || scheduleType === 'RECURRING') date.setDate(date.getDate() + 1);
  date.setHours(hourRaw ?? 9, minuteRaw ?? 0, 0, 0);
  if (scheduleType === 'SAME_DAY' && date.getTime() <= Date.now()) {
    return new Date(Date.now() + 30 * 60 * 1000);
  }
  return date;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </Text>
  );
}

function LocationDot({ color }: { color: string }) {
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginTop: 18 }} />;
}

function TextPill({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: active ? colors.brand : colors.brandSoft }}>
      <Text style={{ color: active ? '#fff' : colors.brandDark, fontSize: 10, fontWeight: '900' }}>{children}</Text>
    </View>
  );
}

export default function QuickSendScreen() {
  const { api } = useAuth();
  const [step, setStep] = useState(1);
  const [pickup, setPickup] = useState<LocationDetails>(emptyDetails());
  const [dropoff, setDropoff] = useState<LocationDetails>(emptyDetails());
  const [stopInput, setStopInput] = useState('');
  const [additionalStops, setAdditionalStops] = useState<LocationValue[]>([]);
  const [packageType, setPackageType] = useState('SMALL_PARCEL');
  const [scheduleType, setScheduleType] = useState('NOW');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [paymentMethod, setPaymentMethod] = useState('MOBILE_MONEY');
  const [isExpress, setIsExpress] = useState(false);
  const [packageWeightKg, setPackageWeightKg] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [photoAssets, setPhotoAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeSearch, setActiveSearch] = useState<'pickup' | 'dropoff' | 'stop' | null>(null);
  const [locating, setLocating] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);
  const [error, setError] = useState('');

  const selectedPackage = useMemo(() => PACKAGE_TYPES.find((item) => item.value === packageType), [packageType]);
  const selectedSchedule = useMemo(() => SCHEDULE_TYPES.find((item) => item.value === scheduleType), [scheduleType]);
  const selectedPayment = useMemo(() => PAYMENT_METHODS.find((item) => item.value === paymentMethod), [paymentMethod]);
  const canEstimate = !!pickup.location.address && !!dropoff.location.address && hasCoordinates(pickup.location) && hasCoordinates(dropoff.location);
  const needsSelectedLocations = (!!pickup.location.address || !!dropoff.location.address) && !canEstimate;

  const applyLocation = (target: 'pickup' | 'dropoff' | 'stop', location: LocationValue) => {
    if (target === 'pickup') setPickup((prev) => ({ ...prev, location }));
    if (target === 'dropoff') setDropoff((prev) => ({ ...prev, location }));
    if (target === 'stop') {
      setAdditionalStops((prev) => prev.length >= 3 ? prev : [...prev, location]);
      setStopInput('');
    }
    setSuggestions([]);
    setActiveSearch(null);
    setEstimate(null);
  };

  const searchPlaces = async (target: 'pickup' | 'dropoff' | 'stop', query: string) => {
    setActiveSearch(target);
    if (target === 'pickup') setPickup((prev) => ({ ...prev, location: { ...prev.location, address: query } }));
    if (target === 'dropoff') setDropoff((prev) => ({ ...prev, location: { ...prev.location, address: query } }));
    if (target === 'stop') setStopInput(query);
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const { data } = await api.get('/orders/autocomplete', { params: { q: query } });
      setSuggestions(data.data ?? []);
    } catch {
      try {
        const { data } = await api.get('/places/search', { params: { q: query } });
        setSuggestions(data.data ?? []);
      } catch {
        setSuggestions([]);
      }
    }
  };

  const retrieveSuggestion = async (suggestion: Suggestion): Promise<LocationValue> => {
    const id = suggestion.id ?? suggestion.placeId;
    const address = suggestion.placeName ?? suggestion.description ?? suggestion.address ?? suggestion.text ?? '';
    if (suggestion.latitude != null && suggestion.longitude != null) {
      return { address, latitude: suggestion.latitude, longitude: suggestion.longitude };
    }
    if (id) {
      try {
        const { data } = await api.get(`/orders/retrieve-place/${encodeURIComponent(id)}`);
        const place = data.data ?? data;
        return {
          address: place.fullAddress ?? place.address ?? address,
          latitude: place.latitude,
          longitude: place.longitude,
        };
      } catch {
        return { address };
      }
    }
    return { address };
  };

  const detectPickup = async () => {
    setLocating(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Search for your pickup manually.');
        return;
      }
      const loc = await getUsablePosition();
      let address = `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`;
      try {
        const { data } = await api.get('/orders/reverse-geocode', {
          params: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
        });
        address = data.data?.address ?? address;
      } catch {
        try {
          const { data } = await api.get('/places/reverse-geocode', {
            params: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
          });
          address = data.data?.address ?? address;
        } catch {}
      }
      setPickup((prev) => ({
        ...prev,
        location: { address, latitude: loc.coords.latitude, longitude: loc.coords.longitude },
      }));
      setEstimate(null);
    } catch {
      setError('Could not detect your location.');
    } finally {
      setLocating(false);
    }
  };

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 3 - photoAssets.length),
    });
    if (!result.canceled) {
      setPhotoAssets((prev) => [...prev, ...result.assets].slice(0, 3));
    }
  };

  const estimateBody = () => {
    const body: Record<string, unknown> = {
      pickupAddress: pickup.location.address,
      dropoffAddress: dropoff.location.address,
      packageType,
      paymentMethod,
    };
    if (pickup.location.latitude != null && pickup.location.longitude != null) {
      body.pickupLatitude = pickup.location.latitude;
      body.pickupLongitude = pickup.location.longitude;
    }
    if (dropoff.location.latitude != null && dropoff.location.longitude != null) {
      body.dropoffLatitude = dropoff.location.latitude;
      body.dropoffLongitude = dropoff.location.longitude;
    }
    const validStops = additionalStops.filter((stop) => stop.address && hasCoordinates(stop));
    if (validStops.length > 0) {
      body.additionalStops = validStops.length;
      body.stops = validStops.map((stop, index) => ({
        type: 'DROPOFF',
        sequence: index,
        address: stop.address,
        latitude: stop.latitude,
        longitude: stop.longitude,
      }));
    }
    if (scheduleType !== 'NOW') {
      body.scheduleType = scheduleType;
      const scheduledAt = computeScheduledAt(scheduleType, scheduledTime);
      if (scheduledAt) body.scheduledAt = scheduledAt.toISOString();
    }
    if (isExpress) body.isExpress = true;
    const weight = Number.parseFloat(packageWeightKg);
    if (Number.isFinite(weight) && weight > 0) body.packageWeightKg = weight;
    if (promoCode.trim()) body.promoCode = promoCode.trim().toUpperCase();
    return body;
  };

  const getEstimate = async () => {
    if (!canEstimate) {
      setError('Select a pickup and dropoff from the search results, or use current location, so we have coordinates for pricing.');
      return;
    }
    setEstimating(true);
    setError('');
    try {
      const { data } = await api.post('/orders/estimate', estimateBody());
      setEstimate(data.data ?? data);
      setStep(4);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Could not get price estimate.');
    } finally {
      setEstimating(false);
    }
  };

  const uploadPhotos = async () => {
    if (photoAssets.length === 0) return [];
    const urls: string[] = [];
    for (const asset of photoAssets) {
      const fd = new FormData();
      fd.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? `package-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      } as any);
      const { data } = await api.post('/orders/upload-photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.data?.url) urls.push(data.data.url);
    }
    return urls;
  };

  const createOrder = useMutation({
    mutationFn: async () => {
      const photoUrls = await uploadPhotos();
      const body: Record<string, unknown> = {
        ...estimateBody(),
        estimatedTotalPrice: estimate?.totalPrice ?? estimate?.total ?? estimate?.totalAmount,
      };
      if (pickup.contactName) body.pickupContactName = pickup.contactName;
      if (pickup.contactPhone) body.pickupContactPhone = pickup.contactPhone;
      if (pickup.notes) body.pickupInstructions = pickup.notes;
      if (dropoff.contactName) body.dropoffContactName = dropoff.contactName;
      if (dropoff.contactPhone) body.dropoffContactPhone = dropoff.contactPhone;
      if (dropoff.notes) body.dropoffInstructions = dropoff.notes;
      if (photoUrls.length > 0) body.packagePhotoUrl = photoUrls.join(',');
      const { data } = await api.post('/orders', body);
      return data.data ?? data;
    },
    onSuccess: (order) => {
      Toast.show({ type: 'success', text1: 'Order placed', text2: 'Finding a rider for you.' });
      router.replace(order?.id ? `/(app)/orders/${order.id}/tracking` as any : '/(tabs)/orders');
    },
    onError: (err: any) => {
      Alert.alert('Order failed', err?.response?.data?.error?.message ?? 'Failed to place order.');
    },
  });

  const renderSuggestions = () => (
    suggestions.length > 0 && activeSearch ? (
      <View style={{ marginTop: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEF2F7', overflow: 'hidden', ...shadow.card }}>
        {suggestions.slice(0, 6).map((item, index) => {
          const title = item.text ?? item.description ?? item.placeName ?? item.address ?? 'Location';
          const subtitle = item.placeName ?? item.address ?? item.description ?? '';
          return (
            <TouchableOpacity
              key={`${item.id ?? item.placeId ?? title}-${index}`}
              onPress={async () => applyLocation(activeSearch, await retrieveSuggestion(item))}
              style={{ flexDirection: 'row', gap: 10, padding: 12, borderBottomWidth: index === suggestions.length - 1 ? 0 : 1, borderBottomColor: '#F1F5F9' }}
            >
              <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="location-outline" size={15} color={colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{title}</Text>
                {!!subtitle && subtitle !== title && <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    ) : null
  );

  const total = estimate?.totalPrice ?? estimate?.total ?? estimate?.totalAmount ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={{ height: 58, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => (step > 1 ? setStep(step - 1) : router.back())} style={{ width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', marginRight: 38 }}>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Send a Package</Text>
          <Text style={{ color: colors.subtle, fontSize: 10, marginTop: 1 }}>Fast. Safe. Reliable.</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingVertical: 12 }}>
        {[1, 2, 3, 4].map((item) => (
          <View key={item} style={{ flex: 1, height: 4, borderRadius: 999, backgroundColor: item <= step ? colors.brand : '#E5E7EB' }} />
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: 118 }}>
          {step === 1 && (
            <View>
              <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 }}>Where should we go?</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>Set pickup and dropoff. We will calculate the best price.</Text>

              <View style={{ borderRadius: 20, backgroundColor: '#fff', padding: 14, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.float }}>
                <View style={{ flexDirection: 'row', gap: 11 }}>
                  <LocationDot color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Current Location</FieldLabel>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TextInput
                        style={{ flex: 1, minHeight: 44, color: colors.ink, fontSize: 14, fontWeight: '700' }}
                        placeholder="Set pickup location"
                        placeholderTextColor={colors.subtle}
                        value={pickup.location.address}
                        onChangeText={(text) => searchPlaces('pickup', text)}
                      />
                      <TouchableOpacity onPress={detectPickup} disabled={locating} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                        {locating ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="locate-outline" size={17} color={colors.brandDark} />}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={{ marginLeft: 5, height: 20, borderLeftWidth: 1.5, borderLeftColor: '#D1D5DB', borderStyle: 'dashed' }} />

                <View style={{ flexDirection: 'row', gap: 11 }}>
                  <LocationDot color={colors.ink} />
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Dropoff</FieldLabel>
                    <TextInput
                      style={{ minHeight: 44, color: colors.ink, fontSize: 14, fontWeight: '700' }}
                      placeholder="Where are you sending to?"
                      placeholderTextColor={colors.subtle}
                      value={dropoff.location.address}
                      onChangeText={(text) => searchPlaces('dropoff', text)}
                    />
                  </View>
                </View>
              </View>

              {renderSuggestions()}

              {!!error && (
                <View style={{ marginTop: 12, borderRadius: 14, backgroundColor: '#FEF2F2', padding: 12, flexDirection: 'row', gap: 8 }}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.red} />
                  <Text style={{ flex: 1, color: '#B91C1C', fontSize: 12, lineHeight: 17 }}>{error}</Text>
                </View>
              )}

              {!error && needsSelectedLocations && (
                <View style={{ marginTop: 12, borderRadius: 14, backgroundColor: '#FFFBEB', padding: 12, flexDirection: 'row', gap: 8 }}>
                  <Ionicons name="information-circle-outline" size={18} color="#B45309" />
                  <Text style={{ flex: 1, color: '#92400E', fontSize: 12, lineHeight: 17 }}>Select each location from search results so we can price the trip accurately.</Text>
                </View>
              )}

              <Image source={midsection} resizeMode="cover" style={{ width: '100%', height: 112, borderRadius: 18, marginTop: 14 }} />

              <TouchableOpacity
                activeOpacity={0.88}
                disabled={!canEstimate}
                onPress={() => setStep(2)}
                style={{ marginTop: 16, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: canEstimate ? colors.ink : '#E5E7EB' }}
              >
                <Text style={{ color: canEstimate ? '#fff' : colors.subtle, fontWeight: '900', fontSize: 16 }}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 }}>Package details</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>Tell us what you are sending and when to pick it up.</Text>

              <FieldLabel>What are you sending?</FieldLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PACKAGE_TYPES.map((item) => {
                  const active = packageType === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      activeOpacity={0.86}
                      onPress={() => { setPackageType(item.value); setEstimate(null); }}
                      style={{ width: '23%', minHeight: 68, borderRadius: 14, backgroundColor: active ? colors.ink : '#F8FAFC', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    >
                      <Ionicons name={item.icon as any} size={19} color={active ? '#fff' : colors.text} />
                      <Text style={{ color: active ? '#fff' : colors.text, fontSize: 9.5, fontWeight: '900', textAlign: 'center' }}>{item.shortLabel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: 18 }}>
                <FieldLabel>When?</FieldLabel>
                <View style={{ gap: 8 }}>
                  {SCHEDULE_TYPES.map((item) => {
                    const active = scheduleType === item.value;
                    return (
                      <TouchableOpacity
                        key={item.value}
                        onPress={() => { setScheduleType(item.value); setEstimate(null); }}
                        style={{ borderRadius: 16, padding: 13, backgroundColor: active ? colors.ink : '#F8FAFC', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <View>
                          <Text style={{ color: active ? '#fff' : colors.ink, fontWeight: '900', fontSize: 14 }}>{item.label}</Text>
                          <Text style={{ color: active ? '#D1D5DB' : colors.subtle, fontSize: 11, marginTop: 2 }}>{item.description}</Text>
                        </View>
                        {item.discount ? <TextPill active={active}>{item.discount}</TextPill> : active ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand }} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {scheduleType !== 'NOW' && (
                  <View style={{ marginTop: 9, borderRadius: 16, backgroundColor: '#F8FAFC', paddingHorizontal: 14, height: 50, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ flex: 1, color: colors.muted, fontSize: 13 }}>Pickup time</Text>
                    <TextInput
                      value={scheduledTime}
                      onChangeText={setScheduledTime}
                      placeholder="09:00"
                      keyboardType="numbers-and-punctuation"
                      style={{ width: 72, color: colors.ink, fontWeight: '900', textAlign: 'right' }}
                    />
                  </View>
                )}

                <TouchableOpacity onPress={() => setIsExpress((value) => !value)} style={{ marginTop: 9, borderRadius: 16, backgroundColor: isExpress ? colors.brandSoft : '#F8FAFC', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: isExpress ? colors.brand : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="flash-outline" size={18} color={isExpress ? '#fff' : colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 14 }}>Express Delivery</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Priority pickup, faster dispatch</Text>
                  </View>
                  <TextPill active={isExpress}>{isExpress ? 'On' : 'Off'}</TextPill>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setStep(3)} style={{ marginTop: 18, height: 56, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 }}>Optional details</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>Add contacts, stops, promo code, and package photos.</Text>

              <FieldLabel>Payment</FieldLabel>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {PAYMENT_METHODS.map((item) => {
                  const active = paymentMethod === item.value;
                  return (
                    <TouchableOpacity key={item.value} onPress={() => { setPaymentMethod(item.value); setEstimate(null); }} style={{ flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: active ? colors.ink : '#F8FAFC' }}>
                      <Text style={{ color: active ? '#fff' : colors.text, fontSize: 12, fontWeight: '900' }}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <FieldLabel>Promo and weight</FieldLabel>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <TextInput value={promoCode} onChangeText={(text) => { setPromoCode(text.toUpperCase()); setEstimate(null); }} placeholder="PROMO CODE" placeholderTextColor={colors.subtle} autoCapitalize="characters" style={{ flex: 1, height: 50, borderRadius: 16, backgroundColor: '#F8FAFC', paddingHorizontal: 14, color: colors.ink, fontWeight: '900' }} />
                <TextInput value={packageWeightKg} onChangeText={(text) => { setPackageWeightKg(text.replace(/[^0-9.]/g, '')); setEstimate(null); }} placeholder="kg" placeholderTextColor={colors.subtle} keyboardType="decimal-pad" style={{ width: 82, height: 50, borderRadius: 16, backgroundColor: '#F8FAFC', paddingHorizontal: 14, color: colors.ink, fontWeight: '900', textAlign: 'center' }} />
              </View>

              <FieldLabel>Additional stops</FieldLabel>
              <View style={{ borderRadius: 16, backgroundColor: '#F8FAFC', paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                <TextInput value={stopInput} onChangeText={(text) => searchPlaces('stop', text)} placeholder="Add another dropoff" placeholderTextColor={colors.subtle} style={{ flex: 1, height: 48, color: colors.ink, fontWeight: '700' }} />
                <Text style={{ color: colors.subtle, fontSize: 12 }}>{additionalStops.length}/3</Text>
              </View>
              {renderSuggestions()}
              {additionalStops.map((stop, index) => (
                <View key={`${stop.address}-${index}`} style={{ marginTop: 8, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEF2F7', padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Ionicons name="location-outline" size={16} color={colors.brandDark} />
                  <Text style={{ flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{stop.address}</Text>
                  <TouchableOpacity onPress={() => { setAdditionalStops((prev) => prev.filter((_, i) => i !== index)); setEstimate(null); }}>
                    <Ionicons name="close" size={16} color={colors.subtle} />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={{ marginTop: 16, gap: 10 }}>
                <FieldLabel>Contact details</FieldLabel>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput value={pickup.contactName} onChangeText={(text) => setPickup((prev) => ({ ...prev, contactName: text }))} placeholder="Sender name" placeholderTextColor={colors.subtle} style={{ flex: 1, height: 48, borderRadius: 15, backgroundColor: '#F8FAFC', paddingHorizontal: 13, color: colors.ink }} />
                  <TextInput value={pickup.contactPhone} onChangeText={(text) => setPickup((prev) => ({ ...prev, contactPhone: text }))} placeholder="Sender phone" placeholderTextColor={colors.subtle} keyboardType="phone-pad" style={{ flex: 1, height: 48, borderRadius: 15, backgroundColor: '#F8FAFC', paddingHorizontal: 13, color: colors.ink }} />
                </View>
                <TextInput value={pickup.notes} onChangeText={(text) => setPickup((prev) => ({ ...prev, notes: text }))} placeholder="Pickup notes" placeholderTextColor={colors.subtle} style={{ height: 48, borderRadius: 15, backgroundColor: '#F8FAFC', paddingHorizontal: 13, color: colors.ink }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput value={dropoff.contactName} onChangeText={(text) => setDropoff((prev) => ({ ...prev, contactName: text }))} placeholder="Recipient name" placeholderTextColor={colors.subtle} style={{ flex: 1, height: 48, borderRadius: 15, backgroundColor: '#F8FAFC', paddingHorizontal: 13, color: colors.ink }} />
                  <TextInput value={dropoff.contactPhone} onChangeText={(text) => setDropoff((prev) => ({ ...prev, contactPhone: text }))} placeholder="Recipient phone" placeholderTextColor={colors.subtle} keyboardType="phone-pad" style={{ flex: 1, height: 48, borderRadius: 15, backgroundColor: '#F8FAFC', paddingHorizontal: 13, color: colors.ink }} />
                </View>
                <TextInput value={dropoff.notes} onChangeText={(text) => setDropoff((prev) => ({ ...prev, notes: text }))} placeholder="Delivery notes" placeholderTextColor={colors.subtle} style={{ height: 48, borderRadius: 15, backgroundColor: '#F8FAFC', paddingHorizontal: 13, color: colors.ink }} />
              </View>

              <View style={{ marginTop: 16 }}>
                <FieldLabel>Package photos</FieldLabel>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  {photoAssets.map((asset, index) => (
                    <View key={asset.uri} style={{ width: 76, height: 76, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F3F4F6' }}>
                      <Image source={{ uri: asset.uri }} style={{ width: '100%', height: '100%' }} />
                      <TouchableOpacity onPress={() => setPhotoAssets((prev) => prev.filter((_, i) => i !== index))} style={{ position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="close" size={13} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {photoAssets.length < 3 && (
                    <TouchableOpacity onPress={pickPhotos} style={{ width: 76, height: 76, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="camera-outline" size={22} color={colors.subtle} />
                      <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '800', marginTop: 4 }}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <TouchableOpacity onPress={getEstimate} disabled={estimating} style={{ marginTop: 18, height: 56, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...shadow.brand }}>
                {estimating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Review Price</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 }}>Review & Send</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 16 }}>Confirm the delivery details before we find your rider.</Text>

              <View style={{ borderRadius: 20, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.float }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: colors.brand }} />
                    <View style={{ flex: 1, minHeight: 34, borderLeftWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed', marginVertical: 4 }} />
                    <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: colors.ink }} />
                  </View>
                  <View style={{ flex: 1, gap: 14 }}>
                    <View>
                      <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Pickup</Text>
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 3 }}>{pickup.location.address}</Text>
                    </View>
                    <View>
                      <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Dropoff</Text>
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 3 }}>{dropoff.location.address}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ marginTop: 14, borderRadius: 20, backgroundColor: colors.ink, padding: 18 }}>
                <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '800' }}>Estimated total</Text>
                <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -0.8, marginTop: 3 }}>{formatCurrency(total, 'GHS')}</Text>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 14 }} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <TextPill active>{selectedPackage?.label}</TextPill>
                  <TextPill active>{selectedSchedule?.label}</TextPill>
                  <TextPill active>{selectedPayment?.label}</TextPill>
                  {isExpress && <TextPill active>Express</TextPill>}
                  {additionalStops.length > 0 && <TextPill active>{additionalStops.length} stops</TextPill>}
                </View>
              </View>

              {!!estimate?.promoDiscount && (
                <View style={{ marginTop: 10, borderRadius: 16, backgroundColor: colors.brandSoft, padding: 12, flexDirection: 'row', gap: 10 }}>
                  <Ionicons name="pricetag-outline" size={18} color={colors.brandDark} />
                  <Text style={{ color: colors.brandDark, fontSize: 12, fontWeight: '800' }}>
                    Promo applied. You saved {formatCurrency(estimate.promoDiscount, 'GHS')}.
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={() => createOrder.mutate()} disabled={createOrder.isPending} style={{ marginTop: 18, height: 60, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, ...shadow.brand }}>
                {createOrder.isPending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="send-outline" size={20} color="#fff" /><Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }}>Confirm & Send</Text></>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
