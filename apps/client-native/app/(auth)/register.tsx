import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  getAuthErrorMessage,
  isSixDigitCode,
  normalizeGhanaCard,
  normalizePhoneNumber,
  registerWithEmail,
  registerWithGhanaCard,
  registerWithPhone,
  requestOtp,
  setPin as setAuthPin,
  signInWithGoogle,
  verifyOtp,
} from '@riderguy/auth-native';
import { colors, shadow } from '@/design/client';

type Method = 'phone' | 'email' | 'ghanacard';
type PhoneStep = 'phone' | 'otp' | 'profile' | 'pin';

const SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What is your mother\'s maiden name?',
  'What city were you born in?',
  'What was your first job?',
];

function CodeBoxes({
  value,
  onChange,
  secure,
}: {
  value: string;
  onChange: (value: string) => void;
  secure?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <TouchableOpacity activeOpacity={1} onPress={() => ref.current?.focus()}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 8 }}>
        {Array.from({ length: 6 }).map((_, index) => {
          const filled = !!value[index];
          return (
            <View
              key={index}
              style={{
                width: 43,
                height: 52,
                borderRadius: 15,
                borderWidth: 1.5,
                borderColor: filled || value.length === index ? colors.brand : '#E5E7EB',
                backgroundColor: filled ? colors.brandSoft : '#F8FAFC',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>{filled ? secure ? '*' : value[index] : ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
    </TouchableOpacity>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>{label}</Text>
      <TextInput
        placeholderTextColor="#A0AAB8"
        {...props}
        style={[{
          minHeight: 52,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#E8EDF2',
          backgroundColor: '#F8FAFC',
          paddingHorizontal: 14,
          color: colors.ink,
          fontSize: 14,
          fontWeight: '800',
        }, props.style]}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'light' | 'dark';
}) {
  const bg = variant === 'dark' ? colors.ink : variant === 'light' ? '#F8FAFC' : colors.brand;
  const fg = variant === 'light' ? colors.ink : '#fff';
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        minHeight: 54,
        borderRadius: 18,
        backgroundColor: disabled || loading ? '#D1D5DB' : bg,
        borderWidth: variant === 'light' ? 1 : 0,
        borderColor: '#E8EDF2',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        ...(variant === 'primary' && !disabled && !loading ? shadow.brand : {}),
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: 15, fontWeight: '900' }}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function validatePassword(password: string, confirm: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a number.';
  if (password !== confirm) return 'Passwords do not match.';
  return '';
}

export default function RegisterScreen() {
  const [method, setMethod] = useState<Method>('email');
  const [showMoreMethods, setShowMoreMethods] = useState(false);
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const [ghanaCard, setGhanaCard] = useState('');
  const [ghanaPassword, setGhanaPassword] = useState('');
  const [confirmGhanaPassword, setConfirmGhanaPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');

  const normalizedPhone = useMemo(() => normalizePhoneNumber(phone), [phone]);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

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
    if (!normalizedPhone) {
      Alert.alert('Phone required', 'Enter a valid phone number.');
      return;
    }
    setLoading(true);
    try {
      await requestOtp(normalizedPhone, 'REGISTRATION');
      setOtp('');
      setPhoneStep('otp');
      startCooldown();
    } catch (error) {
      Alert.alert('OTP failed', getAuthErrorMessage(error, 'Could not send a code to this number.'));
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async (code = otp) => {
    if (!isSixDigitCode(code)) return;
    setLoading(true);
    try {
      await verifyOtp(normalizedPhone, code, 'REGISTRATION');
      setPhoneStep('profile');
    } catch (error) {
      setOtp('');
      Alert.alert('Invalid code', getAuthErrorMessage(error, 'The code is incorrect or expired.'));
    } finally {
      setLoading(false);
    }
  };

  const submitPhone = async () => {
    const optionalPasswordError = password || confirmPassword ? validatePassword(password, confirmPassword) : '';
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Name required', 'Enter your first and last name.');
      return;
    }
    if (email.trim() && !email.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address or leave it blank.');
      return;
    }
    if (optionalPasswordError) {
      Alert.alert('Password issue', optionalPasswordError);
      return;
    }
    if (!isSixDigitCode(pin) || pin !== confirmPin) {
      Alert.alert('PIN issue', 'Create and confirm a matching 6-digit PIN.');
      return;
    }

    setLoading(true);
    try {
      await registerWithPhone({
        phone: normalizedPhone,
        otpCode: otp,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        password: password || undefined,
        pin,
        role: 'CLIENT',
        referralCode: referralCode.trim() || undefined,
      });
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Registration failed', getAuthErrorMessage(error, 'Could not create your account.'));
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = async () => {
    const passwordError = validatePassword(password, confirmPassword);
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert('Details required', 'Enter your name and email.');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    if (passwordError) {
      Alert.alert('Password issue', passwordError);
      return;
    }
    if (!isSixDigitCode(pin) || pin !== confirmPin) {
      Alert.alert('PIN issue', 'Create and confirm a matching 6-digit PIN.');
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: 'CLIENT',
        referralCode: referralCode.trim() || undefined,
      });
      await setAuthPin(pin);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Registration failed', getAuthErrorMessage(error, 'Could not create your account.'));
    } finally {
      setLoading(false);
    }
  };

  const submitGhanaCard = async () => {
    const passwordError = validatePassword(ghanaPassword, confirmGhanaPassword);
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Name required', 'Enter your legal first and last name.');
      return;
    }
    if (passwordError) {
      Alert.alert('Password issue', passwordError);
      return;
    }
    if (!securityQuestion || securityAnswer.trim().length < 2) {
      Alert.alert('Recovery details required', 'Choose a security question and answer.');
      return;
    }
    if (!isSixDigitCode(pin) || pin !== confirmPin) {
      Alert.alert('PIN issue', 'Create and confirm a matching 6-digit PIN.');
      return;
    }
    setLoading(true);
    try {
      await registerWithGhanaCard({
        ghanaCard: normalizeGhanaCard(ghanaCard),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: ghanaPassword,
        role: 'CLIENT',
        securityQuestion,
        securityAnswer: securityAnswer.trim(),
      });
      await setAuthPin(pin);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Registration failed', getAuthErrorMessage(error, 'Could not create your account.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
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

  const goBack = () => {
    if (method === 'phone' && phoneStep === 'otp') setPhoneStep('phone');
    else if (method === 'phone' && phoneStep === 'profile') setPhoneStep('otp');
    else if (method === 'phone' && phoneStep === 'pin') setPhoneStep('profile');
    else router.back();
  };

  const phoneProgress = { phone: 25, otp: 50, profile: 75, pin: 100 }[phoneStep];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <TouchableOpacity onPress={goBack} style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
              <Ionicons name="arrow-back" size={20} color={colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={{ color: colors.brandDark, fontSize: 13, fontWeight: '900' }}>Sign in</Text>
            </TouchableOpacity>
          </View>

          <View style={{ borderRadius: 28, backgroundColor: colors.ink, padding: 20, overflow: 'hidden', ...shadow.float }}>
            <View style={{ position: 'absolute', right: -42, top: -56, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(10,185,87,0.20)' }} />
            <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>Create account</Text>
            <Text style={{ color: '#fff', fontSize: 30, lineHeight: 35, fontWeight: '900', marginTop: 7 }}>Your premium delivery account.</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 13, lineHeight: 20, marginTop: 8 }}>Choose the identity method that fits you. Every path is wired to the RiderGuy auth backend.</Text>
          </View>

          <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 22, padding: 14, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: showMoreMethods ? 8 : 12 }}>
              <TouchableOpacity
                onPress={() => setMethod('email')}
                style={{ flex: 1, minHeight: 52, borderRadius: 16, backgroundColor: method === 'email' ? colors.brandSoft : '#F8FAFC', borderWidth: 1, borderColor: method === 'email' ? colors.brand : '#E8EDF2', alignItems: 'center', justifyContent: 'center', gap: 3 }}
              >
                <Ionicons name="mail" size={17} color={method === 'email' ? colors.brandDark : colors.subtle} />
                <Text style={{ color: method === 'email' ? colors.brandDark : colors.text, fontSize: 11, fontWeight: '900' }}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowMoreMethods((v) => !v)}
                style={{ width: 64, minHeight: 52, borderRadius: 16, backgroundColor: showMoreMethods ? colors.brandSoft : '#F8FAFC', borderWidth: 1, borderColor: showMoreMethods ? colors.brand : '#E8EDF2', alignItems: 'center', justifyContent: 'center', gap: 3 }}
              >
                <Ionicons name="ellipsis-horizontal" size={17} color={showMoreMethods ? colors.brandDark : colors.subtle} />
                <Text style={{ color: showMoreMethods ? colors.brandDark : colors.text, fontSize: 9, fontWeight: '900' }}>More</Text>
              </TouchableOpacity>
            </View>

            {showMoreMethods && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {[
                  ['phone', 'Phone', 'call'],
                  ['ghanacard', 'Ghana Card', 'card'],
                ].map(([key, label, icon]) => {
                  const active = method === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setMethod(key as Method)}
                      style={{ flex: 1, minHeight: 52, borderRadius: 16, backgroundColor: active ? colors.brandSoft : '#F8FAFC', borderWidth: 1, borderColor: active ? colors.brand : '#E8EDF2', alignItems: 'center', justifyContent: 'center', gap: 3 }}
                    >
                      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={17} color={active ? colors.brandDark : colors.subtle} />
                      <Text style={{ color: active ? colors.brandDark : colors.text, fontSize: 11, fontWeight: '900' }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <PrimaryButton label="Continue with Google" icon="logo-google" variant="light" loading={loading} onPress={handleGoogle} />
          </View>

          <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#EEF2F7', ...shadow.card }}>
            {method === 'phone' ? (
              <>
                <View style={{ height: 7, borderRadius: 99, backgroundColor: '#E5E7EB', overflow: 'hidden', marginBottom: 16 }}>
                  <View style={{ width: `${phoneProgress}%`, height: 7, backgroundColor: colors.brand, borderRadius: 99 }} />
                </View>

                {phoneStep === 'phone' ? (
                  <>
                    <Field label="Phone number" placeholder="+233 XX XXX XXXX" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
                    <PrimaryButton label="Send verification code" icon="send" loading={loading} disabled={!normalizedPhone} onPress={sendOtp} />
                  </>
                ) : null}

                {phoneStep === 'otp' ? (
                  <>
                    <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'center' }}>Verify {normalizedPhone}</Text>
                    <Text style={{ color: colors.subtle, fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 8 }}>We will confirm this code before creating your account.</Text>
                    <CodeBoxes value={otp} onChange={(value) => { setOtp(value); if (value.length === 6) confirmOtp(value); }} />
                    <PrimaryButton label="Verify code" loading={loading} disabled={!isSixDigitCode(otp)} onPress={() => confirmOtp()} />
                    <TouchableOpacity onPress={sendOtp} disabled={cooldown > 0 || loading} style={{ alignItems: 'center', marginTop: 14 }}>
                      <Text style={{ color: cooldown > 0 ? colors.subtle : colors.brandDark, fontSize: 13, fontWeight: '900' }}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {phoneStep === 'profile' ? (
                  <>
                    <Field label="First name" placeholder="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                    <Field label="Last name" placeholder="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
                    <Field label="Email optional" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                    <Field label="Password optional" placeholder="Create password for email login" value={password} onChangeText={setPassword} secureTextEntry />
                    <Field label="Confirm password" placeholder="Repeat password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                    <Field label="Referral code optional" placeholder="Referral code" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" />
                    <PrimaryButton label="Continue to PIN" icon="arrow-forward" disabled={!firstName.trim() || !lastName.trim()} onPress={() => setPhoneStep('pin')} />
                  </>
                ) : null}

                {phoneStep === 'pin' ? (
                  <>
                    <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'center' }}>Create your 6-digit PIN</Text>
                    <Text style={{ color: colors.subtle, fontSize: 12, textAlign: 'center', marginTop: 4 }}>This must be exactly 6 digits.</Text>
                    <CodeBoxes value={pin} onChange={setPin} secure />
                    <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: '900', textAlign: 'center', marginTop: 10 }}>Confirm PIN</Text>
                    <CodeBoxes value={confirmPin} onChange={setConfirmPin} secure />
                    <PrimaryButton label="Create account" icon="checkmark-circle" loading={loading} disabled={!isSixDigitCode(pin) || !isSixDigitCode(confirmPin)} onPress={submitPhone} />
                  </>
                ) : null}
              </>
            ) : null}

            {method === 'email' ? (
              <>
                <Field label="First name" placeholder="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                <Field label="Last name" placeholder="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
                <Field label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <Field label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry />
                <Field label="Confirm password" placeholder="Repeat password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                <Field label="Referral code optional" placeholder="Referral code" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" />
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'center' }}>Create your 6-digit PIN</Text>
                <CodeBoxes value={pin} onChange={setPin} secure />
                <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: '900', textAlign: 'center', marginTop: 8 }}>Confirm PIN</Text>
                <CodeBoxes value={confirmPin} onChange={setConfirmPin} secure />
                <PrimaryButton label="Create email account" icon="mail" loading={loading} disabled={!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword || !isSixDigitCode(pin) || !isSixDigitCode(confirmPin)} onPress={submitEmail} />
              </>
            ) : null}

            {method === 'ghanacard' ? (
              <>
                <Field label="First name" placeholder="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                <Field label="Last name" placeholder="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
                <Field label="Ghana Card" placeholder="GHA-XXXXXXXXX-X" value={ghanaCard} onChangeText={setGhanaCard} autoCapitalize="characters" />
                <Field label="Password" placeholder="At least 8 characters" value={ghanaPassword} onChangeText={setGhanaPassword} secureTextEntry />
                <Field label="Confirm password" placeholder="Repeat password" value={confirmGhanaPassword} onChangeText={setConfirmGhanaPassword} secureTextEntry />
                <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>Security question</Text>
                <View style={{ gap: 8, marginBottom: 12 }}>
                  {SECURITY_QUESTIONS.map((question) => (
                    <TouchableOpacity key={question} onPress={() => setSecurityQuestion(question)} style={{ minHeight: 42, borderRadius: 14, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: securityQuestion === question ? colors.brand : '#E8EDF2', backgroundColor: securityQuestion === question ? colors.brandSoft : '#F8FAFC' }}>
                      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}>{question}</Text>
                    </TouchableOpacity>
                ))}
                </View>
                <Field label="Security answer" placeholder="Your answer" value={securityAnswer} onChangeText={setSecurityAnswer} secureTextEntry />
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'center' }}>Create your 6-digit PIN</Text>
                <CodeBoxes value={pin} onChange={setPin} secure />
                <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: '900', textAlign: 'center', marginTop: 8 }}>Confirm PIN</Text>
                <CodeBoxes value={confirmPin} onChange={setConfirmPin} secure />
                <PrimaryButton label="Create Ghana Card account" icon="card" loading={loading} disabled={!firstName.trim() || !lastName.trim() || !ghanaCard.trim() || !ghanaPassword || !confirmGhanaPassword || securityAnswer.trim().length < 2 || !isSixDigitCode(pin) || !isSixDigitCode(confirmPin)} onPress={submitGhanaCard} />
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
