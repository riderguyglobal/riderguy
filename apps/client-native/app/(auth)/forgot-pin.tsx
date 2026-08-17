import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAuthErrorMessage, isSixDigitCode, normalizePhoneNumber, requestOtp as requestAuthOtp, resetPinWithOtp } from '@riderguy/auth-native';
import Toast from 'react-native-toast-message';
import { colors, shadow } from '@/design/client';

type Step = 'phone' | 'otp' | 'pin';

function CodeBoxes({ value, onChange, length = 6, secure = false }: { value: string; onChange: (value: string) => void; length?: number; secure?: boolean }) {
  const ref = useRef<TextInput>(null);
  return (
    <TouchableOpacity activeOpacity={1} onPress={() => ref.current?.focus()}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 10 }}>
        {Array.from({ length }).map((_, index) => {
          const filled = !!value[index];
          return (
            <View key={index} style={{ width: 43, height: 52, borderRadius: 16, backgroundColor: filled ? colors.brandSoft : '#F8FAFC', borderWidth: 1.5, borderColor: filled ? colors.brand : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>{filled ? secure ? '*' : value[index] : ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
    </TouchableOpacity>
  );
}

export default function ForgotPinScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const requestOtp = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      await requestAuthOtp(normalizePhoneNumber(phone), 'PASSWORD_RESET');
      setStep('otp');
      Toast.show({ type: 'success', text1: 'OTP sent' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: getAuthErrorMessage(error, 'Could not send OTP') });
    } finally {
      setLoading(false);
    }
  };

  const resetPin = async () => {
    if (!isSixDigitCode(otp) || !isSixDigitCode(newPin) || !isSixDigitCode(confirmPin)) return;
    if (newPin !== confirmPin) {
      Toast.show({ type: 'error', text1: 'PINs do not match' });
      setConfirmPin('');
      return;
    }
    setLoading(true);
    try {
      await resetPinWithOtp(normalizePhoneNumber(phone), otp, newPin);
      Toast.show({ type: 'success', text1: 'PIN reset' });
      router.back();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: getAuthErrorMessage(error, 'Could not reset PIN') });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 'pin') setStep('otp');
    else if (step === 'otp') setStep('phone');
    else router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={goBack} style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </TouchableOpacity>

          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 22, overflow: 'hidden', ...shadow.float }}>
              <View style={{ position: 'absolute', right: -46, top: -44, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(245,158,11,0.20)' }} />
              <View style={{ width: 58, height: 58, borderRadius: 22, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="key-outline" size={27} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 18 }}>Reset PIN</Text>
              <Text style={{ color: '#D1D5DB', fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 8 }}>
                Verify your phone number, then choose a fresh PIN for quick sign-in.
              </Text>
            </View>

            <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#fff', padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
              {step === 'phone' && (
                <>
                  <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 7 }}>Phone number</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+233 XX XXX XXXX"
                    placeholderTextColor={colors.subtle}
                    keyboardType="phone-pad"
                    style={{ height: 52, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#EEF2F7', paddingHorizontal: 14, color: colors.ink, fontSize: 14, fontWeight: '800' }}
                  />
                  <TouchableOpacity onPress={requestOtp} disabled={!phone.trim() || loading} style={{ marginTop: 14, height: 54, borderRadius: 18, backgroundColor: phone.trim() && !loading ? colors.brand : '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Send OTP</Text>}
                  </TouchableOpacity>
                </>
              )}

              {step === 'otp' && (
                <>
                  <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'center' }}>Enter the code sent to {phone}</Text>
                  <CodeBoxes value={otp} onChange={(value) => { setOtp(value); if (value.length === 6) setStep('pin'); }} />
                  <TouchableOpacity onPress={() => setStep('pin')} disabled={otp.length < 6} style={{ marginTop: 10, height: 54, borderRadius: 18, backgroundColor: otp.length === 6 ? colors.brand : '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Continue</Text>
                  </TouchableOpacity>
                </>
              )}

              {step === 'pin' && (
                <>
                  <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'center' }}>Choose a new PIN</Text>
                  <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 4 }}>Use exactly 6 digits.</Text>
                  <CodeBoxes value={newPin} onChange={setNewPin} length={6} secure />
                  <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'center', marginTop: 12 }}>Confirm PIN</Text>
                  <CodeBoxes value={confirmPin} onChange={setConfirmPin} length={6} secure />
                  <TouchableOpacity onPress={resetPin} disabled={!isSixDigitCode(newPin) || !isSixDigitCode(confirmPin) || loading} style={{ marginTop: 10, height: 54, borderRadius: 18, backgroundColor: isSixDigitCode(newPin) && isSixDigitCode(confirmPin) && !loading ? colors.brand : '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>Reset PIN</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
