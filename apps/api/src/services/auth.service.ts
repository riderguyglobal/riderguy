import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '@riderguy/database';
import { config } from '../config';
import { ApiError } from '../lib/api-error';
import { logger } from '../lib/logger';
import { SmsService } from './sms.service';
import type { AuthPayload } from '../middleware/auth';
import type { UserRole } from '@riderguy/types';
import type { UserRole as PrismaUserRole } from '@prisma/client';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

const SALT_ROUNDS = 12;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — matches refresh token TTL

/**
 * Get the effective roles array for a user, handling migration from
 * single `role` to `roles[]` array.
 */
function getUserRoles(user: { role: string; roles?: string[] }): UserRole[] {
  const rolesArr = user.roles && user.roles.length > 0
    ? user.roles as UserRole[]
    : [user.role as UserRole];
  return rolesArr;
}

// ============================================================
// Auth Service — handles registration, OTP, JWT tokens, and
// password management.
// ============================================================

export class AuthService {
  // ---- Password hashing ----

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  // ---- JWT ----

  static generateAccessToken(payload: AuthPayload): string {
    // Ensure `roles` is always present in the token for multi-role support
    const tokenPayload = {
      ...payload,
      roles: payload.roles?.length ? payload.roles : [payload.role],
    };
    return jwt.sign(tokenPayload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn,
    });
  }

  static generateRefreshToken(payload: { userId: string; sessionId: string }): string {
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });
  }

  static verifyRefreshToken(token: string): { userId: string; sessionId: string } {
    try {
      return jwt.verify(token, config.jwt.refreshSecret) as {
        userId: string;
        sessionId: string;
      };
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
  }

  // ---- OTP ----

  static generateOtpCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  static async createOtp(phone: string, purpose: 'REGISTRATION' | 'LOGIN' | 'PASSWORD_RESET') {
    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create new OTP (critical path — only DB call we await)
    const otp = await prisma.otp.create({ data: { phone, code, purpose, expiresAt } });

    // Invalidate old OTPs in background (fire-and-forget, excludes new OTP)
    prisma.otp.updateMany({
      where: { phone, purpose, verified: false, id: { not: otp.id } },
      data: { verified: true },
    }).catch(() => {});

    // Send OTP via mNotify SMS (fire-and-forget)
    SmsService.sendOtp(phone, code).catch((err) => {
      logger.error({ err, phone, purpose }, 'Failed to send OTP SMS');
    });

    if (config.nodeEnv === 'development') {
      logger.info({ phone, purpose, code }, 'OTP created (dev only)');
    } else {
      logger.info({ phone, purpose }, 'OTP created');
    }

    return otp;
  }

  static async verifyOtp(
    phone: string,
    code: string,
    purpose: 'REGISTRATION' | 'LOGIN' | 'PASSWORD_RESET'
  ) {
    const otp = await prisma.otp.findFirst({
      where: { phone, purpose, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw ApiError.badRequest('No pending OTP found for this phone number', 'OTP_NOT_FOUND');
    }

    if (otp.attempts >= 5) {
      throw ApiError.tooManyRequests('Too many OTP attempts. Please request a new code.');
    }

    if (new Date() > otp.expiresAt) {
      throw ApiError.badRequest('OTP has expired. Please request a new code.', 'OTP_EXPIRED');
    }

    // Constant-time comparison to mitigate timing attacks.
    // OTPs are short-lived (5 min) and attempt-limited (5 tries),
    // so timing attacks are impractical — but defence in depth.
    const codeMatch =
      otp.code.length === code.length &&
      crypto.timingSafeEqual(Buffer.from(otp.code), Buffer.from(code));

    if (!codeMatch) {
      await prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw ApiError.badRequest('Invalid OTP code', 'OTP_INVALID');
    }

    // Mark as verified
    await prisma.otp.update({
      where: { id: otp.id },
      data: { verified: true },
    });

    return true;
  }

  // ---- Registration ----

  static async register(input: {
    phone: string;
    firstName: string;
    lastName: string;
    email?: string;
    password?: string;
    pin?: string;
    role: UserRole;
  }, deviceInfo?: string, ipAddress?: string) {
    // ---- 1. Verify that the phone was OTP-verified for REGISTRATION ----
    const verifiedOtp = await prisma.otp.findFirst({
      where: { phone: input.phone, purpose: 'REGISTRATION', verified: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!verifiedOtp) {
      throw ApiError.badRequest(
        'Phone number not verified. Please complete OTP verification first.',
        'OTP_NOT_VERIFIED',
      );
    }

    // Reject if the verified OTP is older than 15 minutes (generous window)
    const otpAge = Date.now() - verifiedOtp.createdAt.getTime();
    if (otpAge > 15 * 60 * 1000) {
      throw ApiError.badRequest(
        'OTP verification has expired. Please verify your phone number again.',
        'OTP_EXPIRED',
      );
    }

    // ---- 2. Uniqueness checks ----
    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw ApiError.conflict('A user with this phone number already exists', 'PHONE_EXISTS');
    }

    if (input.email) {
      const emailExists = await prisma.user.findUnique({ where: { email: input.email } });
      if (emailExists) {
        throw ApiError.conflict('A user with this email already exists', 'EMAIL_EXISTS');
      }
    }

    // ---- 3. Credential hashing ----
    const credential = input.password || input.pin;
    if (!credential) {
      throw ApiError.badRequest(
        'A password or PIN is required',
        'CREDENTIAL_REQUIRED',
      );
    }
    const passwordHash = await this.hashPassword(credential);

    // ---- 4. Create user + profile + wallet + session sequentially ----
    // NOTE: We avoid prisma.$transaction(async callback) because Neon's
    // pooled connection (PgBouncer) doesn't support interactive transactions.
    // Instead we do sequential writes with cleanup on failure.

    let user;
    let isAddingRole = false;
    try {
      // Check if a user with this phone already exists
      const existingUser = await prisma.user.findUnique({ where: { phone: input.phone } });

      if (existingUser) {
        // If the user already has this role, reject as duplicate
        const existingRoles = getUserRoles(existingUser);
        if (existingRoles.includes(input.role as UserRole)) {
          throw ApiError.conflict('A user with this phone number already exists', 'PHONE_EXISTS');
        }

        // User exists with a different role — add the new role
        const updatedRoles = [...existingRoles, input.role as UserRole];
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { roles: updatedRoles },
        });
        isAddingRole = true;
        logger.info(
          { userId: user.id, newRole: input.role, roles: updatedRoles },
          'Adding new role to existing user',
        );
      } else {
        // Brand new user
        user = await prisma.user.create({
          data: {
            phone: input.phone,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email ?? null,
            passwordHash,
            role: input.role as PrismaUserRole,
            roles: [input.role as PrismaUserRole],
            phoneVerified: true,
            status: 'ACTIVE',
          },
        });
      }
    } catch (err: any) {
      // Unique constraint → meaningful message (race condition fallback)
      if (err?.code === 'P2002') {
        throw ApiError.conflict('A user with this phone number already exists', 'PHONE_EXISTS');
      }
      throw err;
    }

    try {
      // Create role-specific profiles (always needed — whether new user or adding a role)
      if (input.role === 'RIDER') {
        // Check if rider profile already exists (shouldn't, but be safe)
        const existingProfile = await prisma.riderProfile.findUnique({ where: { userId: user.id } });
        if (!existingProfile) {
          await prisma.riderProfile.create({ data: { userId: user.id } });
        }
      } else if (input.role === 'CLIENT' || input.role === 'BUSINESS_CLIENT') {
        const existingProfile = await prisma.clientProfile.findUnique({ where: { userId: user.id } });
        if (!existingProfile) {
          await prisma.clientProfile.create({ data: { userId: user.id } });
        }
      } else if (input.role === 'PARTNER') {
        const existingProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
        if (!existingProfile) {
          const { generateReferralCode } = await import('@riderguy/utils');
          await prisma.partnerProfile.create({
            data: {
              userId: user.id,
              referralCode: generateReferralCode(),
            },
          });
        }
      }

      // Create wallet only for brand new users
      if (!isAddingRole) {
        await prisma.wallet.create({
          data: { userId: user.id },
        });
      }
    } catch (profileOrWalletErr) {
      // Cleanup only if this was a brand new user
      if (!isAddingRole) {
        logger.error({ err: profileOrWalletErr, userId: user.id }, 'Register failed after user.create — cleaning up');
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
      throw profileOrWalletErr;
    }

    // Create session (outside cleanup block — failing here is non-catastrophic)
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    // ---- 5. Post-transaction side-effects (fire-and-forget) ----
    SmsService.sendWelcome(user.phone, user.firstName, input.role as any).catch((err) => {
      logger.error({ err, phone: user.phone }, 'Failed to send welcome SMS');
    });

    // Clean up used REGISTRATION OTPs for this phone
    prisma.otp
      .deleteMany({ where: { phone: input.phone, purpose: 'REGISTRATION' } })
      .catch(() => {});

    // ---- 6. Generate tokens ----
    const roles = getUserRoles(user);
    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role as UserRole,
      roles,
      sessionId: session.id,
    });

    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });

    logger.info({ userId: user.id, role: user.role, phone: user.phone }, 'User registered');

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        roles,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }

  // ---- Login with OTP ----

  static async loginWithOtp(phone: string, otpCode: string, deviceInfo?: string, ipAddress?: string) {
    // Verify the OTP first
    const otp = await prisma.otp.findFirst({
      where: { phone, purpose: 'LOGIN', verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw ApiError.badRequest('No pending OTP found. Please request a new code.', 'OTP_NOT_FOUND');
    }

    if (otp.attempts >= 5) {
      throw ApiError.tooManyRequests('Too many OTP attempts. Please request a new code.');
    }

    if (new Date() > otp.expiresAt) {
      throw ApiError.badRequest('OTP has expired. Please request a new code.', 'OTP_EXPIRED');
    }

    // Constant-time comparison
    const codeMatch =
      otp.code.length === otpCode.length &&
      crypto.timingSafeEqual(Buffer.from(otp.code), Buffer.from(otpCode));

    if (!codeMatch) {
      await prisma.otp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw ApiError.badRequest('Invalid OTP code', 'OTP_INVALID');
    }

    // Mark OTP as verified/consumed
    await prisma.otp.update({
      where: { id: otp.id },
      data: { verified: true },
    });

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw ApiError.notFound('No account found with this phone number', 'USER_NOT_FOUND');
    }
    if (user.status === 'BANNED' || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account is not active');
    }

    // Create session + tokens
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    const roles = getUserRoles(user);
    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role as UserRole,
      roles,
      sessionId: session.id,
    });

    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        roles,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }

  // ---- Refresh token ----

  static async refreshTokens(token: string) {
    const { userId, sessionId } = this.verifyRefreshToken(token);

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId || new Date() > session.expiresAt) {
      throw ApiError.unauthorized('Session expired or invalid');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'BANNED' || user.status === 'DEACTIVATED') {
      throw ApiError.forbidden('Account is not active');
    }

    // Rotate tokens
    const roles = getUserRoles(user);
    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role as UserRole,
      roles,
      sessionId: session.id,
    });

    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });

    // Extend session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        lastActiveAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }

  // ---- Logout ----

  static async logout(sessionId: string) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {
      // Session may already be deleted
    });
  }

  // ---- Password-based login ----

  static async loginWithPassword(email: string, password: string, deviceInfo?: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.status === 'BANNED' || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account is not active');
    }

    const isValid = await this.comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    const roles = getUserRoles(user);
    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role as UserRole,
      roles,
      sessionId: session.id,
    });

    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        roles,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }

  // ---- Session management ----

  static async listSessions(userId: string) {
    return prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        lastActiveAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  static async revokeSession(userId: string, sessionId: string) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw ApiError.notFound('Session not found');
    }
    await prisma.session.delete({ where: { id: sessionId } });
  }

  static async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: {
        userId,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
    });
    return result.count;
  }

  // ---- Change password ----

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.passwordHash) {
      const isValid = await this.comparePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        throw ApiError.badRequest('Current password is incorrect', 'INVALID_PASSWORD');
      }
    }

    const newHash = await this.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
  }

  // ---- Login with PIN ----

  static async loginWithPin(phone: string, pin: string, deviceInfo?: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.passwordHash) {
      throw ApiError.unauthorized('Invalid phone number or PIN');
    }

    if (user.status === 'BANNED' || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account is not active');
    }

    const isValid = await this.comparePassword(pin, user.passwordHash);
    if (!isValid) {
      throw ApiError.unauthorized('Invalid phone number or PIN');
    }

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    const roles = getUserRoles(user);
    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role as UserRole,
      roles,
      sessionId: session.id,
    });

    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: user.id, method: 'pin' }, 'User logged in with PIN');

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        roles,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }

  // ---- Change PIN ----

  static async changePin(userId: string, currentPin: string, newPin: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.passwordHash) {
      const isValid = await this.comparePassword(currentPin, user.passwordHash);
      if (!isValid) {
        throw ApiError.badRequest('Current PIN is incorrect', 'INVALID_PIN');
      }
    }

    const newHash = await this.hashPassword(newPin);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    logger.info({ userId }, 'PIN changed');
  }

  /**
   * Set a PIN for the first time (users who registered without one).
   * If the user already has a PIN, this is a no-op error that guides them to changePin.
   */
  static async setPin(userId: string, pin: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.passwordHash) {
      throw ApiError.badRequest('PIN already set. Use change-pin instead.', 'PIN_ALREADY_SET');
    }

    const hash = await this.hashPassword(pin);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    logger.info({ userId }, 'PIN set for first time');
  }

  // ---- Reset PIN via OTP ----

  /**
   * Reset a forgotten PIN after verifying an OTP.
   * Public endpoint — no authentication required.
   * Flow: enter phone → request OTP → verify OTP → set new PIN.
   */
  static async resetPinWithOtp(phone: string, otpCode: string, newPin: string) {
    // Validate OTP
    const otp = await prisma.otp.findFirst({
      where: {
        phone,
        code: otpCode,
        purpose: 'PASSWORD_RESET',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw ApiError.badRequest('Invalid or expired OTP', 'INVALID_OTP');
    }

    // Mark OTP as consumed
    await prisma.otp.update({
      where: { id: otp.id },
      data: { verified: true },
    });

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw ApiError.notFound('No account found with this phone number', 'USER_NOT_FOUND');
    }

    if (user.status === 'BANNED' || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account is not active');
    }

    // Set the new PIN
    const hash = await this.hashPassword(newPin);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    });

    // Clean up used PASSWORD_RESET OTPs for this phone
    prisma.otp
      .deleteMany({ where: { phone, purpose: 'PASSWORD_RESET' } })
      .catch(() => {});

    logger.info({ userId: user.id }, 'PIN reset via OTP');

    return { success: true };
  }

  // ---- Check available auth methods for a phone ----

  static async checkAuthMethods(phone: string) {
    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        passwordHash: true,
        webauthnCredentials: {
          select: { id: true },
        },
      },
    });

    // Don't reveal whether the phone is registered — always return methods
    // but they'll fail at login time if the account doesn't exist.
    return {
      otp: true, // always available
      pin: !!user?.passwordHash,
      biometric: (user?.webauthnCredentials?.length ?? 0) > 0,
    };
  }

  // ============================================================
  // WebAuthn — Biometric Registration & Login
  // ============================================================

  /**
   * Generate registration options for a logged-in user to register
   * a new biometric credential (fingerprint, Face ID, etc.).
   */
  static async webauthnRegisterOptions(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        webauthnCredentials: {
          select: { credentialId: true, transports: true },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const options = await generateRegistrationOptions({
      rpName: config.webauthn.rpName,
      rpID: config.webauthn.rpID,
      userName: user.phone,
      userDisplayName: `${user.firstName} ${user.lastName}`,
      // Exclude already-registered credentials so user can't re-register the same one
      excludeCredentials: user.webauthnCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports as any[],
      })),
      authenticatorSelection: {
        // Prefer platform authenticators (fingerprint, Face ID)
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
      attestationType: 'none', // We don't need attestation for our use case
    });

    // Store challenge for verification
    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        userId: user.id,
        type: 'registration',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    // Clean up old expired challenges in background
    prisma.webAuthnChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    }).catch(() => {});

    return options;
  }

  /**
   * Verify registration response and store the new credential.
   */
  static async webauthnRegisterVerify(
    userId: string,
    credential: RegistrationResponseJSON,
    friendlyName?: string
  ) {
    // Find the challenge we stored
    const challengeRecord = await prisma.webAuthnChallenge.findFirst({
      where: {
        userId,
        type: 'registration',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challengeRecord) {
      throw ApiError.badRequest('No pending registration challenge found. Please try again.', 'CHALLENGE_NOT_FOUND');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: config.webauthn.origin,
        expectedRPID: config.webauthn.rpID,
        requireUserVerification: true,
      });
    } catch (err) {
      logger.error({ err, userId }, 'WebAuthn registration verification failed');
      throw ApiError.badRequest('Biometric registration verification failed', 'WEBAUTHN_VERIFY_FAILED');
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw ApiError.badRequest('Biometric registration could not be verified', 'WEBAUTHN_VERIFY_FAILED');
    }

    const { credential: regCredential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Store the credential
    await prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: Buffer.from(regCredential.id).toString('base64url'),
        publicKey: Buffer.from(regCredential.publicKey).toString('base64url'),
        counter: BigInt(regCredential.counter),
        deviceType: credentialDeviceType,
        transports: credential.response.transports ?? [],
        backedUp: credentialBackedUp,
        friendlyName: friendlyName ?? null,
      },
    });

    // Clean up the used challenge
    await prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } }).catch(() => {});

    logger.info({ userId, credentialId: regCredential.id }, 'WebAuthn credential registered');

    return { verified: true };
  }

  /**
   * Generate authentication options for biometric login.
   * Called with a phone number to look up the user's credentials.
   */
  static async webauthnLoginOptions(phone: string) {
    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        webauthnCredentials: {
          select: { credentialId: true, transports: true },
        },
      },
    });

    if (!user || user.webauthnCredentials.length === 0) {
      throw ApiError.badRequest('No biometric credentials found for this phone number', 'NO_CREDENTIALS');
    }

    const options = await generateAuthenticationOptions({
      rpID: config.webauthn.rpID,
      allowCredentials: user.webauthnCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports as any[],
      })),
      userVerification: 'required',
    });

    // Store challenge
    await prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        phone,
        type: 'authentication',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return options;
  }

  /**
   * Verify authentication response and log the user in.
   */
  static async webauthnLoginVerify(
    phone: string,
    credential: AuthenticationResponseJSON,
    deviceInfo?: string,
    ipAddress?: string
  ) {
    // Find the challenge
    const challengeRecord = await prisma.webAuthnChallenge.findFirst({
      where: {
        phone,
        type: 'authentication',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challengeRecord) {
      throw ApiError.badRequest('No pending authentication challenge found. Please try again.', 'CHALLENGE_NOT_FOUND');
    }

    // Find the credential in our database
    const credentialIdBase64 = credential.id;
    const storedCredential = await prisma.webAuthnCredential.findUnique({
      where: { credentialId: credentialIdBase64 },
      include: { user: true },
    });

    if (!storedCredential) {
      throw ApiError.badRequest('Biometric credential not recognized', 'CREDENTIAL_NOT_FOUND');
    }

    // Verify the user belongs to the correct phone
    if (storedCredential.user.phone !== phone) {
      throw ApiError.badRequest('Credential does not match this phone number', 'CREDENTIAL_MISMATCH');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: config.webauthn.origin,
        expectedRPID: config.webauthn.rpID,
        requireUserVerification: true,
        credential: {
          id: storedCredential.credentialId,
          publicKey: Buffer.from(storedCredential.publicKey, 'base64url'),
          counter: Number(storedCredential.counter),
          transports: storedCredential.transports as any[],
        },
      });
    } catch (err) {
      logger.error({ err, phone }, 'WebAuthn authentication verification failed');
      throw ApiError.badRequest('Biometric verification failed', 'WEBAUTHN_VERIFY_FAILED');
    }

    if (!verification.verified) {
      throw ApiError.badRequest('Biometric verification failed', 'WEBAUTHN_VERIFY_FAILED');
    }

    // Update credential counter (to prevent replay attacks)
    await prisma.webAuthnCredential.update({
      where: { id: storedCredential.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    // Clean up challenge
    await prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } }).catch(() => {});

    const user = storedCredential.user;
    if (user.status === 'BANNED' || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account is not active');
    }

    // Create session + tokens
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    const roles = getUserRoles(user);
    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role as UserRole,
      roles,
      sessionId: session.id,
    });

    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: user.id, method: 'webauthn' }, 'User logged in with biometric');

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        roles,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }

  // ---- List WebAuthn credentials ----

  static async listWebAuthnCredentials(userId: string) {
    return prisma.webAuthnCredential.findMany({
      where: { userId },
      select: {
        id: true,
        friendlyName: true,
        deviceType: true,
        backedUp: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- Remove WebAuthn credential ----

  static async removeWebAuthnCredential(userId: string, credentialId: string) {
    const credential = await prisma.webAuthnCredential.findUnique({
      where: { id: credentialId },
    });
    if (!credential || credential.userId !== userId) {
      throw ApiError.notFound('Credential not found');
    }
    await prisma.webAuthnCredential.delete({ where: { id: credentialId } });
    logger.info({ userId, credentialId }, 'WebAuthn credential removed');
  }
}
