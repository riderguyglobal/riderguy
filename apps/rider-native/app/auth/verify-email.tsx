import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAuthErrorMessage, verifyEmail } from '@riderguy/auth-native';
import { riderColors } from '@/lib/rider-design';

function readToken(value: unknown) {
  return Array.isArray(value) ? value[0] : typeof value === 'string' ? value : '';
}

export default function RiderVerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = readToken(params.token);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Your rider email has been verified.');
      })
      .catch((error) => {
        setStatus('error');
        setMessage(getAuthErrorMessage(error, 'Could not verify this email link.'));
      });
  }, [token]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.white, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {status === 'loading' ? <ActivityIndicator size="large" color={riderColors.green} /> : (
        <View style={{ width: 68, height: 68, borderRadius: 24, backgroundColor: status === 'success' ? riderColors.greenSoft : riderColors.redSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={status === 'success' ? 'checkmark-circle' : 'alert-circle'} size={34} color={status === 'success' ? riderColors.greenDark : riderColors.red} />
        </View>
      )}
      <Text style={{ color: riderColors.ink, fontSize: 21, fontWeight: '900', textAlign: 'center', marginTop: 18 }}>{status === 'success' ? 'Email verified' : status === 'error' ? 'Verification failed' : 'Please wait'}</Text>
      <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 }}>{message}</Text>
      {status !== 'loading' ? (
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 22, borderRadius: 18, backgroundColor: riderColors.green, paddingHorizontal: 22, paddingVertical: 14 }}>
          <Text style={{ color: '#fff', fontWeight: '900' }}>Continue</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}
