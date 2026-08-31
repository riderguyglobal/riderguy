import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import {
  checkAuthMethods,
  confirmLoginEmail,
  getAuthErrorMessage,
  loginWithGhanaCard,
  loginWithOtp,
  loginWithPassword,
  loginWithPin,
  normalizeGhanaCard,
  normalizePhoneNumber,
  requestOtp,
  resendLoginEmailConfirmation,
  signInWithGoogle,
} from '@riderguy/auth-native';
import { IconButton, PinBoxes, RiderButton, RiderCard, RiderTextField, SegmentedControl, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

type Method = 'phone' | 'email' | 'ghanacard';
type Stage = 'input' | 'method-select' | 'otp' | 'pin' | 'email-confirm';

export default function RiderLoginScreen() {
  const [method, setMethod] = useState<Method>('email');
  const [stage, setStage] = useState<Stage>('input');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ghanaCard, setGhanaCard] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [emailConfirmCode, setEmailConfirmCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const activeIdentifier = method === 'phone'
    ? normalizePhoneNumber(phone)
    : method === 'email'
      ? email.trim().toLowerCase()
      : normalizeGhanaCard(ghanaCard);

  const resetToInput = () => {
    setStage('input');
    setOtp('');
    setPin('');
  };

  const startCooldown = () => {
    setCooldown(60);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      Alert.alert('Ghana phone required', 'Enter a valid Ghana number starting with +233 or 0.');
      return;
    }
    setLoading(true);
    try {
      await requestOtp(normalized, 'LOGIN');
      setStage('otp');
      setOtp('');
      startCooldown();
    } catch (error) {
      Alert.alert('OTP failed', getAuthErrorMessage(error, 'Could not send a code to this number.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckMethods = async () => {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      Alert.alert('Ghana phone required', 'Enter a valid Ghana number starting with +233 or 0.');
      return;
    }
    setLoading(true);
    try {
      const methods = await checkAuthMethods(normalized);
      if (methods.pin) setStage('method-select');
      else await sendOtp();
    } catch {
      await sendOtp();
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!activeIdentifier || !password) return;
    setLoading(true);
    try {
      let requiresEmailConfirmation: boolean | undefined;
      let userId: string | undefined;
      if (method === 'ghanacard') {
        const result = await loginWithGhanaCard(activeIdentifier, password, 'RIDER');
        if (result.requiresPin) {
          setPin('');
          setStage('pin');
          return;
        }
        requiresEmailConfirmation = result.requiresEmailConfirmation;
        userId = result.userId;
      } else {
        const result = await loginWithPassword(activeIdentifier, password, 'RIDER');
        requiresEmailConfirmation = result.requiresEmailConfirmation;
        userId = result.userId;
      }
      if (requiresEmailConfirmation && userId) {
        setPendingUserId(userId);
        setEmailConfirmCode('');
        setStage('email-confirm');
        startCooldown();
        return;
      }
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Sign in failed', getAuthErrorMessage(error, 'Check your details and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLogin = async (code = otp) => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const result = await loginWithOtp(normalizePhoneNumber(phone), code, 'RIDER');
      if (result.requiresEmailConfirmation && result.userId) {
        setPendingUserId(result.userId);
        setEmailConfirmCode('');
        setStage('email-confirm');
        startCooldown();
        return;
      }
      router.replace('/(tabs)');
    } catch (error) {
      setOtp('');
      Alert.alert('Invalid code', getAuthErrorMessage(error, 'The code is incorrect or expired.'));
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (code = pin) => {
    if (code.length !== 6 || !activeIdentifier) return;
    setLoading(true);
    try {
      const result = await loginWithPin(activeIdentifier, code, 'RIDER');
      if (result.requiresEmailConfirmation && result.userId) {
        setPendingUserId(result.userId);
        setEmailConfirmCode('');
        setStage('email-confirm');
        startCooldown();
        return;
      }
      router.replace('/(tabs)');
    } catch (error) {
      setPin('');
      Alert.alert('Invalid PIN', getAuthErrorMessage(error, 'The PIN is incorrect.'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailConfirm = async (code = emailConfirmCode) => {
    if (code.length !== 6 || !pendingUserId) return;
    setLoading(true);
    try {
      await confirmLoginEmail(pendingUserId, code, 'RIDER');
      router.replace('/(tabs)');
    } catch (error) {
      setEmailConfirmCode('');
      Alert.alert('Invalid code', getAuthErrorMessage(error, 'The code is incorrect or expired.'));
    } finally {
      setLoading(false);
    }
  };

  const resendEmailConfirm = async () => {
    if (!pendingUserId) return;
    setLoading(true);
    try {
      await resendLoginEmailConfirmation(pendingUserId);
      startCooldown();
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error, 'Failed to resend the code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const webClientId = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;
    if (!webClientId) {
      Alert.alert('Google not configured', 'Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID for native Google sign-in.');
      return;
    }
    setLoading(true);
    try {
      const user = await signInWithGoogle('RIDER', webClientId);
      if (!user) return; // user cancelled the picker
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Google sign-in failed', getAuthErrorMessage(error, 'Could not complete Google sign-in.'));
    } finally {
      setLoading(false);
    }
  };

  const title =
    stage === 'otp' ? 'Verify rider access' :
    stage === 'pin' ? 'Enter rider PIN' :
    stage === 'email-confirm' ? 'Check your email' :
    'Back to the road';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
            <IconButton icon="arrow-back" onPress={stage === 'input' ? () => router.back() : resetToInput} />
            <StatusPill status={stage === 'input' ? 'OFFLINE' : 'ONLINE'} label={stage === 'input' ? 'Secure sign in' : 'Verify'} />
          </View>

          <View style={{ marginBottom: 18 }}>
            <Text style={{ color: riderColors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>Rider access</Text>
            <Text style={{ color: riderColors.ink, fontSize: 31, lineHeight: 36, fontWeight: '900', marginTop: 6 }}>{title}</Text>
            <Text style={{ color: riderColors.muted, fontSize: 14, lineHeight: 21, marginTop: 9 }}>Use phone, email, Ghana Card, Google, OTP, or your 6-digit rider PIN.</Text>
          </View>

          {stage === 'input' ? (
            <>
              <RiderCard style={{ gap: 12, marginBottom: 14 }}>
                {showMoreOptions ? (
                  <SegmentedControl
                    value={method}
                    onChange={(value) => { setMethod(value); setPassword(''); setPin(''); }}
                    options={[
                      { label: 'Email', value: 'email' },
                      { label: 'Phone', value: 'phone' },
                      { label: 'Ghana', value: 'ghanacard' },
                    ]}
                  />
                ) : null}
                {method === 'phone' ? (
                  <RiderTextField label="Phone number" placeholder="+233 XX XXX XXXX" keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={setPhone} />
                ) : null}
                {method === 'email' ? (
                  <RiderTextField label="Email address" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                ) : null}
                {method === 'ghanacard' ? (
                  <RiderTextField label="Ghana Card" placeholder="GHA-XXXXXXXXX-X" autoCapitalize="characters" value={ghanaCard} onChangeText={setGhanaCard} />
                ) : null}
                <RiderTextField label="Password" placeholder="Enter your password" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={handlePasswordLogin} />
                <RiderButton label="Sign in" icon="log-in" loading={loading} disabled={!activeIdentifier || !password} onPress={handlePasswordLogin} />
                {method === 'phone' ? (
                  <RiderButton label="Use OTP or PIN" icon="keypad" variant="light" loading={loading && !password} disabled={!activeIdentifier} onPress={handleCheckMethods} />
                ) : null}
                <RiderButton label="Continue with Google" icon="logo-google" variant="dark" loading={loading} onPress={handleGoogleLogin} />
                {!showMoreOptions ? (
                  <TouchableOpacity onPress={() => setShowMoreOptions(true)} style={{ alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: riderColors.muted, fontSize: 12, fontWeight: '800' }}>More sign-in options</Text>
                  </TouchableOpacity>
                ) : null}
              </RiderCard>
              <View style={{ alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => router.push('/(auth)/recovery')}>
                  <Text style={{ color: riderColors.greenDark, fontSize: 13, fontWeight: '900' }}>Forgot PIN or password?</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {stage === 'method-select' ? (
            <RiderCard style={{ gap: 10 }}>
              <TouchableOpacity onPress={() => setStage('pin')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: riderColors.panelAlt, padding: 13, borderWidth: 1, borderColor: riderColors.line }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="keypad" size={19} color={riderColors.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>Rider PIN</Text>
                  <Text style={{ color: riderColors.muted, fontSize: 12, marginTop: 2 }}>Unlock with your 6-digit PIN.</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={sendOtp} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: riderColors.panelAlt, padding: 13, borderWidth: 1, borderColor: riderColors.line }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: riderColors.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="chatbubble-ellipses" size={19} color={riderColors.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>SMS code</Text>
                  <Text style={{ color: riderColors.muted, fontSize: 12, marginTop: 2 }}>Send a fresh one-time code.</Text>
                </View>
              </TouchableOpacity>
            </RiderCard>
          ) : null}

          {stage === 'otp' ? (
            <RiderCard>
              <View style={{ alignItems: 'center', marginBottom: 18 }}>
                <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ionicons name="chatbox-ellipses" size={26} color={riderColors.greenDark} />
                </View>
                <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900' }}>Enter the code</Text>
                <Text style={{ color: riderColors.muted, fontSize: 13, marginTop: 4 }}>Sent to {normalizePhoneNumber(phone)}</Text>
              </View>
              <PinBoxes value={otp} onChange={(value) => { setOtp(value); if (value.length === 6) handleOtpLogin(value); }} />
              <RiderButton label="Verify and sign in" loading={loading} disabled={otp.length !== 6} onPress={() => handleOtpLogin()} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                <TouchableOpacity onPress={resetToInput}>
                  <Text style={{ color: riderColors.muted, fontWeight: '800' }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={sendOtp} disabled={cooldown > 0 || loading}>
                  <Text style={{ color: cooldown > 0 ? riderColors.soft : riderColors.greenDark, fontWeight: '900' }}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</Text>
                </TouchableOpacity>
              </View>
            </RiderCard>
          ) : null}

          {stage === 'pin' ? (
            <RiderCard>
              <View style={{ alignItems: 'center', marginBottom: 18 }}>
                <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: riderColors.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ionicons name="lock-closed" size={25} color={riderColors.blue} />
                </View>
                <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900' }}>Rider PIN</Text>
                <Text style={{ color: riderColors.muted, fontSize: 13, marginTop: 4 }}>6 digits for {activeIdentifier}</Text>
              </View>
              <PinBoxes value={pin} onChange={(value) => { setPin(value); if (value.length === 6) handlePinLogin(value); }} secure />
              <RiderButton label="Unlock" loading={loading} disabled={pin.length !== 6} onPress={() => handlePinLogin()} />
              <View style={{ alignItems: 'center', gap: 12, marginTop: 16 }}>
                {method === 'phone' ? (
                  <TouchableOpacity onPress={sendOtp}>
                    <Text style={{ color: riderColors.greenDark, fontWeight: '900' }}>Use OTP instead</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => router.push('/(auth)/recovery')}>
                  <Text style={{ color: riderColors.amber, fontWeight: '900' }}>Recover account</Text>
                </TouchableOpacity>
              </View>
            </RiderCard>
          ) : null}

          {stage === 'email-confirm' ? (
            <RiderCard>
              <View style={{ alignItems: 'center', marginBottom: 18 }}>
                <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ionicons name="mail" size={25} color={riderColors.greenDark} />
                </View>
                <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900' }}>Verify your email</Text>
                <Text style={{ color: riderColors.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>We sent a 6-digit code to the email on your account</Text>
              </View>
              <PinBoxes value={emailConfirmCode} onChange={(value) => { setEmailConfirmCode(value); if (value.length === 6) handleEmailConfirm(value); }} />
              <RiderButton label="Verify and sign in" loading={loading} disabled={emailConfirmCode.length !== 6} onPress={() => handleEmailConfirm()} />
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <TouchableOpacity onPress={resendEmailConfirm} disabled={cooldown > 0 || loading}>
                  <Text style={{ color: cooldown > 0 ? riderColors.soft : riderColors.greenDark, fontWeight: '900' }}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</Text>
                </TouchableOpacity>
              </View>
            </RiderCard>
          ) : null}

          <View style={{ alignItems: 'center', marginTop: 22 }}>
            {loading && stage !== 'input' ? <ActivityIndicator color={riderColors.green} style={{ marginBottom: 10 }} /> : null}
            <Text style={{ color: riderColors.muted, fontSize: 13 }}>
              New to RiderGuy?{' '}
              <Text onPress={() => router.push('/(auth)/register')} style={{ color: riderColors.greenDark, fontWeight: '900' }}>Create rider account</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
