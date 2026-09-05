import { useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useAuthStore, type AuthUser } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { RiderButton, RiderCard, RiderHeader, RiderTextField } from '@/components/rider-ui';
import { initials, riderColors, riderFonts, riderShadow } from '@/lib/rider-design';
import { riderContactPhone } from '@/lib/rider-contact';

type ProfileUpdateResponse = {
  user: Partial<AuthUser> & Pick<AuthUser, 'id'>;
  emailVerificationRequired?: boolean;
  emailVerificationRequested?: boolean;
  emailVerificationRequestFailed?: boolean;
};

export default function RiderProfileScreen() {
  const { api, user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  const mergeUser = (updates: Partial<AuthUser>) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    setUser({ ...currentUser, ...updates });
  };

  const { mutate: updateProfile, isPending: profilePending } = useMutation({
    mutationFn: async () => {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await api.patch('/users/profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      });
      return {
        user: response.data.data ?? response.data,
        ...(response.data.meta ?? {}),
      } as ProfileUpdateResponse;
    },
    onSuccess: async (result) => {
      mergeUser(result.user);
      setFirstName(result.user.firstName ?? firstName.trim());
      setLastName(result.user.lastName ?? lastName.trim());
      setEmail((result.user.email ?? email).trim().toLowerCase());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['rider-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['rider-asset-financing-interest'] }),
      ]);
      if (result.emailVerificationRequestFailed) {
        Toast.show({
          type: 'info',
          text1: 'Profile saved',
          text2: 'Email verification could not be sent yet. Please retry later.',
        });
      } else if (result.emailVerificationRequired) {
        Toast.show({
          type: 'success',
          text1: 'Profile saved',
          text2: result.emailVerificationRequested
            ? 'Check your inbox to verify the updated email.'
            : 'Your updated email still needs verification.',
        });
      } else {
        Toast.show({ type: 'success', text1: 'Profile updated.' });
      }
    },
    onError: (error: any) =>
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.error?.message ?? error?.message ?? 'Update failed.',
      }),
  });

  const { mutate: uploadAvatar, isPending: avatarPending } = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      const form = new FormData();
      form.append('avatar', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'rider-avatar.jpg',
      } as any);
      const response = await api.post('/users/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return (response.data.data ?? response.data) as { id: string; avatarUrl: string };
    },
    onSuccess: (result) => {
      mergeUser({ avatarUrl: result.avatarUrl });
      setLocalAvatar(result.avatarUrl);
      Toast.show({ type: 'success', text1: 'Profile photo updated.' });
    },
    onError: (error: any) => {
      setLocalAvatar(null);
      Toast.show({
        type: 'error',
        text1: error?.response?.data?.error?.message ?? 'Photo upload failed.',
      });
    },
  });

  const chooseAvatar = async () => {
    if (profilePending || avatarPending) return;
    if (Platform.OS === 'ios') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Toast.show({
          type: 'info',
          text1: 'Photo permission needed',
          text2: 'Allow photo access to change your RiderGuy profile picture.',
        });
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.86,
      allowsEditing: true,
      aspect: [1, 1],
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    setLocalAvatar(asset.uri);
    uploadAvatar(asset);
  };

  const avatarUri = localAvatar ?? user?.avatarUrl ?? null;
  const verifiedPhone = riderContactPhone(user?.phone);
  const normalizedEmail = email.trim().toLowerCase();
  const originalEmail = (user?.email ?? '').trim().toLowerCase();
  const emailRemovalAttempt = Boolean(originalEmail) && !normalizedEmail;
  const emailValid = !normalizedEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const hasChanges =
    firstName.trim() !== (user?.firstName ?? '') ||
    lastName.trim() !== (user?.lastName ?? '') ||
    normalizedEmail !== originalEmail;

  return (
    <SafeAreaView style={styles.safeArea}>
      <RiderHeader title="Edit profile" subtitle="Keep your RiderGuy identity current" canGoBack />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarCard}>
          <View style={styles.avatarGlow} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Choose a new profile photo"
            activeOpacity={0.84}
            disabled={avatarPending || profilePending}
            onPress={chooseAvatar}
            style={styles.avatarWrap}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} resizeMode="cover" style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>
                  {initials(user?.firstName, user?.lastName)}
                </Text>
              </View>
            )}
            <View style={styles.cameraButton}>
              <Ionicons name="camera-outline" size={18} color={riderColors.greenDark} />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.avatarTitle}>Your profile photo</Text>
            <Text style={styles.avatarBody}>
              A clear, current photo helps customers recognise you at pickup and drop-off.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={avatarPending || profilePending}
              activeOpacity={0.82}
              onPress={chooseAvatar}
              style={styles.photoAction}
            >
              <Text style={styles.photoActionText}>
                {avatarPending ? 'Uploading…' : 'Change photo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <RiderCard style={styles.formCard}>
          <Text style={styles.sectionTitle}>Personal information</Text>
          <Text style={styles.sectionBody}>
            Use the same name shown on your RiderGuy verification documents.
          </Text>
          <View style={styles.fields}>
            <RiderTextField
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
            />
            <RiderTextField
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
            />
            <RiderTextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            {emailRemovalAttempt ? (
              <Text style={styles.fieldWarning}>
                An existing email cannot be removed here. Enter the current or a replacement email.
              </Text>
            ) : null}
          </View>
          <View style={styles.phoneNotice}>
            <Ionicons name="lock-closed-outline" size={18} color={riderColors.greenDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.phoneLabel}>
                {verifiedPhone ? 'Verified phone number' : 'Phone number'}
              </Text>
              <Text style={styles.phoneValue}>
                {verifiedPhone ?? 'No verified phone number on file'}
              </Text>
            </View>
          </View>
          <RiderButton
            label="Save changes"
            icon="checkmark-circle"
            loading={profilePending}
            disabled={
              avatarPending ||
              !firstName.trim() ||
              !lastName.trim() ||
              !emailValid ||
              emailRemovalAttempt ||
              !hasChanges
            }
            onPress={() => updateProfile()}
            style={{ marginTop: 15 }}
          />
        </RiderCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: riderColors.surface },
  content: { padding: 16, paddingBottom: 34 },
  avatarCard: {
    minHeight: 154,
    borderRadius: 18,
    backgroundColor: '#13955D',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    overflow: 'hidden',
    ...riderShadow,
  },
  avatarGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -60,
    bottom: -112,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  avatarWrap: { width: 94, height: 102, alignItems: 'center', justifyContent: 'center' },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: riderColors.white,
    backgroundColor: riderColors.greenSoft,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: riderColors.white,
    backgroundColor: '#087A4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: riderColors.white,
    fontSize: 26,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  cameraButton: {
    position: 'absolute',
    right: -1,
    bottom: 1,
    width: 35,
    height: 35,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#DDF6E9',
    backgroundColor: riderColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTitle: {
    color: riderColors.white,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  avatarBody: {
    color: '#DDF6E9',
    fontSize: 10.5,
    lineHeight: 16,
    fontFamily: riderFonts.regular,
    marginTop: 4,
  },
  photoAction: {
    alignSelf: 'flex-start',
    minHeight: 31,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  photoActionText: {
    color: riderColors.white,
    fontSize: 10.5,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
  },
  formCard: { marginTop: 14 },
  sectionTitle: {
    color: riderColors.ink,
    fontSize: 17,
    fontFamily: riderFonts.bold,
    fontWeight: '900',
  },
  sectionBody: {
    color: riderColors.muted,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: riderFonts.regular,
    marginTop: 3,
  },
  fields: { marginTop: 16 },
  fieldWarning: {
    color: riderColors.red,
    fontSize: 10.5,
    lineHeight: 15,
    fontFamily: riderFonts.medium,
    marginTop: -7,
    marginBottom: 12,
  },
  phoneNotice: {
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: riderColors.greenMist,
    borderWidth: 1,
    borderColor: '#DCEFE5',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phoneLabel: {
    color: riderColors.muted,
    fontSize: 9.5,
    fontFamily: riderFonts.medium,
  },
  phoneValue: {
    color: riderColors.ink,
    fontSize: 12,
    fontFamily: riderFonts.semibold,
    fontWeight: '800',
    marginTop: 2,
  },
});
