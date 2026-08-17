import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { forgotPassword, getAuthErrorMessage } from '@riderguy/auth-native';
import { IconButton, RiderButton, RiderCard, RiderTextField, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

export default function RiderForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      Alert.alert('Check your email', 'If an account exists, a reset link has been sent.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error) {
      Alert.alert('Reset failed', getAuthErrorMessage(error, 'Could not send reset email.'));
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
            <Text style={{ color: riderColors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>Reset password</Text>
            <Text style={{ color: riderColors.ink, fontSize: 28, lineHeight: 33, fontWeight: '900', marginTop: 6, marginBottom: 16 }}>Send a secure reset link.</Text>
            <RiderTextField label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <RiderButton label="Send reset link" icon="mail" loading={loading} disabled={!email.trim()} onPress={submit} />
          </RiderCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
