import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  forgotPassword,
  getAuthErrorMessage,
  getSecurityQuestion,
  isSixDigitCode,
  normalizeGhanaCard,
  normalizePhoneNumber,
  requestRecovery,
  resetPinWithRecoveryToken,
  verifyRecoveryOtp,
  verifySecurityAnswer,
  type RecoveryMethod,
} from '@riderguy/auth-native';
import { IconButton, PinBoxes, RiderButton, RiderCard, RiderTextField, SegmentedControl, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

type Step = 'select' | 'otp' | 'security' | 'reset-pin' | 'email-sent' | 'success';

export default function RiderRecoveryScreen() {
  const [method, setMethod] = useState<RecoveryMethod>('phone');
  const [step, setStep] = useState<Step>('select');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ghanaCard, setGhanaCard] = useState('');
  const [otp, setOtp] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const startRecovery = async () => {
    setLoading(true);
    try {
      if (method === 'phone') {
        const normalized = normalizePhoneNumber(phone);
        await requestRecovery('phone', normalized);
        setOtp('');
        setStep('otp');
      } else if (method === 'email') {
        await forgotPassword(email.trim().toLowerCase());
        setStep('email-sent');
      } else {
        const card = normalizeGhanaCard(ghanaCard);
        const result = await getSecurityQuestion(card).catch(() => requestRecovery('ghanacard', card));
        const question = 'question' in result ? result.question : result.securityQuestion;
        setSecurityQuestion(question ?? 'Answer your saved security question.');
        setStep('security');
      }
    } catch (error) {
      Alert.alert('Recovery failed', getAuthErrorMessage(error, 'Could not start account recovery.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpStep = async (code = otp) => {
    if (!isSixDigitCode(code)) return;
    setLoading(true);
    try {
      const result = await verifyRecoveryOtp(normalizePhoneNumber(phone), code);
      setRecoveryToken(result.recoveryToken ?? result.token ?? '');
      setStep('reset-pin');
    } catch (error) {
      setOtp('');
      Alert.alert('Invalid code', getAuthErrorMessage(error, 'The code is incorrect or expired.'));
    } finally {
      setLoading(false);
    }
  };

  const verifySecurityStep = async () => {
    if (!securityAnswer.trim()) return;
    setLoading(true);
    try {
      const result = await verifySecurityAnswer(normalizeGhanaCard(ghanaCard), securityAnswer.trim());
      setRecoveryToken(result.recoveryToken ?? result.token ?? '');
      setStep('reset-pin');
    } catch (error) {
      Alert.alert('Answer failed', getAuthErrorMessage(error, 'The security answer was not accepted.'));
    } finally {
      setLoading(false);
    }
  };

  const resetPin = async () => {
    if (!isSixDigitCode(pin) || pin !== confirmPin || !recoveryToken) {
      Alert.alert('PIN issue', 'Enter and confirm a matching 6-digit PIN.');
      return;
    }
    setLoading(true);
    try {
      await resetPinWithRecoveryToken(pin, recoveryToken);
      setStep('success');
    } catch (error) {
      Alert.alert('Reset failed', getAuthErrorMessage(error, 'Could not reset your PIN.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <IconButton icon="arrow-back" onPress={() => step === 'select' ? router.back() : setStep('select')} />
            <StatusPill status="PENDING" label="Recovery" />
          </View>

          <View style={{ marginBottom: 18 }}>
            <Text style={{ color: riderColors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>Account recovery</Text>
            <Text style={{ color: riderColors.ink, fontSize: 31, lineHeight: 36, fontWeight: '900', marginTop: 6 }}>Get back into rider mode.</Text>
            <Text style={{ color: riderColors.muted, fontSize: 14, lineHeight: 21, marginTop: 9 }}>Recover with phone OTP, email reset, or Ghana Card security answer.</Text>
          </View>

          <RiderCard>
            {step === 'select' ? (
              <>
                <SegmentedControl
                  value={method}
                  onChange={setMethod}
                  options={[
                    { label: 'Phone', value: 'phone' },
                    { label: 'Email', value: 'email' },
                    { label: 'Ghana', value: 'ghanacard' },
                  ]}
                />
                <View style={{ height: 14 }} />
                {method === 'phone' ? <RiderTextField label="Phone number" placeholder="+233 XX XXX XXXX" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /> : null}
                {method === 'email' ? <RiderTextField label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /> : null}
                {method === 'ghanacard' ? <RiderTextField label="Ghana Card" placeholder="GHA-XXXXXXXXX-X" value={ghanaCard} onChangeText={setGhanaCard} autoCapitalize="characters" /> : null}
                <RiderButton label={method === 'email' ? 'Send password reset link' : 'Start recovery'} icon="shield-checkmark" loading={loading} disabled={method === 'phone' ? !phone.trim() : method === 'email' ? !email.trim() : !ghanaCard.trim()} onPress={startRecovery} />
              </>
            ) : null}

            {step === 'otp' ? (
              <>
                <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>Enter the code</Text>
                <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4 }}>Sent to {normalizePhoneNumber(phone)}</Text>
                <PinBoxes value={otp} onChange={(value) => { setOtp(value); if (value.length === 6) verifyOtpStep(value); }} />
                <RiderButton label="Verify code" loading={loading} disabled={!isSixDigitCode(otp)} onPress={() => verifyOtpStep()} />
              </>
            ) : null}

            {step === 'security' ? (
              <>
                <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>Security question</Text>
                <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4, marginBottom: 14 }}>{securityQuestion}</Text>
                <RiderTextField label="Answer" placeholder="Your answer" value={securityAnswer} onChangeText={setSecurityAnswer} secureTextEntry />
                <RiderButton label="Verify answer" icon="checkmark-circle" loading={loading} disabled={securityAnswer.trim().length < 2} onPress={verifySecurityStep} />
              </>
            ) : null}

            {step === 'reset-pin' ? (
              <>
                <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>Create a new PIN</Text>
                <Text style={{ color: riderColors.muted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>Exactly 6 digits.</Text>
                <PinBoxes value={pin} onChange={setPin} secure />
                <Text style={{ color: riderColors.muted, fontWeight: '900', marginTop: 12, marginBottom: 6, textAlign: 'center' }}>Confirm PIN</Text>
                <PinBoxes value={confirmPin} onChange={setConfirmPin} secure />
                <RiderButton label="Reset PIN" icon="keypad" loading={loading} disabled={!isSixDigitCode(pin) || !isSixDigitCode(confirmPin)} onPress={resetPin} />
              </>
            ) : null}

            {step === 'email-sent' ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>Check your email</Text>
                <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 }}>If an account exists, a password reset link has been sent.</Text>
                <RiderButton label="Back to login" style={{ alignSelf: 'stretch', marginTop: 18 }} onPress={() => router.replace('/(auth)/login')} />
              </View>
            ) : null}

            {step === 'success' ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ color: riderColors.ink, fontSize: 20, fontWeight: '900' }}>PIN reset</Text>
                <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 }}>Your new rider PIN is ready.</Text>
                <RiderButton label="Sign in" style={{ alignSelf: 'stretch', marginTop: 18 }} onPress={() => router.replace('/(auth)/login')} />
              </View>
            ) : null}
          </RiderCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
