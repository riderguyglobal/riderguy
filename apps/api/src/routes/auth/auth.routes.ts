import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate, authenticate, authRateLimit } from '../../middleware';
import {
  requestOtpSchema,
  verifyOtpSchema,
  registerSchema,
  refreshTokenSchema,
  loginWithOtpSchema,
  loginWithPasswordSchema,
  changePasswordSchema,
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
  '/login',
  authRateLimit,
  validate(loginWithOtpSchema),
  asyncHandler(AuthController.loginWithOtp)
);

router.post(
  '/login/password',
  authRateLimit,
  validate(loginWithPasswordSchema),
  asyncHandler(AuthController.loginWithPassword)
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

// Password management
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(AuthController.changePassword)
);

export { router as authRouter };
