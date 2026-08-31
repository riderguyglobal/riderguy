import { z } from 'zod';
import { phoneSchema, emailSchema, passwordSchema, pinSchema, requiredStringSchema } from './common';

/** Ghana Card number validation (format: GHA-XXXXXXXXX-X) */
export const ghanaCardSchema = z
  .string()
  .regex(/^GHA-\d{9}-\d$/, 'Ghana Card number must be in format GHA-XXXXXXXXX-X');

const authIdentifierSchema = z.union([emailSchema, ghanaCardSchema, phoneSchema]);

export const registerSchema = z.object({
  phone: phoneSchema,
  firstName: requiredStringSchema.max(50, 'First name must be at most 50 characters').optional().default(''),
  lastName: requiredStringSchema.max(50, 'Last name must be at most 50 characters').optional().default(''),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  pin: pinSchema.optional(),
  otpCode: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  role: z.enum(['RIDER', 'CLIENT', 'BUSINESS_CLIENT', 'PARTNER']),
  riderChannel: z.enum(['GUEST', 'IN_HOUSE']).optional(),
  referralCode: z.string().max(20).optional(),
});

export const emailRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: requiredStringSchema.max(50, 'First name must be at most 50 characters').optional().default(''),
  lastName: requiredStringSchema.max(50, 'Last name must be at most 50 characters').optional().default(''),
  role: z.enum(['RIDER', 'CLIENT', 'BUSINESS_CLIENT', 'PARTNER']),
  riderChannel: z.enum(['GUEST', 'IN_HOUSE']).optional(),
  referralCode: z.string().max(20).optional(),
});

export const googleAuthSchema = z.object({
  credential: z
    .string()
    .min(1, 'Google credential is required')
    .max(4096, 'Google credential is too large'),
  // The two public native Google entry points are the Rider and Client apps.
  // Business/Partner onboarding has separate requirements and must not be
  // self-assigned through a public identity-provider callback.
  role: z.enum(['RIDER', 'CLIENT']).default('CLIENT'),
});

export const loginWithOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
});

export const loginWithPinSchema = z.object({
  identifier: authIdentifierSchema,
  pin: pinSchema,
});

// AU-01: Accept either `identifier` (phone/email/Ghana Card) or `email`
// (legacy field — kept for back-compat with admin/rider login). One is required.
// The service resolves the user by shape (phone / email / Ghana Card) the same
// way `loginWithPin` does.
export const loginWithPasswordSchema = z
  .object({
    identifier: authIdentifierSchema.optional(),
    email: emailSchema.optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => !!(data.identifier || data.email), {
    message: 'Identifier or email is required',
    path: ['identifier'],
  });

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['REGISTRATION', 'LOGIN', 'PASSWORD_RESET']),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  purpose: z.enum(['REGISTRATION', 'LOGIN', 'PASSWORD_RESET']),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePinSchema = z
  .object({
    currentPin: pinSchema,
    newPin: pinSchema,
  })
  .refine((data) => data.currentPin !== data.newPin, {
    message: 'New PIN must be different from current PIN',
    path: ['newPin'],
  });

// WebAuthn schemas

// Structural shape for RegistrationResponseJSON from @simplewebauthn/types
const registrationResponseSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
    authenticatorData: z.string().optional(),
    transports: z.array(z.string()).optional(),
    publicKeyAlgorithm: z.number().optional(),
    publicKey: z.string().optional(),
  }),
  authenticatorAttachment: z.string().optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  type: z.literal('public-key'),
});

// Structural shape for AuthenticationResponseJSON from @simplewebauthn/types
const authenticationResponseSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().optional(),
  }),
  authenticatorAttachment: z.string().optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  type: z.literal('public-key'),
});

export const webauthnRegisterOptionsSchema = z.object({
  friendlyName: z.string().max(100).optional(),
});

export const webauthnRegisterVerifySchema = z.object({
  credential: registrationResponseSchema,
  friendlyName: z.string().max(100).optional(),
});

export const webauthnLoginOptionsSchema = z.object({
  phone: phoneSchema,
});

export const webauthnLoginVerifySchema = z.object({
  phone: phoneSchema,
  credential: authenticationResponseSchema,
});

// Set PIN (first-time setup — authenticated)
export const setPinSchema = z.object({
  pin: pinSchema,
});

// Reset forgotten PIN via OTP (public — no auth required)
export const resetPinSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  newPin: pinSchema,
});

// Check what auth methods are available for a phone number
export const checkAuthMethodsSchema = z.object({
  phone: phoneSchema,
});

// ---- Email Verification ----
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

// ---- Password Reset (email users) ----
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: passwordSchema,
});

// ---- Ghana Card Auth ----

export const ghanaCardRegisterSchema = z.object({
  ghanaCard: ghanaCardSchema,
  password: passwordSchema,
  firstName: requiredStringSchema.max(50, 'First name must be at most 50 characters'),
  lastName: requiredStringSchema.max(50, 'Last name must be at most 50 characters'),
  role: z.enum(['RIDER', 'CLIENT', 'BUSINESS_CLIENT', 'PARTNER']),
  riderChannel: z.enum(['GUEST', 'IN_HOUSE']).optional(),
  securityQuestion: requiredStringSchema.max(200, 'Security question must be at most 200 characters'),
  securityAnswer: requiredStringSchema.min(2, 'Security answer must be at least 2 characters').max(200),
});

export const loginWithGhanaCardSchema = z.object({
  ghanaCard: ghanaCardSchema,
  password: z.string().min(1, 'Password is required'),
});

// ---- Login email confirmation (AUTH-EMAIL-CONFIRM) ----
export const loginEmailConfirmSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be numeric'),
});

export const resendLoginEmailConfirmSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

// AU-07: discriminated union — identifier is validated per-method.
export const recoveryRequestSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('phone'), identifier: phoneSchema }),
  z.object({ method: z.literal('email'), identifier: emailSchema }),
  z.object({ method: z.literal('ghanacard'), identifier: ghanaCardSchema }),
]);

export const verifySecurityAnswerSchema = z.object({
  ghanaCard: ghanaCardSchema,
  answer: z.string().min(1, 'Answer is required'),
});

// AU-02: previously missing — now validates `/auth/recovery/verify-otp` body.
export const verifyRecoveryOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
});

// AU-02: previously missing — now validates `/auth/recovery/security-question` query.
export const getSecurityQuestionSchema = z.object({
  ghanaCard: ghanaCardSchema,
});

export const recoveryResetPinSchema = z.object({
  newPin: pinSchema,
  token: z.string().min(1, 'Recovery token is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type GhanaCardRegisterInput = z.infer<typeof ghanaCardRegisterSchema>;
export type LoginWithGhanaCardInput = z.infer<typeof loginWithGhanaCardSchema>;
export type LoginEmailConfirmInput = z.infer<typeof loginEmailConfirmSchema>;
export type ResendLoginEmailConfirmInput = z.infer<typeof resendLoginEmailConfirmSchema>;
export type LoginWithOtpInput = z.infer<typeof loginWithOtpSchema>;
export type LoginWithPinInput = z.infer<typeof loginWithPinSchema>;
export type LoginWithPasswordInput = z.infer<typeof loginWithPasswordSchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangePinInput = z.infer<typeof changePinSchema>;
export type SetPinInput = z.infer<typeof setPinSchema>;
export type ResetPinInput = z.infer<typeof resetPinSchema>;
export type CheckAuthMethodsInput = z.infer<typeof checkAuthMethodsSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type RecoveryRequestInput = z.infer<typeof recoveryRequestSchema>;
export type VerifySecurityAnswerInput = z.infer<typeof verifySecurityAnswerSchema>;
export type RecoveryResetPinInput = z.infer<typeof recoveryResetPinSchema>;
