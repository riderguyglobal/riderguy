import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@riderguy/auth-native';
import { formatCurrency } from '@riderguy/utils';
import { ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

const PRAISE_TAGS = ['Careful handling', 'Fast arrival', 'Great updates', 'Polite rider', 'Easy handoff'];
const TIP_PRESETS = [0, 5, 10, 20];

function normalizeRider(raw: any) {
  if (!raw) return null;
  const user = raw.user ?? raw;
  const firstName = typeof user.firstName === 'string' ? user.firstName.trim() : '';
  const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Your RiderGuy rider';
  const initials = `${firstName[0] ?? 'R'}${lastName[0] ?? ''}`.toUpperCase();
  return { displayName, initials };
}

export default function RateRiderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tipAmount, setTipAmount] = useState(0);
  const { api } = useAuth();
  const qc = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data ?? data;
    },
  });

  const submitRating = useMutation({
    mutationFn: async () => {
      const details = [review.trim(), tags.length ? `Highlights: ${tags.join(', ')}` : ''].filter(Boolean).join('\n\n');
      await api.post(`/orders/${id}/rate`, {
        rating,
        review: details || undefined,
        tipAmount,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      Toast.show({ type: 'success', text1: 'Thanks for the feedback' });
      router.back();
    },
    onError: (error: any) => {
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Could not submit rating' });
    },
  });

  const order = orderQuery.data;
  const rider = useMemo(() => normalizeRider(order?.rider ?? order?.assignedRider), [order]);

  const toggleTag = (tag: string) => {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Rate Delivery" subtitle="Close the loop with useful feedback" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, alignItems: 'center', overflow: 'hidden', ...shadow.float }}>
          <View style={{ position: 'absolute', left: -42, top: -38, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(10,185,87,0.14)' }} />
          <View style={{ width: 82, height: 82, borderRadius: 32, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.18)' }}>
            {orderQuery.isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{rider?.initials ?? 'R'}</Text>}
          </View>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 14 }}>
            {rider?.displayName ?? 'Your RiderGuy rider'}
          </Text>
          <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' }}>
            Your rating helps keep the best riders visible.
          </Text>
        </View>

        <View style={{ marginTop: 16, borderRadius: 24, backgroundColor: '#fff', padding: 18, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'center' }}>How did it feel?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} activeOpacity={0.75} onPress={() => setRating(star)} style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: star <= rating ? '#FFFBEB' : '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: star <= rating ? '#FDE68A' : '#EEF2F7' }}>
                <Ionicons name={star <= rating ? 'star' : 'star-outline'} size={27} color={star <= rating ? colors.amber : '#D1D5DB'} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 12 }}>
            {rating === 0 ? 'Tap a star to begin' : rating < 4 ? 'Tell us what could improve' : 'Nice, what stood out?'}
          </Text>
        </View>

        <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900' }}>Highlights</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {PRAISE_TAGS.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <TouchableOpacity key={tag} onPress={() => toggleTag(tag)} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: selected ? colors.brandSoft : '#F8FAFC', borderWidth: 1, borderColor: selected ? colors.brand : '#EEF2F7' }}>
                  <Text style={{ color: selected ? colors.brandDark : colors.text, fontSize: 11, fontWeight: '900' }}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900' }}>Optional tip</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {TIP_PRESETS.map((amount) => (
              <TouchableOpacity key={amount} onPress={() => setTipAmount(amount)} style={{ flex: 1, height: 42, borderRadius: 15, backgroundColor: tipAmount === amount ? colors.ink : '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tipAmount === amount ? colors.ink : '#EEF2F7' }}>
                <Text style={{ color: tipAmount === amount ? '#fff' : colors.ink, fontSize: 12, fontWeight: '900' }}>
                  {amount === 0 ? 'None' : formatCurrency(amount, 'GHS')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 10 }}>Private note</Text>
          <TextInput
            value={review}
            onChangeText={setReview}
            placeholder="Share details the operations team should know..."
            placeholderTextColor={colors.subtle}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 112, borderRadius: 18, backgroundColor: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '700' }}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => submitRating.mutate()}
          disabled={rating === 0 || submitRating.isPending}
          style={{ marginTop: 16, height: 56, borderRadius: 18, backgroundColor: rating === 0 || submitRating.isPending ? '#D1D5DB' : colors.brand, alignItems: 'center', justifyContent: 'center', ...((rating === 0 || submitRating.isPending) ? {} : shadow.brand) }}
        >
          {submitRating.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Submit Rating</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
