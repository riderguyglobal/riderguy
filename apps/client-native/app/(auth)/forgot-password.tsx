import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { forgotPassword, getAuthErrorMessage } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { colors, shadow } from '@/design/client';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      Toast.show({ type: 'success', text1: 'Reset email sent', text2: 'Check your inbox for the secure link.' });
      router.back();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: getAuthErrorMessage(error, 'Could not send reset email') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </TouchableOpacity>

          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 22, overflow: 'hidden', ...shadow.float }}>
              <View style={{ position: 'absolute', right: -46, top: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(10,185,87,0.18)' }} />
              <View style={{ width: 58, height: 58, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="mail-outline" size={27} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 18 }}>Reset password</Text>
              <Text style={{ color: '#D1D5DB', fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 8 }}>
                Enter the email on your account and we will send a secure reset link.
              </Text>
            </View>

            <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
              <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 7 }}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.subtle}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ height: 52, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF2F7', paddingHorizontal: 14, color: colors.ink, fontSize: 14, fontWeight: '800' }}
              />
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={handleReset}
                disabled={!email.trim() || loading}
                style={{ marginTop: 14, height: 54, borderRadius: 18, backgroundColor: email.trim() && !loading ? colors.brand : '#D1D5DB', alignItems: 'center', justifyContent: 'center', ...(!email.trim() || loading ? {} : shadow.brand) }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Send Reset Link</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
