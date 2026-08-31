import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { RiderButton, RiderCard, RiderHeader, RiderTextField, StatusPill } from '@/components/rider-ui';
import { initials, riderColors } from '@/lib/rider-design';

export default function RiderProfileScreen() {
  const { api, user } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  const { mutate, isPending } = useMutation({
    mutationFn: async () => api.patch('/users/profile', { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || undefined }),
    onSuccess: () => Toast.show({ type: 'success', text1: 'Profile updated.' }),
    onError: (error: any) => Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Update failed.' }),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <RiderHeader title="Edit profile" subtitle="Keep identity details current" canGoBack right={<StatusPill status="ONLINE" label="Profile" />} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <RiderCard dark style={{ alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 76, height: 76, borderRadius: 26, backgroundColor: '#142942', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ color: riderColors.white, fontSize: 24, fontWeight: '900' }}>{initials(user?.firstName, user?.lastName)}</Text>
          </View>
          <Text style={{ color: riderColors.white, fontSize: 18, fontWeight: '900' }}>{user?.phone ?? 'Rider account'}</Text>
          <Text style={{ color: '#9fb0c4', fontSize: 12, marginTop: 4 }}>Phone number is managed by secure support.</Text>
        </RiderCard>

        <RiderCard>
          <RiderTextField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
          <RiderTextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
          <RiderTextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <RiderButton label="Save changes" icon="checkmark-circle" loading={isPending} disabled={!firstName.trim() || !lastName.trim()} onPress={() => mutate()} />
        </RiderCard>
      </ScrollView>
    </SafeAreaView>
  );
}
