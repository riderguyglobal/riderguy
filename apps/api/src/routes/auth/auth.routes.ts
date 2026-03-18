import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate, authenticate, authRateLimit } from '../../middleware';
import {
  requestOtpSchema,
  verifyOtpSchema,
  registerSchema,
  emailRegisterSchema,
  googleAuthSchema,
  refreshTokenSchema,
  loginWithOtpSchema,
  loginWithPinSchema,
  loginWithPasswordSchema,
  changePasswordSchema,
  changePinSchema,
  setPinSchema,
  resetPinSchema,
  checkAuthMethodsSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  webauthnRegisterOptionsSchema,
  webauthnRegisterVerifySchema,
  webauthnLoginOptionsSchema,
  webauthnLoginVerifySchema,
} from '@riderguy/validators';
import { asyncHandler } from '../../lib/async-handler';

const router = Router();

// Public routes — rate-limited
router.post(
  '/otp/request',
  authRateLimit,
  validate(requestOtpSchema),
  asyncHandler(AuthController.requestOtp)
);

router.post(
  '/otp/verify',
  authRateLimit,
  validate(verifyOtpSchema),
  asyncHandler(AuthController.verifyOtp)
);

router.post(
  '/register',
  authRateLimit,
  validate(registerSchema),
  asyncHandler(AuthController.register)
);

router.post(
  '/register/email',
  authRateLimit,
  validate(emailRegisterSchema),
  asyncHandler(AuthController.registerWithEmail)
);

router.post(
  '/google',
  authRateLimit,
  validate(googleAuthSchema),
  asyncHandler(AuthController.googleAuth)
);

router.post(
  '/login',
  authRateLimit,
  validate(loginWithOtpSchema),
  asyncHandler(AuthController.loginWithOtp)
);

router.post(
  '/login/pin',
  authRateLimit,
  validate(loginWithPinSchema),
  asyncHandler(AuthController.loginWithPin)
);

router.post(
  '/login/password',
  authRateLimit,
  validate(loginWithPasswordSchema),
  asyncHandler(AuthController.loginWithPassword)
);

// Check available auth methods for a phone number
router.post(
  '/methods',
  authRateLimit,
  validate(checkAuthMethodsSchema),
  asyncHandler(AuthController.checkAuthMethods)
);

router.post(
  '/refresh',
  authRateLimit,
  validate(refreshTokenSchema),
  asyncHandler(AuthController.refresh)
);

// Protected routes
router.post('/logout', authenticate, asyncHandler(AuthController.logout));
router.get('/me', authenticate, asyncHandler(AuthController.me));

// Session management
router.get('/sessions', authenticate, asyncHandler(AuthController.listSessions));
router.delete('/sessions/:id', authenticate, asyncHandler(AuthController.revokeSession));
router.delete('/sessions', authenticate, asyncHandler(AuthController.revokeAllSessions));

// Password & PIN management
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(AuthController.changePassword)
);

router.post(
  '/change-pin',
  authenticate,
  validate(changePinSchema),
  asyncHandler(AuthController.changePin)
);

// First-time PIN setup (no existing PIN required, just authenticated)
router.post(
  '/set-pin',
  authenticate,
  validate(setPinSchema),
  asyncHandler(AuthController.setPin)
);

// Reset forgotten PIN via OTP (public — no auth required)
router.post(
  '/reset-pin',
  authRateLimit,
  validate(resetPinSchema),
  asyncHandler(AuthController.resetPin)
);

// Email verification & password reset (public — rate-limited)
router.post(
  '/verify-email',
  authRateLimit,
  validate(verifyEmailSchema),
  asyncHandler(AuthController.verifyEmail)
);

router.post(
  '/resend-verification',
  authRateLimit,
  validate(resendVerificationSchema),
  asyncHandler(AuthController.resendVerification)
);

router.post(
  '/forgot-password',
  authRateLimit,
  validate(forgotPasswordSchema),
  asyncHandler(AuthController.forgotPassword)
);

router.post(
  '/reset-password',
  authRateLimit,
  validate(resetPasswordSchema),
  asyncHandler(AuthController.resetPassword)
);

// WebAuthn (Biometric) — registration requires auth, login is public
router.post(
  '/webauthn/register/options',
  authenticate,
  asyncHandler(AuthController.webauthnRegisterOptions)
);

router.post(
  '/webauthn/register/verify',
  authenticate,
  asyncHandler(AuthController.webauthnRegisterVerify)
);

router.post(
  '/webauthn/login/options',
  authRateLimit,
  validate(webauthnLoginOptionsSchema),
  asyncHandler(AuthController.webauthnLoginOptions)
);

router.post(
  '/webauthn/login/verify',
  authRateLimit,
  validate(webauthnLoginVerifySchema),
  asyncHandler(AuthController.webauthnLoginVerify)
);

// WebAuthn credential management (authenticated)
router.get(
  '/webauthn/credentials',
  authenticate,
  asyncHandler(AuthController.listWebAuthnCredentials)
);

router.delete(
  '/webauthn/credentials/:id',
  authenticate,
  asyncHandler(AuthController.removeWebAuthnCredential)
);

export { router as authRouter };
