import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuthErrorMessage, resetPassword } from '@riderguy/auth-native';
import { IconButton, RiderButton, RiderCard, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

function readToken(value: unknown) {
  return Array.isArray(value) ? value[0] : typeof value === 'string' ? value : '';
}

export default function RiderResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = readToken(params.token);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!token) {
      Alert.alert('Missing token', 'Use the reset link from your email.');
      return;
    }
    if (password.length < 8 || password !== confirmPassword) {
      Alert.alert('Password issue', 'Enter matching passwords with at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      Alert.alert('Password reset', 'You can now sign in.', [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]);
    } catch (error) {
      Alert.alert('Reset failed', getAuthErrorMessage(error, 'Could not reset password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 18, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={{ position: 'absolute', top: 18, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between' }}>
            <IconButton icon="arrow-back" onPress={() => router.back()} />
            <StatusPill status="PENDING" label="Password" />
          </View>
          <RiderCard>
            <Text style={{ color: riderColors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>New password</Text>
            <Text style={{ color: riderColors.ink, fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 6, marginBottom: 16 }}>Secure the account again.</Text>
            <TextInput value={password} onChangeText={setPassword} placeholder="New password" placeholderTextColor={riderColors.soft} secureTextEntry style={{ minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: riderColors.line, backgroundColor: riderColors.white, paddingHorizontal: 14, color: riderColors.ink, fontWeight: '700', marginBottom: 12 }} />
            <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor={riderColors.soft} secureTextEntry style={{ minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: riderColors.line, backgroundColor: riderColors.white, paddingHorizontal: 14, color: riderColors.ink, fontWeight: '700' }} />
            <RiderButton label="Reset password" icon="shield-checkmark" loading={loading} disabled={!password || !confirmPassword} onPress={submit} style={{ marginTop: 14 }} />
          </RiderCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
