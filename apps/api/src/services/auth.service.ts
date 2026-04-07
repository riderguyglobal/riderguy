import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@riderguy/database';
import { config } from '../config';
import { ApiError } from '../lib/api-error';
import { logger } from '../lib/logger';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
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
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_WEBAUTHN_CREDENTIALS = 10;

/** SHA-256 hash a token for storage (fast, sufficient for high-entropy JWTs). */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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
    // For LOGIN and PASSWORD_RESET, only send SMS if user exists (saves SMS credits).
    // Always return the same shape to avoid phone-number enumeration.
    if (purpose !== 'REGISTRATION') {
      const userExists = await prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      });
      if (!userExists) {
        logger.info({ phone, purpose }, 'OTP requested for non-existent user — suppressing SMS');
        return { id: 'suppressed', phone, purpose, expiresAt: new Date(Date.now() + 5 * 60 * 1000) } as any;
      }
    }

    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create new OTP (critical path — only DB call we await)
    const otp = await prisma.otp.create({ data: { phone, code, purpose, expiresAt } });

    // Invalidate old OTPs in background (fire-and-forget, excludes new OTP)
    prisma.otp.updateMany({
      where: { phone, purpose, verified: false, id: { not: otp.id } },
      data: { verified: true },
    }).catch(() => {});

    // Send OTP via mNotify SMS — await to detect delivery failures
    const smsSent = await SmsService.sendOtp(phone, code);
    if (!smsSent) {
      logger.error({ phone, purpose }, 'Failed to send OTP SMS via mNotify');
    }

    if (config.nodeEnv === 'development') {
      logger.info({ phone, purpose, code }, 'OTP created (dev only)');
    } else {
      logger.info({ phone, purpose }, 'OTP created');
    }

    return otp;
  }

  /**
   * Core OTP verification with attempt tracking and constant-time comparison.
   * Used by verifyOtp, loginWithOtp, and resetPinWithOtp.
   */
  private static async _verifyOtpCode(
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
    const padded = (s: string) => s.padEnd(6, '\0').slice(0, 6);
    const lengthOk = otp.code.length === code.length;
    const bytesMatch = crypto.timingSafeEqual(Buffer.from(padded(otp.code)), Buffer.from(padded(code)));

    if (!(lengthOk && bytesMatch)) {
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

    return otp;
  }

  static async verifyOtp(
    phone: string,
    code: string,
    purpose: 'REGISTRATION' | 'LOGIN' | 'PASSWORD_RESET'
  ) {
    await this._verifyOtpCode(phone, code, purpose);
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
    // Note: phone uniqueness is handled in the user creation block below,
    // which supports multi-role registration (same phone, different role).

    if (input.email) {
      const emailExists = await prisma.user.findUnique({ where: { email: input.email } });
      if (emailExists) {
        throw ApiError.badRequest('Unable to create account. Please try a different email or log in.', 'REGISTRATION_FAILED');
      }
    }

    // ---- 3. Credential hashing (optional for phone-only signups) ----
    const passwordHash = input.password ? await this.hashPassword(input.password) : null;
    const pinHash = input.pin ? await this.hashPassword(input.pin) : null;

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
            pinHash,
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
          // TODO: Remove ACTIVATED default — temporary skip of onboarding & admin approval
          await prisma.riderProfile.create({ data: { userId: user.id, onboardingStatus: 'ACTIVATED' } });
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

    await prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(refreshToken) } });

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

  // ---- Email Registration (no phone/OTP required) ----

  static async registerWithEmail(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }, deviceInfo?: string, ipAddress?: string) {
    // ---- 1. Uniqueness check ----
    const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingEmail) {
      // Return a generic message to prevent email enumeration attacks.
      // Do NOT reveal whether the email is already registered.
      throw ApiError.badRequest('Unable to create account. Please try a different email or log in.', 'REGISTRATION_FAILED');
    }

    // ---- 2. Hash password ----
    const passwordHash = await this.hashPassword(input.password);

    // ---- 3. Create user ----
    let user;
    // phone is required in the schema; generate a unique placeholder for email-only signups
    const placeholderPhone = `email_${crypto.randomUUID()}`;
    try {
      user = await prisma.user.create({
        data: {
          phone: placeholderPhone,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash,
          role: input.role as PrismaUserRole,
          roles: [input.role as PrismaUserRole],
          emailVerified: false,
          status: 'ACTIVE',
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw ApiError.badRequest('Unable to create account. Please try a different email or log in.', 'REGISTRATION_FAILED');
      }
      throw err;
    }

    // ---- 4. Create profile + wallet ----
    try {
      if (input.role === 'RIDER') {
        await prisma.riderProfile.create({ data: { userId: user.id } });
      } else if (input.role === 'CLIENT' || input.role === 'BUSINESS_CLIENT') {
        await prisma.clientProfile.create({ data: { userId: user.id } });
      } else if (input.role === 'PARTNER') {
        const { generateReferralCode } = await import('@riderguy/utils');
        await prisma.partnerProfile.create({
          data: { userId: user.id, referralCode: generateReferralCode() },
        });
      }

      await prisma.wallet.create({ data: { userId: user.id } });
    } catch (profileOrWalletErr) {
      logger.error({ err: profileOrWalletErr, userId: user.id }, 'Email register failed after user.create — cleaning up');
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      throw profileOrWalletErr;
    }

    // ---- 5. Create session ----
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

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

    await prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(refreshToken) } });

    logger.info({ userId: user.id, role: user.role, email: user.email }, 'User registered via email');

    // Fire-and-forget verification email
    this.sendVerificationEmail(user.id).catch((err) =>
      logger.error({ err, userId: user.id }, 'Failed to send verification email after registration')
    );

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

  // ---- Google OAuth ----

  static async authenticateWithGoogle(
    credential: string,
    role: UserRole,
    deviceInfo?: string,
    ipAddress?: string,
  ) {
    // 1. Verify Google credential (supports both access tokens and ID tokens)
    const clientId = config.google.clientId;
    let email: string;
    let given_name: string | undefined;
    let family_name: string | undefined;
    let email_verified: boolean | undefined;

    try {
      // Try as access token first (implicit flow) — call Google userinfo endpoint
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${credential}` },
      });

      if (userinfoRes.ok) {
        const info = await userinfoRes.json() as {
          email: string;
          given_name?: string;
          family_name?: string;
          email_verified?: boolean;
        };
        email = info.email;
        given_name = info.given_name;
        family_name = info.family_name;
        email_verified = info.email_verified;
      } else if (clientId) {
        // Fall back to ID token verification
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
        const payload = ticket.getPayload();
        if (!payload?.email) throw new Error('no email');
        email = payload.email;
        given_name = payload.given_name;
        family_name = payload.family_name;
        email_verified = payload.email_verified;
      } else {
        throw new Error('invalid credential');
      }
    } catch {
      throw ApiError.unauthorized('Invalid Google credential');
    }

    if (!email) {
      throw ApiError.unauthorized('Google account has no email');
    }

    // 2. Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // phone is required in the schema; generate a unique placeholder for Google signups
      const placeholderPhone = `google_${crypto.randomUUID()}`;
      try {
        user = await prisma.user.create({
          data: {
            phone: placeholderPhone,
            email,
            firstName: given_name ?? '',
            lastName: family_name ?? '',
            emailVerified: email_verified ?? false,
            role: role as PrismaUserRole,
            roles: [role as PrismaUserRole],
            status: 'ACTIVE',
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          // Race condition — another request created the same user
          user = await prisma.user.findUnique({ where: { email } });
          if (!user) throw err;
        } else {
          throw err;
        }
      }

      // Create profile + wallet for new user
      try {
        if (role === 'RIDER') {
          await prisma.riderProfile.create({ data: { userId: user.id } });
        } else if (role === 'CLIENT' || role === 'BUSINESS_CLIENT') {
          await prisma.clientProfile.create({ data: { userId: user.id } });
        } else if (role === 'PARTNER') {
          const { generateReferralCode } = await import('@riderguy/utils');
          await prisma.partnerProfile.create({
            data: { userId: user.id, referralCode: generateReferralCode() },
          });
        }
        await prisma.wallet.create({ data: { userId: user.id } });
      } catch (profileOrWalletErr) {
        logger.error({ err: profileOrWalletErr, userId: user.id }, 'Google auth failed after user.create — cleaning up');
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
        throw profileOrWalletErr;
      }
    }

    // 3. Create session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo,
        ipAddress,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    // 4. Generate tokens
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

    await prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(refreshToken) } });

    logger.info(
      { userId: user.id, role: user.role, email: user.email, isNewUser },
      'User authenticated via Google',
    );

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
      isNewUser,
    };
  }

  // ---- Login with OTP ----

  static async loginWithOtp(phone: string, otpCode: string, deviceInfo?: string, ipAddress?: string) {
    // Verify the OTP using shared helper
    await this._verifyOtpCode(phone, otpCode, 'LOGIN');

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

    await prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(refreshToken) } });

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

    // Refresh-token rotation: verify the presented token matches the stored hash
    if (session.refreshTokenHash && hashToken(token) !== session.refreshTokenHash) {
      // Token reuse detected — likely stolen token replay. Revoke entire session.
      logger.warn({ userId, sessionId }, 'Refresh-token reuse detected, revoking session');
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      throw ApiError.unauthorized('Token reuse detected');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'BANNED' || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
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

    // Atomically extend session + store new hash (conditional on old hash to prevent race)
    const updated = await prisma.session.updateMany({
      where: {
        id: session.id,
        // Match the exact current hash (or null for legacy sessions without rotation)
        refreshTokenHash: session.refreshTokenHash,
      },
      data: {
        lastActiveAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        refreshTokenHash: hashToken(refreshToken),
      },
    });

    if (updated.count === 0) {
      // Another concurrent refresh beat us — treat as reuse
      logger.warn({ userId, sessionId }, 'Concurrent refresh-token race detected');
      throw ApiError.unauthorized('Session was refreshed concurrently. Please retry.');
    }

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

    // Brute-force protection
    await this.checkAccountLock(user);

    const isValid = await this.comparePassword(password, user.passwordHash);
    if (!isValid) {
      await this.recordFailedLogin(user.id);
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Clear failed attempts on success
    if (user.failedLoginAttempts > 0) {
      await this.clearFailedLoginAttempts(user.id);
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

    await prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(refreshToken) } });

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
    if (!user || !user.pinHash) {
      throw ApiError.unauthorized('Invalid phone number or PIN');
    }

    if (user.status === 'BANNED' || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account is not active');
    }

    // Brute-force protection
    await this.checkAccountLock(user);

    const isValid = await this.comparePassword(pin, user.pinHash);
    if (!isValid) {
      await this.recordFailedLogin(user.id);
      throw ApiError.unauthorized('Invalid phone number or PIN');
    }

    // Clear failed attempts on success
    if (user.failedLoginAttempts > 0) {
      await this.clearFailedLoginAttempts(user.id);
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

    await prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(refreshToken) } });

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

    if (!user.pinHash) {
      throw ApiError.badRequest('No PIN set. Use set-pin instead.', 'NO_PIN_SET');
    }

    const isValid = await this.comparePassword(currentPin, user.pinHash);
    if (!isValid) {
      throw ApiError.badRequest('Current PIN is incorrect', 'INVALID_PIN');
    }

    const newHash = await this.hashPassword(newPin);
    await prisma.user.update({
      where: { id: userId },
      data: { pinHash: newHash },
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

    if (user.pinHash) {
      throw ApiError.badRequest('PIN already set. Use change-pin instead.', 'PIN_ALREADY_SET');
    }

    const hash = await this.hashPassword(pin);
    await prisma.user.update({
      where: { id: userId },
      data: { pinHash: hash },
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
    // Validate OTP using shared helper (constant-time comparison + attempt tracking)
    await this._verifyOtpCode(phone, otpCode, 'PASSWORD_RESET');

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
      data: { pinHash: hash },
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
        pinHash: true,
        webauthnCredentials: {
          select: { id: true },
        },
      },
    });

    // Don't reveal whether the phone is registered.
    // Always return the same shape — unregistered phones look like
    // "only OTP available" which is indistinguishable from a real user
    // who hasn't set up PIN or biometric yet.
    return {
      otp: true,
      pin: user ? !!user.pinHash : false,
      biometric: user ? (user.webauthnCredentials.length > 0) : false,
    };
  }

  // ============================================================
  // Email Verification
  // ============================================================

  /**
   * Send a verification email to the user.
   * Creates a secure token in the EmailToken table.
   */
  static async sendVerificationEmail(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.email) return;
    if (user.emailVerified) return; // already verified

    // Invalidate existing verification tokens
    await prisma.emailToken.updateMany({
      where: { userId, purpose: 'EMAIL_VERIFICATION', usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomUUID();
    await prisma.emailToken.create({
      data: {
        userId,
        token,
        purpose: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      },
    });

    // Fire-and-forget — don't block the caller
    EmailService.sendVerificationEmail(user.email, user.firstName, token).catch((err) => {
      logger.error({ err, userId }, 'Failed to send verification email');
    });
  }

  /**
   * Verify email using the token from the verification link.
   */
  static async verifyEmail(token: string) {
    const emailToken = await prisma.emailToken.findUnique({ where: { token } });

    if (!emailToken || emailToken.purpose !== 'EMAIL_VERIFICATION') {
      throw ApiError.badRequest('Invalid verification link', 'INVALID_TOKEN');
    }

    if (emailToken.usedAt) {
      throw ApiError.badRequest('This link has already been used', 'TOKEN_USED');
    }

    if (new Date() > emailToken.expiresAt) {
      throw ApiError.badRequest('This link has expired. Please request a new one.', 'TOKEN_EXPIRED');
    }

    // Mark token as used & verify the email
    await prisma.emailToken.update({
      where: { id: emailToken.id },
      data: { usedAt: new Date() },
    });

    await prisma.user.update({
      where: { id: emailToken.userId },
      data: { emailVerified: true },
    });

    logger.info({ userId: emailToken.userId }, 'Email verified');
    return { success: true };
  }

  /**
   * Resend verification email (public — by email address).
   * Rate-limited at the route level.
   */
  static async resendVerificationEmail(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    // Don't reveal whether the email exists — always return success
    if (!user || user.emailVerified) return { success: true };

    await this.sendVerificationEmail(user.id);
    return { success: true };
  }

  // ============================================================
  // Password Reset (email users)
  // ============================================================

  /**
   * Request a password reset — sends a reset link to the email.
   * Always returns success to prevent email enumeration.
   */
  static async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    // Don't reveal whether the email exists
    if (!user) return { success: true };

    if (user.status === 'BANNED' || user.status === 'DEACTIVATED') {
      return { success: true }; // silent — don't reveal account status
    }

    // Invalidate existing password reset tokens
    await prisma.emailToken.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomUUID();
    await prisma.emailToken.create({
      data: {
        userId: user.id,
        token,
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    EmailService.sendPasswordReset(user.email!, user.firstName, token).catch((err) => {
      logger.error({ err, userId: user.id }, 'Failed to send password reset email');
    });

    logger.info({ userId: user.id }, 'Password reset requested');
    return { success: true };
  }

  /**
   * Reset password using the token from the reset link.
   */
  static async resetPassword(token: string, newPassword: string) {
    const emailToken = await prisma.emailToken.findUnique({ where: { token } });

    if (!emailToken || emailToken.purpose !== 'PASSWORD_RESET') {
      throw ApiError.badRequest('Invalid reset link', 'INVALID_TOKEN');
    }

    if (emailToken.usedAt) {
      throw ApiError.badRequest('This link has already been used', 'TOKEN_USED');
    }

    if (new Date() > emailToken.expiresAt) {
      throw ApiError.badRequest('This link has expired. Please request a new one.', 'TOKEN_EXPIRED');
    }

    const user = await prisma.user.findUnique({ where: { id: emailToken.userId } });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.status === 'BANNED' || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account is not active');
    }

    // Atomically mark token as used (prevents TOCTOU race with concurrent requests)
    const tokenUpdate = await prisma.emailToken.updateMany({
      where: { id: emailToken.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (tokenUpdate.count === 0) {
      throw ApiError.badRequest('This link has already been used', 'TOKEN_USED');
    }

    // Hash new password and update
    const passwordHash = await this.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    // Revoke all sessions (force re-login)
    await prisma.session.deleteMany({ where: { userId: user.id } });

    // Invalidate any remaining reset tokens
    await prisma.emailToken.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: new Date() },
    });

    logger.info({ userId: user.id }, 'Password reset completed');
    return { success: true };
  }

  // ============================================================
  // Brute-Force Protection Helpers
  // ============================================================

  private static async checkAccountLock(user: { id: string; lockedUntil: Date | null; failedLoginAttempts: number }) {
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw ApiError.tooManyRequests(
        `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      );
    }
    // If lock has expired, reset the counter
    if (user.lockedUntil && new Date() >= user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
  }

  private static async recordFailedLogin(userId: string) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    if (updated.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      await prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
      });
      logger.warn({ userId }, 'Account locked due to too many failed login attempts');
    }
  }

  private static async clearFailedLoginAttempts(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  // ============================================================
  // Expired Record Cleanup
  // ============================================================

  /**
   * Delete expired sessions, OTPs, WebAuthn challenges, and email tokens.
   * Call this from a cron job or scheduled task.
   */
  static async cleanupExpiredRecords() {
    const now = new Date();
    const [sessions, otps, challenges, tokens] = await Promise.all([
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.otp.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.webAuthnChallenge.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.emailToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);

    logger.info(
      { sessions: sessions.count, otps: otps.count, challenges: challenges.count, tokens: tokens.count },
      'Expired records cleaned up',
    );

    return {
      sessions: sessions.count,
      otps: otps.count,
      challenges: challenges.count,
      tokens: tokens.count,
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
        status: true,
        webauthnCredentials: {
          select: { credentialId: true, transports: true },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.status === 'BANNED' || user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account is not active');
    }

    if (user.webauthnCredentials.length >= MAX_WEBAUTHN_CREDENTIALS) {
      throw ApiError.badRequest(
        `Maximum of ${MAX_WEBAUTHN_CREDENTIALS} biometric credentials reached. Please remove one before adding another.`,
        'MAX_CREDENTIALS_REACHED',
      );
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
    }).catch((err) => {
      logger.error({ err }, 'Failed to cleanup expired WebAuthn challenges');
    });

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

    // Defence-in-depth: re-check credential count before storing
    const existingCount = await prisma.webAuthnCredential.count({ where: { userId } });
    if (existingCount >= MAX_WEBAUTHN_CREDENTIALS) {
      throw ApiError.badRequest(
        `Maximum of ${MAX_WEBAUTHN_CREDENTIALS} biometric credentials reached.`,
        'MAX_CREDENTIALS_REACHED',
      );
    }

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

    // Update credential counter atomically — only succeeds if counter matches
    // what we read, preventing replay attacks from concurrent requests.
    const counterUpdate = await prisma.webAuthnCredential.updateMany({
      where: {
        id: storedCredential.id,
        counter: storedCredential.counter, // Must still match what we verified against
      },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    if (counterUpdate.count === 0) {
      throw ApiError.badRequest('Biometric credential was used concurrently (replay detected)', 'WEBAUTHN_REPLAY');
    }

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

    await prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(refreshToken) } });

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
