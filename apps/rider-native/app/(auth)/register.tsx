import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  verifyOtp,
} from '@riderguy/auth-native';
import { IconButton, PinBoxes, ProgressBar, RiderButton, RiderCard, RiderTextField, SegmentedControl, StatusPill } from '@/components/rider-ui';
import { riderColors } from '@/lib/rider-design';

type Method = 'phone' | 'email' | 'ghanacard';
type PhoneStep = 'phone' | 'otp' | 'profile' | 'pin';
type RiderChannel = 'GUEST' | 'IN_HOUSE';

const SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What city were you born in?',
  'What was your first job?',
  'What is your mother\'s maiden name?',
];

function validatePassword(password: string, confirm: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a number.';
  if (password !== confirm) return 'Passwords do not match.';
  return '';
}

function OtpEntry({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<TextInput>(null);
  return (
    <TouchableOpacity activeOpacity={1} onPress={() => ref.current?.focus()}>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 10 }}>
        {Array.from({ length: 6 }).map((_, index) => {
          const filled = !!value[index];
          return (
            <View key={index} style={{ width: 44, height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: filled || value.length === index ? riderColors.green : riderColors.line, backgroundColor: filled ? riderColors.greenSoft : riderColors.white, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: riderColors.ink, fontSize: 22, fontWeight: '900' }}>{value[index] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput ref={ref} value={value} onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} autoFocus />
    </TouchableOpacity>
  );
}

export default function RiderRegisterScreen() {
  const [method, setMethod] = useState<Method>('email');
  const [riderChannel, setRiderChannel] = useState<RiderChannel | null>(null);
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
  const [referralCode, setReferralCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [ghanaCard, setGhanaCard] = useState('');
  const [ghanaPassword, setGhanaPassword] = useState('');
  const [confirmGhanaPassword, setConfirmGhanaPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');

  const normalizedPhone = useMemo(() => normalizePhoneNumber(phone), [phone]);
  const phoneProgress = { phone: 25, otp: 50, profile: 75, pin: 100 }[phoneStep];
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

  const goBack = () => {
    if (method === 'phone' && phoneStep === 'otp') setPhoneStep('phone');
    else if (method === 'phone' && phoneStep === 'profile') setPhoneStep('otp');
    else if (method === 'phone' && phoneStep === 'pin') setPhoneStep('profile');
    else if (riderChannel) setRiderChannel(null);
    else router.back();
  };

  const sendOtp = async () => {
    if (!normalizedPhone) {
      Alert.alert('Ghana phone required', 'Enter a valid Ghana number starting with +233 or 0.');
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
    if (!riderChannel) return;
    const optionalPasswordError = password || confirmPassword ? validatePassword(password, confirmPassword) : '';
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Name required', 'Enter your legal first and last name.');
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
        role: 'RIDER',
        riderChannel,
        referralCode: referralCode.trim() || undefined,
      });
      router.replace('/(app)/onboarding');
    } catch (error) {
      Alert.alert('Registration failed', getAuthErrorMessage(error, 'Could not create your rider account.'));
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = async () => {
    if (!riderChannel) return;
    const passwordError = validatePassword(password, confirmPassword);
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert('Details required', 'Enter your name and email.');
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
        role: 'RIDER',
        riderChannel,
        referralCode: referralCode.trim() || undefined,
      });
      await setAuthPin(pin);
      router.replace('/(app)/onboarding');
    } catch (error) {
      Alert.alert('Registration failed', getAuthErrorMessage(error, 'Could not create your rider account.'));
    } finally {
      setLoading(false);
    }
  };

  const submitGhanaCard = async () => {
    if (!riderChannel) return;
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
      Alert.alert('Recovery details required', 'Choose a recovery question and answer.');
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
        role: 'RIDER',
        riderChannel,
        securityQuestion,
        securityAnswer: securityAnswer.trim(),
      });
      await setAuthPin(pin);
      router.replace('/(app)/onboarding');
    } catch (error) {
      Alert.alert('Registration failed', getAuthErrorMessage(error, 'Could not create your rider account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: riderColors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <IconButton icon="arrow-back" onPress={goBack} />
            <StatusPill status="ONLINE" label="Rider onboarding" />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: riderColors.greenDark, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' }}>Create rider account</Text>
            <Text style={{ color: riderColors.ink, fontSize: 30, lineHeight: 35, fontWeight: '900', marginTop: 7 }}>
              {riderChannel ? 'Create your rider profile.' : 'Choose your rider channel.'}
            </Text>
            <Text style={{ color: riderColors.muted, fontSize: 14, lineHeight: 21, marginTop: 9 }}>
              {riderChannel
                ? 'Verify your identity, secure your PIN, then continue through the correct onboarding path.'
                : 'Tell us whether you ride independently or as a RiderGuy-trained in-house rider.'}
            </Text>
          </View>

          {!riderChannel ? (
            <View style={{ gap: 12 }}>
              <RiderChannelCard
                icon="bicycle"
                title="3rd Party Rider (Guest)"
                body="I ride independently and will submit my personal and vehicle documents."
                onPress={() => setRiderChannel('GUEST')}
              />
              <RiderChannelCard
                icon="shield-checkmark"
                title="RiderGuy Trained In-House Rider"
                body="RiderGuy enrolled me in its trained in-house rider programme."
                onPress={() => setRiderChannel('IN_HOUSE')}
              />
            </View>
          ) : (
            <>
              <RiderCard style={{ gap: 12, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={riderChannel === 'IN_HOUSE' ? 'shield-checkmark' : 'bicycle'} size={21} color={riderColors.greenDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: riderColors.ink, fontSize: 14, fontWeight: '900' }}>
                      {riderChannel === 'IN_HOUSE' ? 'RiderGuy Trained In-House Rider' : '3rd Party Rider (Guest)'}
                    </Text>
                    <Text style={{ color: riderColors.muted, fontSize: 11, marginTop: 3 }}>Choose how you want to create your account.</Text>
                  </View>
                  <TouchableOpacity onPress={() => setRiderChannel(null)}>
                    <Text style={{ color: riderColors.greenDark, fontSize: 12, fontWeight: '900' }}>Change</Text>
                  </TouchableOpacity>
                </View>
              <SegmentedControl
                value={method}
                onChange={setMethod}
                options={[
                  { label: 'Email', value: 'email' },
                  { label: 'Phone', value: 'phone' },
                  { label: 'Ghana', value: 'ghanacard' },
                ]}
              />
              </RiderCard>

              <RiderCard>
            {method === 'phone' ? (
              <>
                <ProgressBar progress={phoneProgress} />
                <View style={{ height: 14 }} />
                {phoneStep === 'phone' ? (
                  <>
                    <RiderTextField label="Phone number" placeholder="+233 XX XXX XXXX" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
                    <RiderButton label="Send verification code" icon="send" loading={loading} disabled={!normalizedPhone} onPress={sendOtp} />
                  </>
                ) : null}
                {phoneStep === 'otp' ? (
                  <>
                    <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>Confirm {normalizedPhone}</Text>
                    <Text style={{ color: riderColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4 }}>We verify this code before creating the rider account.</Text>
                    <OtpEntry value={otp} onChange={(value) => { setOtp(value); if (value.length === 6) confirmOtp(value); }} />
                    <RiderButton label="Verify code" loading={loading} disabled={!isSixDigitCode(otp)} onPress={() => confirmOtp()} />
                    <TouchableOpacity onPress={sendOtp} disabled={cooldown > 0 || loading} style={{ alignItems: 'center', marginTop: 16 }}>
                      <Text style={{ color: cooldown > 0 ? riderColors.soft : riderColors.greenDark, fontWeight: '900' }}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                {phoneStep === 'profile' ? (
                  <>
                    <RiderTextField label="First name" placeholder="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                    <RiderTextField label="Last name" placeholder="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
                    <RiderTextField label="Email optional" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                    <RiderTextField label="Password optional" placeholder="Create password for email login" value={password} onChangeText={setPassword} secureTextEntry />
                    <RiderTextField label="Confirm password" placeholder="Repeat password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                    <RiderTextField label="Referral code optional" placeholder="Referral code" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" />
                    <RiderButton label="Continue to PIN" icon="arrow-forward" disabled={!firstName.trim() || !lastName.trim()} onPress={() => setPhoneStep('pin')} />
                  </>
                ) : null}
                {phoneStep === 'pin' ? (
                  <>
                    <Text style={{ color: riderColors.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>Create your rider PIN</Text>
                    <Text style={{ color: riderColors.muted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>Exactly 6 digits for fast sign-in.</Text>
                    <PinBoxes value={pin} onChange={setPin} secure />
                    <Text style={{ color: riderColors.muted, fontWeight: '900', marginTop: 12, marginBottom: 6, textAlign: 'center' }}>Confirm PIN</Text>
                    <PinBoxes value={confirmPin} onChange={setConfirmPin} secure />
                    <RiderButton label="Create rider account" icon="checkmark-circle" loading={loading} disabled={!isSixDigitCode(pin) || !isSixDigitCode(confirmPin)} onPress={submitPhone} />
                  </>
                ) : null}
              </>
            ) : null}

            {method === 'email' ? (
              <>
                <RiderTextField label="First name" placeholder="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                <RiderTextField label="Last name" placeholder="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
                <RiderTextField label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <RiderTextField label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry />
                <RiderTextField label="Confirm password" placeholder="Repeat password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                <RiderTextField label="Referral code optional" placeholder="Referral code" value={referralCode} onChangeText={setReferralCode} autoCapitalize="characters" />
                <Text style={{ color: riderColors.muted, fontWeight: '900', marginTop: 4, marginBottom: 6, textAlign: 'center' }}>Rider PIN</Text>
                <PinBoxes value={pin} onChange={setPin} secure />
                <Text style={{ color: riderColors.muted, fontWeight: '900', marginTop: 12, marginBottom: 6, textAlign: 'center' }}>Confirm PIN</Text>
                <PinBoxes value={confirmPin} onChange={setConfirmPin} secure />
                <RiderButton label="Create email account" icon="mail" loading={loading} disabled={!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword || !isSixDigitCode(pin) || !isSixDigitCode(confirmPin)} onPress={submitEmail} />
              </>
            ) : null}

            {method === 'ghanacard' ? (
              <>
                <RiderTextField label="First name" placeholder="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                <RiderTextField label="Last name" placeholder="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
                <RiderTextField label="Ghana Card" placeholder="GHA-XXXXXXXXX-X" value={ghanaCard} onChangeText={setGhanaCard} autoCapitalize="characters" />
                <RiderTextField label="Password" placeholder="At least 8 characters" value={ghanaPassword} onChangeText={setGhanaPassword} secureTextEntry />
                <RiderTextField label="Confirm password" placeholder="Repeat password" value={confirmGhanaPassword} onChangeText={setConfirmGhanaPassword} secureTextEntry />
                <Text style={{ color: riderColors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 }}>Security question</Text>
                <View style={{ gap: 8, marginBottom: 12 }}>
                  {SECURITY_QUESTIONS.map((question) => (
                    <TouchableOpacity key={question} onPress={() => setSecurityQuestion(question)} style={{ minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: securityQuestion === question ? riderColors.green : riderColors.line, backgroundColor: securityQuestion === question ? riderColors.greenSoft : riderColors.panelAlt, justifyContent: 'center', paddingHorizontal: 12 }}>
                      <Text style={{ color: riderColors.ink, fontSize: 12, fontWeight: '800' }}>{question}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <RiderTextField label="Security answer" placeholder="Your answer" value={securityAnswer} onChangeText={setSecurityAnswer} secureTextEntry />
                <Text style={{ color: riderColors.muted, fontWeight: '900', marginTop: 4, marginBottom: 6, textAlign: 'center' }}>Rider PIN</Text>
                <PinBoxes value={pin} onChange={setPin} secure />
                <Text style={{ color: riderColors.muted, fontWeight: '900', marginTop: 12, marginBottom: 6, textAlign: 'center' }}>Confirm PIN</Text>
                <PinBoxes value={confirmPin} onChange={setConfirmPin} secure />
                <RiderButton label="Create Ghana Card account" icon="card" loading={loading} disabled={!firstName.trim() || !lastName.trim() || !ghanaCard.trim() || !ghanaPassword || !confirmGhanaPassword || securityAnswer.trim().length < 2 || !isSixDigitCode(pin) || !isSixDigitCode(confirmPin)} onPress={submitGhanaCard} />
              </>
            ) : null}
              </RiderCard>
            </>
          )}

          <View style={{ alignItems: 'center', marginTop: 22 }}>
            <Text style={{ color: riderColors.muted, fontSize: 13 }}>
              Already registered?{' '}
              <Text onPress={() => router.push('/(auth)/login')} style={{ color: riderColors.greenDark, fontWeight: '900' }}>Sign in</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RiderChannelCard({
  body,
  icon,
  onPress,
  title,
}: {
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  title: string;
}) {
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress}>
      <RiderCard style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 54, height: 54, borderRadius: 19, backgroundColor: riderColors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={26} color={riderColors.greenDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: riderColors.ink, fontSize: 16, fontWeight: '900' }}>{title}</Text>
            <Text style={{ color: riderColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{body}</Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={riderColors.soft} />
        </View>
      </RiderCard>
    </TouchableOpacity>
  );
}
