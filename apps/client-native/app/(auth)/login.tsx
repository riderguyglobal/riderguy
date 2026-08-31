import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
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
  requestOtp,
  resendLoginEmailConfirmation,
  signInWithGoogle,
} from '@riderguy/auth-native';
import { colors, shadow } from '@/design/client';
import { normalizeGhanaPhoneNumber as normalizePhoneNumber } from '@/lib/ghana-phone';

type Stage = 'input' | 'method-select' | 'otp' | 'pin' | 'email-confirm';
type Mode = 'phone' | 'email' | 'ghanacard';

const hero = require('../../assets/images/auth/client-login-hero.png');

function OtpBoxes({ length = 6, value, onChange, secure = false, autoFocus = true }: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <TouchableOpacity onPress={() => ref.current?.focus()} activeOpacity={1}>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 8 }}>
        {Array.from({ length }).map((_, i) => {
          const active = value.length === i;
          const filled = !!value[i];
          return (
            <View
              key={i}
              style={{
                width: 44,
                height: 52,
                borderRadius: 13,
                borderWidth: 1.8,
                borderColor: active || filled ? colors.brandDark : '#E5E7EB',
                backgroundColor: filled ? '#F0FDF4' : '#F8FAFC',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 21, fontWeight: '800', color: colors.ink }}>
                {secure && filled ? '*' : (value[i] ?? '')}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
        autoFocus={autoFocus}
      />
    </TouchableOpacity>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}

function PrimaryButton({ onPress, disabled, loading, label }: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        height: 52,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled || loading ? '#94A3B8' : colors.brandDark,
        marginTop: 4,
        ...(disabled || loading ? {} : shadow.brand),
      }}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{label}</Text>}
    </TouchableOpacity>
  );
}

const inputStyle = {
  height: 48,
  borderRadius: 12,
  backgroundColor: '#F3F4F6',
  paddingHorizontal: 14,
  fontSize: 15,
  color: colors.ink,
};

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('email');
  const [stage, setStage] = useState<Stage>('input');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [ghanaCard, setGhanaCard] = useState('');
  const [ghanaPassword, setGhanaPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [emailConfirmCode, setEmailConfirmCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setCooldown(60);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => setCooldown((value) => {
      if (value <= 1) {
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        return 0;
      }
      return value - 1;
    }), 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const handlePasswordLogin = async () => {
    // Reviewers (and users) sometimes paste an email into the phone field, which
    // normalizePhoneNumber silently strips to an empty string, causing a false
    // "incorrect credentials" failure. Detect that case and treat it as email.
    const rawPhoneInput = phone.trim();
    const phoneFieldHasEmail = mode === 'phone' && rawPhoneInput.includes('@');
    const identifier = mode === 'email'
      ? email.trim().toLowerCase()
      : mode === 'ghanacard'
        ? normalizeGhanaCard(ghanaCard)
        : phoneFieldHasEmail
          ? rawPhoneInput.toLowerCase()
          : normalizePhoneNumber(phone);
    const pass = mode === 'email' ? emailPassword : mode === 'ghanacard' ? ghanaPassword : password;
    if (!identifier || !pass) {
      Alert.alert('', 'Enter a valid Ghana phone number (or email) and password.');
      return;
    }
    setLoading(true);
    try {
      let requiresEmailConfirmation: boolean | undefined;
      let userId: string | undefined;
      if (mode === 'ghanacard') {
        const result = await loginWithGhanaCard(identifier, pass, 'CLIENT');
        if (result.requiresPin) {
          setStage('pin');
          setPin('');
          return;
        }
        requiresEmailConfirmation = result.requiresEmailConfirmation;
        userId = result.userId;
      } else {
        const result = await loginWithPassword(identifier, pass, 'CLIENT');
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
      Alert.alert('Sign In Failed', getAuthErrorMessage(error, 'Incorrect details. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      Alert.alert('', 'Enter a valid Ghana number starting with +233 or 0.');
      return;
    }
    setLoading(true);
    try {
      await requestOtp(normalized, 'LOGIN');
      setStage('otp');
      setOtp('');
      startCooldown();
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error, 'Failed to send OTP. Check your number.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckMethods = async () => {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      Alert.alert('', 'Enter a valid Ghana number starting with +233 or 0.');
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

  const handleOtpLogin = async (code?: string) => {
    const value = code ?? otp;
    if (value.length < 6) return;
    setLoading(true);
    try {
      const result = await loginWithOtp(normalizePhoneNumber(phone), value, 'CLIENT');
      if (result.requiresEmailConfirmation && result.userId) {
        setPendingUserId(result.userId);
        setEmailConfirmCode('');
        setStage('email-confirm');
        startCooldown();
        return;
      }
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Invalid Code', getAuthErrorMessage(error, 'The code is incorrect or expired.'));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (code?: string) => {
    const value = code ?? pin;
    if (value.length < 6) return;
    const identifier = mode === 'ghanacard'
      ? normalizeGhanaCard(ghanaCard)
      : mode === 'email'
        ? email.trim().toLowerCase()
        : normalizePhoneNumber(phone);
    setLoading(true);
    try {
      const result = await loginWithPin(identifier, value, 'CLIENT');
      if (result.requiresEmailConfirmation && result.userId) {
        setPendingUserId(result.userId);
        setEmailConfirmCode('');
        setStage('email-confirm');
        startCooldown();
        return;
      }
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Invalid PIN', getAuthErrorMessage(error, 'Incorrect PIN.'));
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailConfirm = async (code?: string) => {
    const value = code ?? emailConfirmCode;
    if (value.length < 6 || !pendingUserId) return;
    setLoading(true);
    try {
      await confirmLoginEmail(pendingUserId, value, 'CLIENT');
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Invalid Code', getAuthErrorMessage(error, 'The code is incorrect or expired.'));
      setEmailConfirmCode('');
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
      const user = await signInWithGoogle('CLIENT', webClientId);
      if (!user) return; // user cancelled the picker
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Google sign-in failed', getAuthErrorMessage(error, 'Could not complete Google sign-in.'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setStage('input');
    setOtp('');
    setPin('');
  };

  const heading =
    stage === 'email-confirm' ? 'Check your email' :
    stage === 'method-select' ? 'Verify your identity' :
    stage === 'otp' ? 'Verification code' :
    stage === 'pin' ? 'Enter your PIN' :
    mode === 'ghanacard' ? 'Ghana Card Login' :
    mode === 'email' ? 'Email Login' :
    'Welcome back';

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <ImageBackground source={hero} resizeMode="cover" style={{ height: 255 }} imageStyle={{ borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 22 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => stage === 'input' ? router.back() : setStage('input')}
                  style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="arrow-back" size={18} color={colors.ink} />
                </TouchableOpacity>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '700' }}>Get a Rider</Text>
                  <Text style={{ color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: -1.5, lineHeight: 44 }}>Instantly.</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', marginTop: 5, fontSize: 13, fontWeight: '600' }}>Fast. Reliable. Secure.</Text>
                </View>
              </View>
            </SafeAreaView>
          </ImageBackground>

          <View style={{ marginTop: -26, paddingHorizontal: 20, paddingBottom: 32 }}>
            <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderRadius: 24, backgroundColor: '#fff', padding: 18, ...shadow.float }}>
              <View style={{ width: 30, height: 3, borderRadius: 999, backgroundColor: colors.brand, marginBottom: 12 }} />
              <Text style={{ fontSize: 24, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>{heading}</Text>
              <Text style={{ fontSize: 12, color: colors.subtle, marginTop: 4, marginBottom: 16 }}>
                {stage === 'input'
                  ? 'Sign in to continue your journey'
                  : stage === 'email-confirm'
                    ? 'Enter the 6-digit code we emailed to the address on your account'
                    : `Signing in as ${phone}`}
              </Text>

              {mode === 'phone' && stage === 'input' && (
                <View>
                  <View style={{ marginBottom: 11 }}>
                    <FieldLabel>Phone Number</FieldLabel>
                    <TextInput
                      style={inputStyle}
                      placeholder="+233 XX XXX XXXX"
                      placeholderTextColor="#A0AAB8"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                    />
                  </View>
                  <View style={{ marginBottom: 6 }}>
                    <FieldLabel>Password</FieldLabel>
                    <View>
                      <TextInput
                        style={[inputStyle, { paddingRight: 56 }]}
                        placeholder="Enter your password"
                        placeholderTextColor="#A0AAB8"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        onSubmitEditing={handlePasswordLogin}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                        <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: '700' }}>{showPassword ? 'Hide' : 'Show'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={{ alignSelf: 'flex-end', marginBottom: 13 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brandDark }}>Forgot password?</Text>
                  </TouchableOpacity>
                  <PrimaryButton onPress={handlePasswordLogin} loading={loading} disabled={!phone || !password} label="Log In" />
                  <TouchableOpacity
                    onPress={handleCheckMethods}
                    disabled={loading || !phone}
                    style={{ height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Sign in with OTP or PIN</Text>
                  </TouchableOpacity>
                </View>
              )}

              {mode === 'email' && stage === 'input' && (
                <View>
                  <View style={{ marginBottom: 11 }}>
                    <FieldLabel>Email Address</FieldLabel>
                    <TextInput style={inputStyle} placeholder="you@example.com" placeholderTextColor="#A0AAB8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                  </View>
                  <View style={{ marginBottom: 16 }}>
                    <FieldLabel>Password</FieldLabel>
                    <TextInput style={inputStyle} placeholder="Enter your password" placeholderTextColor="#A0AAB8" value={emailPassword} onChangeText={setEmailPassword} secureTextEntry />
                  </View>
                  <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={{ alignSelf: 'flex-end', marginBottom: 13 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brandDark }}>Forgot password?</Text>
                  </TouchableOpacity>
                  <PrimaryButton onPress={handlePasswordLogin} loading={loading} disabled={!email || !emailPassword} label="Sign In" />
                </View>
              )}

              {mode === 'ghanacard' && stage === 'input' && (
                <View>
                  <View style={{ marginBottom: 11 }}>
                    <FieldLabel>Ghana Card Number</FieldLabel>
                    <TextInput style={inputStyle} placeholder="GHA-XXXXXXXXX-X" placeholderTextColor="#A0AAB8" value={ghanaCard} onChangeText={(v) => setGhanaCard(v.toUpperCase())} autoCapitalize="characters" />
                  </View>
                  <View style={{ marginBottom: 16 }}>
                    <FieldLabel>Password</FieldLabel>
                    <TextInput style={inputStyle} placeholder="Enter your password" placeholderTextColor="#A0AAB8" value={ghanaPassword} onChangeText={setGhanaPassword} secureTextEntry />
                  </View>
                  <PrimaryButton onPress={handlePasswordLogin} loading={loading} disabled={!ghanaCard || !ghanaPassword} label="Sign In" />
                </View>
              )}

              {mode === 'phone' && stage === 'method-select' && (
                <View style={{ gap: 10 }}>
                  <TouchableOpacity onPress={() => setStage('pin')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: '#fff', padding: 13, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="key-outline" size={18} color={colors.brandDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 13 }}>Enter PIN</Text>
                      <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 2 }}>Your 6-digit security PIN</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={sendOtp} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: '#fff', padding: 13, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.brandDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 13 }}>SMS Code</Text>
                      <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 2 }}>One-time code via SMS</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
                  </TouchableOpacity>
                </View>
              )}

              {mode === 'phone' && stage === 'otp' && (
                <View>
                  <View style={{ alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
                    <Ionicons name="phone-portrait-outline" size={22} color={colors.text} />
                    <Text style={{ marginTop: 8, fontSize: 13, fontWeight: '900', color: colors.ink }}>Verification code</Text>
                    <Text style={{ marginTop: 3, fontSize: 12, color: colors.subtle }}>Sent to {phone}</Text>
                  </View>
                  <OtpBoxes value={otp} onChange={(value) => { setOtp(value); if (value.length === 6) handleOtpLogin(value); }} />
                  <PrimaryButton onPress={() => handleOtpLogin()} loading={loading} disabled={otp.length < 6} label="Verify & Sign In" />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 13 }}>
                    <TouchableOpacity onPress={() => setStage('method-select')}>
                      <Text style={{ fontSize: 12, color: colors.subtle }}>Other method</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={sendOtp} disabled={cooldown > 0 || loading}>
                      <Text style={{ fontSize: 12, color: cooldown > 0 ? colors.subtle : colors.brandDark, fontWeight: cooldown > 0 ? '500' : '800' }}>
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {stage === 'pin' && (
                <View>
                  <View style={{ alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
                    <Ionicons name="key-outline" size={22} color={colors.text} />
                    <Text style={{ marginTop: 8, fontSize: 13, fontWeight: '900', color: colors.ink }}>Enter your PIN</Text>
                    <Text style={{ marginTop: 3, fontSize: 12, color: colors.subtle }}>
                      6-digit PIN for {mode === 'ghanacard' ? normalizeGhanaCard(ghanaCard) : mode === 'email' ? email : normalizePhoneNumber(phone)}
                    </Text>
                  </View>
                  <OtpBoxes value={pin} onChange={(value) => { setPin(value); if (value.length === 6) handlePinLogin(value); }} secure />
                  <PrimaryButton onPress={() => handlePinLogin()} loading={loading} disabled={pin.length < 6} label="Sign In" />
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 13 }}>
                    {mode === 'phone' ? (
                      <TouchableOpacity onPress={sendOtp}>
                        <Text style={{ fontSize: 12, color: colors.subtle }}>Use OTP instead</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity onPress={() => router.push('/(auth)/forgot-pin')}>
                      <Text style={{ fontSize: 12, color: colors.amber, fontWeight: '800' }}>Forgot PIN?</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {stage === 'email-confirm' && (
                <View>
                  <View style={{ alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
                    <Ionicons name="mail-outline" size={22} color={colors.text} />
                    <Text style={{ marginTop: 8, fontSize: 13, fontWeight: '900', color: colors.ink }}>Verify your email</Text>
                    <Text style={{ marginTop: 3, fontSize: 12, color: colors.subtle, textAlign: 'center' }}>We sent a 6-digit code to the email on your account</Text>
                  </View>
                  <OtpBoxes value={emailConfirmCode} onChange={(value) => { setEmailConfirmCode(value); if (value.length === 6) handleEmailConfirm(value); }} />
                  <PrimaryButton onPress={() => handleEmailConfirm()} loading={loading} disabled={emailConfirmCode.length < 6} label="Verify & Sign In" />
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 13 }}>
                    <TouchableOpacity onPress={resendEmailConfirm} disabled={cooldown > 0 || loading}>
                      <Text style={{ fontSize: 12, color: cooldown > 0 ? colors.subtle : colors.brandDark, fontWeight: cooldown > 0 ? '500' : '800' }}>
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {stage === 'input' && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#CBD5E1', letterSpacing: 0.8 }}>OR</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
                  </View>

                  <View style={{ gap: 8 }}>
                    <TouchableOpacity onPress={handleGoogleLogin} disabled={loading} style={{ height: 42, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                      <Ionicons name="logo-google" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>Continue with Google</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={() => setShowMoreOptions((v) => !v)} style={{ alignItems: 'center', marginTop: 14 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.subtle }}>
                      {showMoreOptions ? 'Hide more options' : 'More sign-in options'}
                    </Text>
                  </TouchableOpacity>

                  {showMoreOptions && (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {mode !== 'phone' && (
                        <TouchableOpacity onPress={() => switchMode('phone')} style={{ height: 42, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E8EDF2', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>Use phone number</Text>
                        </TouchableOpacity>
                      )}
                      {mode !== 'email' && (
                        <TouchableOpacity onPress={() => switchMode('email')} style={{ height: 42, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E8EDF2', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>Sign in with email</Text>
                        </TouchableOpacity>
                      )}
                      {mode !== 'ghanacard' && (
                        <TouchableOpacity onPress={() => switchMode('ghanacard')} style={{ height: 42, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E8EDF2', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>Sign in with Ghana Card</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  <View style={{ alignItems: 'center', marginTop: 16 }}>
                    <Text style={{ fontSize: 12, color: colors.subtle }}>
                      New to Riderguy?{' '}
                      <Text onPress={() => router.push('/(auth)/register')} style={{ color: colors.brandDark, fontWeight: '900' }}>Create account</Text>
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
