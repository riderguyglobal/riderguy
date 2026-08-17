import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuth, useAuthStore } from '@riderguy/auth-native';
import { ScreenHeader } from '@/components/client-ui';
import { colors, shadow } from '@/design/client';

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        editable={editable}
        placeholderTextColor={colors.subtle}
        style={{
          height: 52,
          borderRadius: 16,
          backgroundColor: editable ? '#F8FAFC' : '#F3F4F6',
          borderWidth: 1,
          borderColor: '#EEF2F7',
          paddingHorizontal: 14,
          color: editable ? colors.ink : colors.muted,
          fontSize: 14,
          fontWeight: '800',
        }}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const { api, user } = useAuth();
  const { setUser } = useAuthStore();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/users/profile');
      return data.data ?? data;
    },
  });

  useEffect(() => {
    const profile = profileQuery.data ?? user;
    if (!profile) return;
    setFirstName(profile.firstName ?? '');
    setLastName(profile.lastName ?? '');
    setEmail(profile.email ?? '');
  }, [profileQuery.data, user]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch('/users/profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
      });
      return data.data ?? data;
    },
    onSuccess: (updated) => {
      setUser({ ...(user as any), ...updated });
      Toast.show({ type: 'success', text1: 'Profile updated' });
    },
    onError: (error: any) => {
      Toast.show({ type: 'error', text1: error?.response?.data?.error?.message ?? 'Update failed' });
    },
  });

  const profile = profileQuery.data ?? user;
  const initials = useMemo(() => `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.trim().toUpperCase() || 'RG', [firstName, lastName]);
  const canSave = !!firstName.trim() && !!lastName.trim() && !updateProfile.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ScreenHeader title="Profile" subtitle="Your client identity" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
          <View style={{ position: 'absolute', right: -42, top: -38, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(10,185,87,0.18)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 72, height: 72, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.14)' }}>
              {profileQuery.isLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 23, fontWeight: '900' }}>{initials}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 }}>{firstName || 'First'} {lastName || 'Last'}</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '700', marginTop: 4 }}>{profile?.phone ?? 'Phone not set'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <View style={{ flex: 1, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', padding: 12 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Role</Text>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 4 }}>{profile?.role?.replace(/_/g, ' ') ?? 'Client'}</Text>
            </View>
            <View style={{ flex: 1, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', padding: 12 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>Status</Text>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 4 }}>{profile?.status?.replace(/_/g, ' ') ?? 'Active'}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
          <Field label="First name" value={firstName} onChangeText={setFirstName} />
          <Field label="Last name" value={lastName} onChangeText={setLastName} />
          <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <Field label="Phone number" value={profile?.phone ?? 'Not set'} editable={false} keyboardType="phone-pad" />
          <View style={{ borderRadius: 16, backgroundColor: '#F8FAFC', padding: 12, flexDirection: 'row', gap: 10 }}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.brandDark} />
            <Text style={{ flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '700' }}>
              Phone changes are handled by support so delivery verification remains secure.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => updateProfile.mutate()}
          disabled={!canSave}
          style={{ marginTop: 16, height: 56, borderRadius: 18, backgroundColor: canSave ? colors.brand : '#D1D5DB', alignItems: 'center', justifyContent: 'center', ...(!canSave ? {} : shadow.brand) }}
        >
          {updateProfile.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Save Profile</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
