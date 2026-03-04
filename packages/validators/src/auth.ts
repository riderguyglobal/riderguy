import { z } from 'zod';
import { phoneSchema, emailSchema, passwordSchema, pinSchema, requiredStringSchema } from './common';

export const registerSchema = z.object({
  phone: phoneSchema,
  firstName: requiredStringSchema.max(50, 'First name must be at most 50 characters'),
  lastName: requiredStringSchema.max(50, 'Last name must be at most 50 characters'),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  pin: pinSchema.optional(),
  otpCode: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  role: z.enum(['RIDER', 'CLIENT', 'BUSINESS_CLIENT', 'PARTNER']),
  referralCode: z.string().max(20).optional(),
});

export const loginWithOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
});

export const loginWithPinSchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
});

export const loginWithPasswordSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
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
export const webauthnRegisterOptionsSchema = z.object({
  friendlyName: z.string().max(100).optional(),
});

export const webauthnRegisterVerifySchema = z.object({
  credential: z.any(), // RegistrationResponseJSON — verified by @simplewebauthn/server
  friendlyName: z.string().max(100).optional(),
});

export const webauthnLoginOptionsSchema = z.object({
  phone: phoneSchema,
});

export const webauthnLoginVerifySchema = z.object({
  phone: phoneSchema,
  credential: z.any(), // AuthenticationResponseJSON — verified by @simplewebauthn/server
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

export type RegisterInput = z.infer<typeof registerSchema>;
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
