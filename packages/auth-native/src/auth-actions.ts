import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import type { AuthUser } from './auth-store';
import { useAuthStore } from './auth-store';
import { getApiClient } from './api-client';
import { tokenStorage } from './token-storage';

export type NativeUserRole = 'CLIENT' | 'RIDER' | 'PARTNER';
export type OtpPurpose = 'REGISTRATION' | 'LOGIN' | 'PASSWORD_RESET';
export type RecoveryMethod = 'phone' | 'email' | 'ghanacard';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthMethodAvailability {
  otp: boolean;
  pin: boolean;
  biometric: boolean;
}

export interface PhoneRegisterInput {
  phone: string;
  otpCode: string;
  role: NativeUserRole;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  pin?: string;
  referralCode?: string;
}

export interface EmailRegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: NativeUserRole;
  referralCode?: string;
}

export interface GhanaCardRegisterInput {
  ghanaCard: string;
  password: string;
  firstName: string;
  lastName: string;
  role: NativeUserRole;
  securityQuestion: string;
  securityAnswer: string;
}

function unwrap<T = any>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

function tokensFrom(payload: any): AuthTokens | null {
  const data = unwrap<any>(payload);
  const candidates = [data, data?.tokens, data?.session, payload, payload?.tokens, payload?.session];
  for (const item of candidates) {
    if (item?.accessToken && item?.refreshToken) {
      return { accessToken: item.accessToken, refreshToken: item.refreshToken };
    }
  }
  return null;
}

function userFrom(payload: any): AuthUser | null {
  const data = unwrap<any>(payload);
  return (data?.user ?? payload?.user ?? null) as AuthUser | null;
}

export function getAuthErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const err = error as any;
  if (err?.code === 'ECONNABORTED') {
    return 'The RiderGuy server took too long to respond. Check your connection and try again.';
  }
  if (err?.message === 'Network Error' && !err?.response) {
    return 'Cannot reach the RiderGuy server. Check your internet connection or update the app API URL.';
  }
  return err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? fallback;
}

export function normalizePhoneNumber(value: string): string {
  const cleaned = value.trim().replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('233')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+233${cleaned.slice(1)}`;
  if (cleaned.length === 9) return `+233${cleaned}`;
  return cleaned;
}

export function normalizeGhanaCard(value: string): string {
  const upper = value.trim().toUpperCase().replace(/\s+/g, '');
  const raw = upper.replace(/-/g, '');
  if (/^GHA\d{10}$/.test(raw)) {
    return `GHA-${raw.slice(3, 12)}-${raw.slice(12)}`;
  }
  return upper;
}

export function isSixDigitCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function hasExpectedRole(user: AuthUser | null, expectedRole?: NativeUserRole): boolean {
  if (!expectedRole || !user) return true;
  const roles = user.roles?.map(String) ?? [];
  return String(user.role) === expectedRole || roles.includes(expectedRole);
}

export async function refreshCurrentUser(expectedRole?: NativeUserRole): Promise<AuthUser> {
  const api = getApiClient();
  const { data } = await api.get('/auth/me');
  const user = unwrap<AuthUser>(data);
  if (!hasExpectedRole(user, expectedRole)) {
    await tokenStorage.clearTokens();
    useAuthStore.getState().clearAuth();
    throw new Error(expectedRole === 'RIDER'
      ? 'This account is not registered as a rider.'
      : 'This account is not registered for this app.');
  }
  useAuthStore.getState().setUser(user);
  return user;
}

export async function completeAuth(payload: any, expectedRole?: NativeUserRole): Promise<AuthUser> {
  const tokens = tokensFrom(payload);
  if (!tokens) throw new Error('Auth response did not include tokens.');

  await tokenStorage.setAccessToken(tokens.accessToken);
  await tokenStorage.setRefreshToken(tokens.refreshToken);

  const responseUser = userFrom(payload);
  if (responseUser && hasExpectedRole(responseUser, expectedRole)) {
    useAuthStore.getState().setUser(responseUser);
    return responseUser;
  }

  return refreshCurrentUser(expectedRole);
}

export async function requestOtp(phone: string, purpose: OtpPurpose): Promise<void> {
  await getApiClient().post('/auth/otp/request', { phone, purpose });
}

export async function verifyOtp(phone: string, otp: string, purpose: OtpPurpose): Promise<boolean> {
  const { data } = await getApiClient().post('/auth/otp/verify', { phone, otp, purpose });
  return unwrap<{ verified?: boolean }>(data).verified ?? true;
}

export async function checkAuthMethods(phone: string): Promise<AuthMethodAvailability> {
  const { data } = await getApiClient().post('/auth/methods', { phone });
  return unwrap<AuthMethodAvailability>(data);
}

// AUTH-EMAIL-CONFIRM: any login path that doesn't already prove email
// ownership (phone+password, phone+PIN, Ghana Card, phone OTP) comes back
// with `requiresEmailConfirmation` instead of tokens — a code has already
// been emailed to the account's address. Call `confirmLoginEmail` with the
// same `userId` to finish signing in. Google Play reviewers (and users
// abroad) often can't receive Ghana SMS, so email is the one channel
// guaranteed to reach them.
export interface LoginResult {
  requiresEmailConfirmation?: boolean;
  userId?: string;
  user?: AuthUser;
}

async function completeOrRequireEmailConfirm(data: any, expectedRole?: NativeUserRole): Promise<LoginResult> {
  const result = unwrap<any>(data);
  if (result.requiresEmailConfirmation) {
    return { requiresEmailConfirmation: true, userId: result.userId };
  }
  return { user: await completeAuth(data, expectedRole) };
}

export async function loginWithOtp(phone: string, otp: string, expectedRole?: NativeUserRole): Promise<LoginResult> {
  const { data } = await getApiClient().post('/auth/login', { phone, otp });
  return completeOrRequireEmailConfirm(data, expectedRole);
}

export async function loginWithPin(identifier: string, pin: string, expectedRole?: NativeUserRole): Promise<LoginResult> {
  const { data } = await getApiClient().post('/auth/login/pin', { identifier, pin });
  return completeOrRequireEmailConfirm(data, expectedRole);
}

export async function loginWithPassword(identifier: string, password: string, expectedRole?: NativeUserRole): Promise<LoginResult> {
  const payload: Record<string, string> = { identifier, password };
  if (identifier.includes('@')) payload.email = identifier;
  const { data } = await getApiClient().post('/auth/login/password', payload);
  return completeOrRequireEmailConfirm(data, expectedRole);
}

export async function loginWithGhanaCard(ghanaCard: string, password: string, expectedRole?: NativeUserRole): Promise<{ requiresPin?: boolean } & LoginResult> {
  const { data } = await getApiClient().post('/auth/login/ghanacard', { ghanaCard, password });
  const result = unwrap<any>(data);
  if (result.requiresPin) return { requiresPin: true };
  return completeOrRequireEmailConfirm(data, expectedRole);
}

/** Submit the 6-digit code emailed to the account, completing whichever login started it. */
export async function confirmLoginEmail(userId: string, code: string, expectedRole?: NativeUserRole): Promise<AuthUser> {
  const { data } = await getApiClient().post('/auth/login/email-confirm', { userId, code });
  return completeAuth(data, expectedRole);
}

export async function resendLoginEmailConfirmation(userId: string): Promise<void> {
  await getApiClient().post('/auth/login/email-confirm/resend', { userId });
}

export async function loginWithGoogleCredential(credential: string, role: NativeUserRole): Promise<AuthUser> {
  const { data } = await getApiClient().post('/auth/google', { credential, role });
  return completeAuth(data, role);
}

let googleConfiguredFor: string | null = null;

function ensureGoogleConfigured(webClientId: string) {
  if (googleConfiguredFor === webClientId) return;
  GoogleSignin.configure({ webClientId });
  googleConfiguredFor = webClientId;
}

// Native Google Sign-In (replaces the old manual browser-redirect flow, which
// Google blocks for custom URI scheme redirects). Returns null if the user
// cancelled the picker — callers should treat that as a silent no-op, not an error.
export async function signInWithGoogle(role: NativeUserRole, webClientId: string): Promise<AuthUser | null> {
  ensureGoogleConfigured(webClientId);
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google did not return an ID token.');
  return loginWithGoogleCredential(idToken, role);
}

export async function registerWithPhone(input: PhoneRegisterInput): Promise<AuthUser> {
  const { data } = await getApiClient().post('/auth/register', input);
  return completeAuth(data, input.role);
}

export async function registerWithEmail(input: EmailRegisterInput): Promise<AuthUser> {
  const { data } = await getApiClient().post('/auth/register/email', input);
  return completeAuth(data, input.role);
}

export async function registerWithGhanaCard(input: GhanaCardRegisterInput): Promise<AuthUser> {
  const { data } = await getApiClient().post('/auth/register/ghanacard', input);
  return completeAuth(data, input.role);
}

export async function forgotPassword(email: string): Promise<void> {
  await getApiClient().post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await getApiClient().post('/auth/reset-password', { token, newPassword });
}

export async function verifyEmail(token: string): Promise<void> {
  await getApiClient().post('/auth/verify-email', { token });
}

export async function resendVerification(email: string): Promise<void> {
  await getApiClient().post('/auth/resend-verification', { email });
}

export async function resetPinWithOtp(phone: string, otp: string, newPin: string): Promise<void> {
  await getApiClient().post('/auth/reset-pin', { phone, otp, newPin });
}

export async function requestRecovery(method: RecoveryMethod, identifier: string): Promise<{ securityQuestion?: string }> {
  const { data } = await getApiClient().post('/auth/recovery/request', { method, identifier });
  return unwrap(data);
}

export async function verifyRecoveryOtp(phone: string, otp: string): Promise<{ token?: string; recoveryToken?: string }> {
  const { data } = await getApiClient().post('/auth/recovery/verify-otp', { phone, otp });
  return unwrap(data);
}

export async function getSecurityQuestion(ghanaCard: string): Promise<{ question?: string; securityQuestion?: string }> {
  const { data } = await getApiClient().get(`/auth/recovery/security-question?ghanaCard=${encodeURIComponent(ghanaCard)}`);
  return unwrap(data);
}

export async function verifySecurityAnswer(ghanaCard: string, answer: string): Promise<{ token?: string; recoveryToken?: string }> {
  const { data } = await getApiClient().post('/auth/recovery/verify-security', { ghanaCard, answer });
  return unwrap(data);
}

export async function resetPinWithRecoveryToken(newPin: string, token: string): Promise<void> {
  await getApiClient().post('/auth/recovery/reset-pin', { newPin, token });
}

export async function setPin(pin: string): Promise<void> {
  await getApiClient().post('/auth/set-pin', { pin });
}
