import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getAuthErrorMessage, resetPassword } from '@riderguy/auth-native';
import { colors, shadow } from '@/design/client';

function readToken(value: unknown) {
  return Array.isArray(value) ? value[0] : typeof value === 'string' ? value : '';
}

export default function ClientResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = readToken(params.token);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!token) {
      Toast.show({ type: 'error', text1: 'Missing reset token' });
      return;
    }
    if (password.length < 8 || password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Check your password fields' });
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      Toast.show({ type: 'success', text1: 'Password reset' });
      router.replace('/(auth)/login');
    } catch (error) {
      Toast.show({ type: 'error', text1: getAuthErrorMessage(error, 'Could not reset password') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 22, ...shadow.float }}>
            <Ionicons name="shield-checkmark" size={34} color={colors.brand} />
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 18 }}>New password</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 13, lineHeight: 20, marginTop: 8 }}>Choose a strong password for your RiderGuy account.</Text>
          </View>
          <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
            <TextInput value={password} onChangeText={setPassword} placeholder="New password" placeholderTextColor={colors.subtle} secureTextEntry style={{ height: 52, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF2F7', paddingHorizontal: 14, color: colors.ink, fontWeight: '800', marginBottom: 12 }} />
            <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor={colors.subtle} secureTextEntry style={{ height: 52, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF2F7', paddingHorizontal: 14, color: colors.ink, fontWeight: '800' }} />
            <TouchableOpacity onPress={submit} disabled={loading || !password || !confirmPassword} style={{ marginTop: 14, height: 54, borderRadius: 18, backgroundColor: password && confirmPassword && !loading ? colors.brand : '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Reset password</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
