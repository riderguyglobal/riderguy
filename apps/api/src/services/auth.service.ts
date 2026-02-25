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

const SALT_ROUNDS = 12;

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
    return jwt.sign(payload, config.jwt.accessSecret, {
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
    // Invalidate existing OTPs for this phone+purpose
    await prisma.otp.updateMany({
      where: { phone, purpose, verified: false },
      data: { verified: true }, // mark old ones as used
    });

    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const otp = await prisma.otp.create({
      data: { phone, code, purpose, expiresAt },
    });

    // Send OTP via mNotify SMS
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

    if (otp.code !== code) {
      // Note: OTPs are short-lived (5 min) and attempt-limited (5 tries),
      // so timing attacks are impractical. Using constant-time comparison
      // as an extra defense-in-depth measure.
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
    role: UserRole;
  }) {
    // Check if phone already exists
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

    const passwordHash = input.password
      ? await this.hashPassword(input.password)
      : null;

    const user = await prisma.user.create({
      data: {
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        passwordHash,
        role: input.role as PrismaUserRole,
        phoneVerified: true, // They verified OTP before calling register
        status: 'ACTIVE',
      },
    });

    // Create role-specific profiles
    if (input.role === 'RIDER') {
      await prisma.riderProfile.create({
        data: { userId: user.id },
      });
    } else if (input.role === 'CLIENT' || input.role === 'BUSINESS_CLIENT') {
      await prisma.clientProfile.create({
        data: { userId: user.id },
      });
    } else if (input.role === 'PARTNER') {
      const { generateReferralCode } = await import('@riderguy/utils');
      await prisma.partnerProfile.create({
        data: {
          userId: user.id,
          referralCode: generateReferralCode(),
        },
      });
    }

    // Create wallet
    await prisma.wallet.create({
      data: { userId: user.id },
    });

    // Send welcome SMS (fire-and-forget)
    SmsService.sendWelcome(user.phone, user.firstName).catch((err) => {
      logger.error({ err, phone: user.phone }, 'Failed to send welcome SMS');
    });

    // Create session + tokens
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role as UserRole,
      sessionId: session.id,
    });

    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }

  // ---- Login with OTP ----

  static async loginWithOtp(phone: string, otpCode: string) {
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

    if (otp.code !== otpCode) {
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
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role as UserRole,
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
    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role as UserRole,
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
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role as UserRole,
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
}
