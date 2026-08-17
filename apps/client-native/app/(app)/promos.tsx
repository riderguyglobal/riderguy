import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuth } from '@riderguy/auth-native';
import { EmptyState, ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

function discountLabel(promo: any) {
  if (promo.discountType === 'FLAT') return `GHS ${Number(promo.discountValue ?? 0).toFixed(0)} off`;
  return `${Number(promo.discountValue ?? 0).toFixed(0)}% off`;
}

export default function PromosScreen() {
  const { api } = useAuth();
  const [code, setCode] = useState('');
  const [validated, setValidated] = useState<any>(null);

  const promosQuery = useQuery({
    queryKey: ['promos'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/promo/available');
        return (data.data ?? data) as any[];
      } catch (error: any) {
        if (error?.response?.status === 404) return [];
        throw error;
      }
    },
  });

  const validatePromo = useMutation({
    mutationFn: async (promoCode: string) => {
      const { data } = await api.post('/promo/validate', { code: promoCode.trim().toUpperCase() });
      return data.data ?? data;
    },
    onSuccess: (promo) => {
      setValidated(promo);
      Toast.show({ type: 'success', text1: 'Promo is valid' });
    },
    onError: (error: any) => {
      setValidated(null);
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Invalid or expired promo' });
    },
  });

  const submitCode = () => {
    const next = code.trim().toUpperCase();
    if (!next) return;
    setCode(next);
    validatePromo.mutate(next);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Promos" subtitle="Find and verify savings" />
      <FlatList
        data={promosQuery.data ?? []}
        keyExtractor={(item) => item.id ?? item.code}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        ListHeaderComponent={
          <View>
            <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
              <View style={{ position: 'absolute', right: -46, top: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(10,185,87,0.18)' }} />
              <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Promo vault</Text>
              <Text style={{ color: '#fff', fontSize: 29, fontWeight: '900', letterSpacing: -0.8, marginTop: 6 }}>Unlock a better fare.</Text>
              <Text style={{ color: '#D1D5DB', fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 10 }}>
                Verify a code here, then use the same code when creating a delivery.
              </Text>
            </View>

            <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#fff', padding: 14, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 10 }}>Check a code</Text>
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <TextInput
                  value={code}
                  onChangeText={(value) => { setCode(value.toUpperCase()); setValidated(null); }}
                  placeholder="RIDERGUY"
                  placeholderTextColor={colors.subtle}
                  autoCapitalize="characters"
                  style={{ flex: 1, height: 50, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF2F7', paddingHorizontal: 14, color: colors.ink, fontSize: 14, fontWeight: '900' }}
                />
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={submitCode}
                  disabled={!code.trim() || validatePromo.isPending}
                  style={{ width: 54, height: 50, borderRadius: 16, backgroundColor: code.trim() ? colors.brand : '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}
                >
                  {validatePromo.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark" size={22} color="#fff" />}
                </TouchableOpacity>
              </View>
              {!!validated && (
                <View style={{ marginTop: 12, borderRadius: 16, backgroundColor: colors.brandSoft, padding: 12, flexDirection: 'row', gap: 10 }}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.brandDark} />
                  <Text style={{ flex: 1, color: colors.brandDark, fontSize: 12, lineHeight: 18, fontWeight: '800' }}>
                    {validated.code} is ready. {validated.description ?? 'Apply it on your next delivery.'}
                  </Text>
                </View>
              )}
            </View>

            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 20, marginBottom: 10 }}>Available Offers</Text>
          </View>
        }
        ListEmptyComponent={
          promosQuery.isLoading ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 40 }} />
          ) : (
            <EmptyState icon="pricetag-outline" title="No public promos right now" body="You can still verify a private code above." />
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => { setCode(item.code); validatePromo.mutate(item.code); }}
            style={{ borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1.5, borderColor: colors.brandSoft, borderStyle: 'dashed', marginBottom: 12, ...shadow.card }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.brandDark, fontSize: 19, fontWeight: '900', letterSpacing: 1.4 }}>{item.code}</Text>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800', lineHeight: 18, marginTop: 5 }}>{item.description ?? 'Use this offer on an eligible delivery.'}</Text>
              </View>
              <View style={{ borderRadius: 999, backgroundColor: colors.brandSoft, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: colors.brandDark, fontSize: 11, fontWeight: '900' }}>{discountLabel(item)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              {!!item.validUntil && (
                <View style={{ borderRadius: 999, backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900' }}>Ends {new Date(item.validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
                </View>
              )}
              {!!item.forNewUsersOnly && (
                <View style={{ borderRadius: 999, backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: '#92400E', fontSize: 10, fontWeight: '900' }}>New clients</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
