import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// ── Type helper ──
const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// ── Mock config (must be before AuthService import) ──
vi.mock('../config', () => ({
  config: {
    nodeEnv: 'test',
    isProduction: false,
    jwt: {
      accessSecret: 'test-access-secret-with-enough-length-32chars',
      refreshSecret: 'test-refresh-secret-with-enough-length-32chars',
      accessExpiresIn: '15m',
      refreshExpiresIn: '30d',
    },
  },
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    otp: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    emailToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    riderProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    clientProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    partnerProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    wallet: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./sms.service', () => ({
  SmsService: {
    sendOtp: vi.fn().mockResolvedValue({ success: true }),
    sendWelcome: vi.fn().mockResolvedValue({ success: true }),
    sendNewJobAvailable: vi.fn().mockResolvedValue({ success: true }),
    sendOrderUpdate: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('./email.service', () => ({
  EmailService: {
    sendOtp: vi.fn().mockResolvedValue({ success: true }),
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

// ── Import AFTER mocks ──
import { AuthService } from './auth.service';
import { prisma } from '@riderguy/database';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';

// ── Test Data ──
const RIDER_PHONE = '+233241234567';
const CLIENT_PHONE = '+233501234567';
const TEST_EMAIL = 'test@riderguy.com';
const TEST_OTP = '123456';
const TEST_PIN = '1234';
const TEST_PIN_6 = '123456';
const TEST_GHANA_CARD = 'GHA-123456789-1';

const fastHash = (value: string) => bcrypt.hash(value, 4);

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    phone: RIDER_PHONE,
    email: TEST_EMAIL,
    firstName: 'Kwame',
    lastName: 'Mensah',
    role: 'RIDER',
    roles: ['RIDER'],
    status: 'ACTIVE',
    passwordHash: null,
    pinHash: '$2a$12$mockPinHash',
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    ...overrides,
  };
}

function mockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    deviceInfo: 'Test Device',
    ipAddress: '127.0.0.1',
    refreshTokenHash: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lastActiveAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

function mockOtp(overrides: Record<string, unknown> = {}) {
  return {
    id: 'otp-1',
    phone: RIDER_PHONE,
    code: TEST_OTP,
    purpose: 'REGISTRATION',
    verified: false,
    attempts: 0,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}

function mockLoginEmailConfirmation(email = TEST_EMAIL) {
  asMock(prisma.otp.create).mockResolvedValue(mockOtp({
    id: 'login-email-otp',
    phone: email,
    purpose: 'LOGIN_EMAIL_CONFIRM',
  }));
  asMock(prisma.otp.updateMany).mockResolvedValue({ count: 0 });
}

function expectLoginEmailConfirmation(result: { requiresEmailConfirmation?: boolean; userId?: string }) {
  expect(result.requiresEmailConfirmation).toBe(true);
  expect(result.userId).toBe('user-1');
  expect(result).not.toHaveProperty('accessToken');
  expect(prisma.session.create).not.toHaveBeenCalled();
  expect(prisma.otp.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      phone: TEST_EMAIL,
      purpose: 'LOGIN_EMAIL_CONFIRM',
    }),
  });
  expect(EmailService.sendOtp).toHaveBeenCalledWith(
    TEST_EMAIL,
    'Kwame',
    expect.any(String),
    'sign-in verification',
  );
}

// ============================================================
// AUTH SERVICE — COMPREHENSIVE SIMULATION TESTS
// ============================================================

describe('AuthService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    asMock(SmsService.sendOtp).mockResolvedValue({ success: true });
    asMock(SmsService.sendWelcome).mockResolvedValue({ success: true });
    asMock(SmsService.sendNewJobAvailable).mockResolvedValue({ success: true });
    asMock(SmsService.sendOrderUpdate).mockResolvedValue({ success: true });
    asMock(EmailService.sendOtp).mockResolvedValue({ success: true });
    asMock(EmailService.sendVerificationEmail).mockResolvedValue(undefined);
    asMock(EmailService.sendPasswordResetEmail).mockResolvedValue(undefined);
    asMock(EmailService.sendPasswordReset).mockResolvedValue(undefined);
  });

  // ────────────────────────────────────────────────────────────
  // 1. OTP FLOW — Real user requests OTP, receives code, verifies
  // ────────────────────────────────────────────────────────────
  describe('OTP Flow', () => {
    it('should create an OTP for registration (new user)', async () => {
      const otp = mockOtp();
      asMock(prisma.otp.create).mockResolvedValue(otp);
      asMock(prisma.otp.updateMany).mockResolvedValue({ count: 0 });

      const result = await AuthService.createOtp(RIDER_PHONE, 'REGISTRATION');

      expect(result).toEqual(otp);
      expect(prisma.otp.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phone: RIDER_PHONE,
          purpose: 'REGISTRATION',
          code: expect.stringMatching(/^\d{6}$/),
        }),
      });
    });

    it('should suppress OTP SMS for login if user does not exist (anti-enumeration)', async () => {
      asMock(prisma.user.findUnique).mockResolvedValue(null);

      const result = await AuthService.createOtp(RIDER_PHONE, 'LOGIN');

      // Returns suppressed result — shape looks normal to caller
      expect(result.id).toBe('suppressed');
      expect(prisma.otp.create).not.toHaveBeenCalled();
    });

    it('should create OTP for login when user exists', async () => {
      asMock(prisma.user.findUnique).mockResolvedValue(mockUser());
      const otp = mockOtp({ purpose: 'LOGIN' });
      asMock(prisma.otp.create).mockResolvedValue(otp);
      asMock(prisma.otp.updateMany).mockResolvedValue({ count: 0 });

      const result = await AuthService.createOtp(RIDER_PHONE, 'LOGIN');

      expect(result).toEqual(otp);
    });

    it('should verify a valid OTP code', async () => {
      const otp = mockOtp();
      asMock(prisma.otp.findFirst).mockResolvedValue(otp);
      asMock(prisma.otp.update).mockResolvedValue({ ...otp, verified: true });

      const result = await AuthService.verifyOtp(RIDER_PHONE, TEST_OTP, 'REGISTRATION');

      expect(result).toBe(true);
      expect(prisma.otp.update).toHaveBeenCalledWith({
        where: { id: otp.id },
        data: { verified: true },
      });
    });

    it('should reject an invalid OTP code and increment attempts', async () => {
      const otp = mockOtp();
      asMock(prisma.otp.findFirst).mockResolvedValue(otp);
      asMock(prisma.otp.update).mockResolvedValue({ ...otp, attempts: 1 });

      await expect(AuthService.verifyOtp(RIDER_PHONE, '999999', 'REGISTRATION'))
        .rejects.toThrow('Invalid OTP code');

      expect(prisma.otp.update).toHaveBeenCalledWith({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
    });

    it('should reject expired OTP', async () => {
      const otp = mockOtp({ expiresAt: new Date(Date.now() - 60_000) }); // expired 1 min ago
      asMock(prisma.otp.findFirst).mockResolvedValue(otp);

      await expect(AuthService.verifyOtp(RIDER_PHONE, TEST_OTP, 'REGISTRATION'))
        .rejects.toThrow('OTP has expired');
    });

    it('should reject after 5 failed attempts', async () => {
      const otp = mockOtp({ attempts: 5 });
      asMock(prisma.otp.findFirst).mockResolvedValue(otp);

      await expect(AuthService.verifyOtp(RIDER_PHONE, TEST_OTP, 'REGISTRATION'))
        .rejects.toThrow('Too many OTP attempts');
    });

    it('should reject when no pending OTP exists', async () => {
      asMock(prisma.otp.findFirst).mockResolvedValue(null);

      await expect(AuthService.verifyOtp(RIDER_PHONE, TEST_OTP, 'REGISTRATION'))
        .rejects.toThrow('No pending OTP found');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2. REGISTRATION — new rider signs up with phone + OTP
  // ────────────────────────────────────────────────────────────
  describe('Registration', () => {
    it('should register a brand new rider after OTP verification', async () => {
      const user = mockUser();
      const session = mockSession();

      // Verified OTP exists
      asMock(prisma.otp.findFirst).mockResolvedValue(mockOtp({ verified: true, createdAt: new Date() }));
      // No email conflict
      asMock(prisma.user.findUnique).mockResolvedValueOnce(null); // email check
      asMock(prisma.user.findUnique).mockResolvedValueOnce(null); // phone check (existing user)
      // Create user
      asMock(prisma.user.create).mockResolvedValue(user);
      // Create rider profile
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(null);
      asMock(prisma.riderProfile.create).mockResolvedValue({ id: 'rp-1', userId: user.id });
      // Create wallet
      asMock(prisma.wallet.create).mockResolvedValue({ id: 'w-1', userId: user.id });
      // Create session
      asMock(prisma.session.create).mockResolvedValue(session);
      asMock(prisma.session.update).mockResolvedValue(session);
      // Cleanup OTPs
      asMock(prisma.otp.deleteMany).mockResolvedValue({ count: 1 });

      const result = await AuthService.register({
        phone: RIDER_PHONE,
        firstName: 'Kwame',
        lastName: 'Mensah',
        email: TEST_EMAIL,
        pin: TEST_PIN,
        role: 'RIDER' as any,
      });

      expect(result.user.id).toBe('user-1');
      expect(result.user.phone).toBe(RIDER_PHONE);
      expect(result.user.role).toBe('RIDER');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // Should have created rider profile
      expect(prisma.riderProfile.create).toHaveBeenCalled();
      // Should have created wallet
      expect(prisma.wallet.create).toHaveBeenCalled();
    });

    it('should reject registration without OTP verification', async () => {
      asMock(prisma.otp.findFirst).mockResolvedValue(null);

      await expect(
        AuthService.register({
          phone: RIDER_PHONE,
          firstName: 'Kwame',
          lastName: 'Mensah',
          role: 'RIDER' as any,
        }),
      ).rejects.toThrow('Phone number not verified');
    });

    it('should reject registration with expired OTP verification', async () => {
      // OTP verified but older than 15 minutes
      asMock(prisma.otp.findFirst).mockResolvedValue(
        mockOtp({ verified: true, createdAt: new Date(Date.now() - 20 * 60 * 1000) }),
      );

      await expect(
        AuthService.register({
          phone: RIDER_PHONE,
          firstName: 'Kwame',
          lastName: 'Mensah',
          role: 'RIDER' as any,
        }),
      ).rejects.toThrow('OTP verification has expired');
    });

    it('should reject duplicate email', async () => {
      asMock(prisma.otp.findFirst).mockResolvedValue(mockOtp({ verified: true, createdAt: new Date() }));
      asMock(prisma.user.findUnique).mockResolvedValue(mockUser()); // email exists

      await expect(
        AuthService.register({
          phone: RIDER_PHONE,
          firstName: 'Kwame',
          lastName: 'Mensah',
          email: TEST_EMAIL,
          role: 'RIDER' as any,
        }),
      ).rejects.toThrow('Unable to create account. Please try a different email or log in.');
    });

    it('should add a new role to existing user (multi-role)', async () => {
      const existingUser = mockUser({ role: 'CLIENT', roles: ['CLIENT'] });
      const updatedUser = { ...existingUser, roles: ['CLIENT', 'RIDER'] };
      const session = mockSession();

      asMock(prisma.otp.findFirst).mockResolvedValue(mockOtp({ verified: true, createdAt: new Date() }));
      // No email check needed since no email passed
      asMock(prisma.user.findUnique).mockResolvedValueOnce(existingUser); // phone lookup — user exists
      asMock(prisma.user.update).mockResolvedValue(updatedUser);
      asMock(prisma.riderProfile.findUnique).mockResolvedValue(null);
      asMock(prisma.riderProfile.create).mockResolvedValue({ id: 'rp-1', userId: existingUser.id });
      asMock(prisma.session.create).mockResolvedValue(session);
      asMock(prisma.session.update).mockResolvedValue(session);
      asMock(prisma.otp.deleteMany).mockResolvedValue({ count: 1 });

      const result = await AuthService.register({
        phone: RIDER_PHONE,
        firstName: 'Kwame',
        lastName: 'Mensah',
        role: 'RIDER' as any,
      });

      // Should NOT create a new wallet (isAddingRole = true)
      expect(prisma.wallet.create).not.toHaveBeenCalled();
      expect(result.user.roles).toContain('CLIENT');
      expect(result.user.roles).toContain('RIDER');
    });

    it('should register a client with email and create profile, wallet, session, and verification email token', async () => {
      const user = mockUser({
        id: 'email-user-1',
        phone: 'email-placeholder',
        email: TEST_EMAIL,
        role: 'CLIENT',
        roles: ['CLIENT'],
        passwordHash: await fastHash('Password1'),
        emailVerified: false,
      });
      const session = mockSession({ userId: user.id });

      asMock(prisma.user.findUnique).mockResolvedValueOnce(null); // email uniqueness
      asMock(prisma.user.create).mockResolvedValue(user);
      asMock(prisma.clientProfile.create).mockResolvedValue({ id: 'cp-1', userId: user.id });
      asMock(prisma.wallet.create).mockResolvedValue({ id: 'w-1', userId: user.id });
      asMock(prisma.session.create).mockResolvedValue(session);
      asMock(prisma.session.update).mockResolvedValue(session);
      asMock(prisma.user.findUnique).mockResolvedValueOnce(user); // async sendVerificationEmail
      asMock(prisma.emailToken.updateMany).mockResolvedValue({ count: 0 });
      asMock(prisma.emailToken.create).mockResolvedValue({ id: 'token-1' });

      const result = await AuthService.registerWithEmail({
        email: TEST_EMAIL,
        password: 'Password1',
        firstName: 'Ama',
        lastName: 'Client',
        role: 'CLIENT' as any,
      });

      expect(result.user.role).toBe('CLIENT');
      expect(result.accessToken).toBeTruthy();
      expect(prisma.clientProfile.create).toHaveBeenCalledWith({ data: { userId: user.id } });
      expect(prisma.wallet.create).toHaveBeenCalledWith({ data: { userId: user.id } });
    });

    it('should register a client with Ghana Card, recovery question, profile, wallet, and session', async () => {
      const user = mockUser({
        id: 'ghana-user-1',
        phone: 'ghanacard-placeholder',
        email: null,
        ghanaCardNumber: TEST_GHANA_CARD,
        role: 'CLIENT',
        roles: ['CLIENT'],
        passwordHash: await fastHash('Password1'),
        securityQuestion: 'What city were you born in?',
        securityAnswerHash: await fastHash('accra'),
      });
      const session = mockSession({ userId: user.id });

      asMock(prisma.user.findUnique).mockResolvedValueOnce(null); // Ghana Card uniqueness
      asMock(prisma.user.create).mockResolvedValue(user);
      asMock(prisma.clientProfile.create).mockResolvedValue({ id: 'cp-1', userId: user.id });
      asMock(prisma.wallet.create).mockResolvedValue({ id: 'w-1', userId: user.id });
      asMock(prisma.session.create).mockResolvedValue(session);
      asMock(prisma.session.update).mockResolvedValue(session);

      const result = await AuthService.registerWithGhanaCard({
        ghanaCard: TEST_GHANA_CARD,
        password: 'Password1',
        firstName: 'Ama',
        lastName: 'Client',
        role: 'CLIENT' as any,
        securityQuestion: 'What city were you born in?',
        securityAnswer: 'Accra',
      });

      expect(result.user.role).toBe('CLIENT');
      expect(result.accessToken).toBeTruthy();
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ghanaCardNumber: TEST_GHANA_CARD,
          securityQuestion: 'What city were you born in?',
          role: 'CLIENT',
          roles: ['CLIENT'],
        }),
      });
      expect(prisma.clientProfile.create).toHaveBeenCalledWith({ data: { userId: user.id } });
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3. LOGIN — OTP, PIN, and Password flows
  // ────────────────────────────────────────────────────────────
  describe('Login with OTP', () => {
    it('should log in user with valid OTP', async () => {
      const otp = mockOtp({ purpose: 'LOGIN' });
      const user = mockUser();

      asMock(prisma.otp.findFirst).mockResolvedValue(otp);
      asMock(prisma.otp.update).mockResolvedValue({ ...otp, verified: true });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      mockLoginEmailConfirmation();

      const result = await AuthService.loginWithOtp(RIDER_PHONE, TEST_OTP);

      expectLoginEmailConfirmation(result);
    });

    it('should reject OTP login for non-existent user', async () => {
      const otp = mockOtp({ purpose: 'LOGIN' });
      asMock(prisma.otp.findFirst).mockResolvedValue(otp);
      asMock(prisma.otp.update).mockResolvedValue({ ...otp, verified: true });
      asMock(prisma.user.findUnique).mockResolvedValue(null);

      await expect(AuthService.loginWithOtp(RIDER_PHONE, TEST_OTP))
        .rejects.toThrow('No account found');
    });

    it('should reject OTP login for banned user', async () => {
      const otp = mockOtp({ purpose: 'LOGIN' });
      asMock(prisma.otp.findFirst).mockResolvedValue(otp);
      asMock(prisma.otp.update).mockResolvedValue({ ...otp, verified: true });
      asMock(prisma.user.findUnique).mockResolvedValue(mockUser({ status: 'BANNED' }));

      await expect(AuthService.loginWithOtp(RIDER_PHONE, TEST_OTP))
        .rejects.toThrow('not active');
    });
  });

  describe('Login with PIN', () => {
    it('should log in rider with valid PIN', async () => {
      const user = mockUser({ pinHash: await fastHash(TEST_PIN) });

      asMock(prisma.user.findUnique).mockResolvedValue(user);
      mockLoginEmailConfirmation();

      const result = await AuthService.loginWithPin(RIDER_PHONE, TEST_PIN);

      expectLoginEmailConfirmation(result);
    });

    it('should reject invalid PIN', async () => {
      const user = mockUser({ pinHash: await fastHash(TEST_PIN) });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue(user); // recordFailedLogin

      await expect(AuthService.loginWithPin(RIDER_PHONE, '9999'))
        .rejects.toThrow('Invalid credentials or PIN');
    });

    it('should reject login for user without PIN set', async () => {
      asMock(prisma.user.findUnique).mockResolvedValue(mockUser({ pinHash: null }));

      await expect(AuthService.loginWithPin(RIDER_PHONE, TEST_PIN))
        .rejects.toThrow('Invalid credentials or PIN');
    });

    it('should reject locked account (5 failed attempts)', async () => {
      const user = mockUser({
        pinHash: await fastHash(TEST_PIN),
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // locked for 10 more min
      });
      asMock(prisma.user.findUnique).mockResolvedValue(user);

      await expect(AuthService.loginWithPin(RIDER_PHONE, TEST_PIN))
        .rejects.toThrow();
    });

    it('should log in with Ghana Card identifier and a valid 6-digit PIN', async () => {
      const user = mockUser({
        ghanaCardNumber: TEST_GHANA_CARD,
        pinHash: await fastHash(TEST_PIN_6),
      });

      asMock(prisma.user.findUnique).mockResolvedValue(user);
      mockLoginEmailConfirmation();

      const result = await AuthService.loginWithPin(TEST_GHANA_CARD, TEST_PIN_6);

      expectLoginEmailConfirmation(result);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { ghanaCardNumber: TEST_GHANA_CARD } });
    });
  });

  describe('Login with Password', () => {
    it('should log in with valid email and password', async () => {
      const password = 'SecureP@ss123';
      const user = mockUser({
        email: TEST_EMAIL,
        passwordHash: await fastHash(password),
      });
      const session = mockSession();

      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.session.create).mockResolvedValue(session);
      asMock(prisma.session.update).mockResolvedValue(session);
      asMock(prisma.user.update).mockResolvedValue(user);

      const result = await AuthService.loginWithPassword(TEST_EMAIL, password);

      expect(result.user.email).toBe(TEST_EMAIL);
      expect(result.accessToken).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const user = mockUser({
        email: TEST_EMAIL,
        passwordHash: await fastHash('correct-password'),
      });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue(user);

      // AU-01: error message is now identifier-agnostic to avoid leaking whether
      // the user entered a phone, email, or Ghana Card number.
      await expect(AuthService.loginWithPassword(TEST_EMAIL, 'wrong-password'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent email', async () => {
      asMock(prisma.user.findUnique).mockResolvedValue(null);

      await expect(AuthService.loginWithPassword('nobody@test.com', 'anything'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should log in with Ghana Card and password when no PIN is set', async () => {
      const user = mockUser({
        ghanaCardNumber: TEST_GHANA_CARD,
        passwordHash: await fastHash('Password1'),
        pinHash: null,
      });

      asMock(prisma.user.findUnique).mockResolvedValue(user);
      mockLoginEmailConfirmation();

      const result = await AuthService.loginWithGhanaCard(TEST_GHANA_CARD, 'Password1');

      expect(result.requiresPin).toBe(false);
      expectLoginEmailConfirmation(result);
    });

    it('should require PIN after Ghana Card password when user has a PIN', async () => {
      const user = mockUser({
        ghanaCardNumber: TEST_GHANA_CARD,
        passwordHash: await fastHash('Password1'),
        pinHash: await fastHash(TEST_PIN_6),
      });

      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue(user);

      const result = await AuthService.loginWithGhanaCard(TEST_GHANA_CARD, 'Password1');

      expect(result.requiresPin).toBe(true);
      expect(result.accessToken).toBeUndefined();
      expect(prisma.session.create).not.toHaveBeenCalled();
    });
  });

  describe('Recovery and reset flows', () => {
    it('should reset PIN through PASSWORD_RESET OTP', async () => {
      const otp = mockOtp({ purpose: 'PASSWORD_RESET' });
      const user = mockUser({ pinHash: await fastHash(TEST_PIN_6) });

      asMock(prisma.otp.findFirst).mockResolvedValue(otp);
      asMock(prisma.otp.update).mockResolvedValue({ ...otp, verified: true });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue(user);
      asMock(prisma.otp.deleteMany).mockResolvedValue({ count: 1 });

      const result = await AuthService.resetPinWithOtp(RIDER_PHONE, TEST_OTP, TEST_PIN_6);

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { pinHash: expect.any(String) },
      });
    });

    it('should recover Ghana Card account with security answer and reset PIN with token', async () => {
      const user = mockUser({
        ghanaCardNumber: TEST_GHANA_CARD,
        securityQuestion: 'What city were you born in?',
        securityAnswerHash: await fastHash('accra'),
      });

      asMock(prisma.user.findUnique).mockResolvedValue(user);

      const result = await AuthService.verifySecurityAnswer(TEST_GHANA_CARD, 'Accra');
      expect(result.recoveryToken).toBeTruthy();
      expect(result.securityQuestion).toBe('What city were you born in?');

      asMock(prisma.user.update).mockResolvedValue(user);
      await AuthService.resetPinWithToken(TEST_PIN_6, result.recoveryToken);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { pinHash: expect.any(String) },
      });
    });

    it('should create password reset token only for verified email users', async () => {
      const user = mockUser({ email: TEST_EMAIL, emailVerified: true });

      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.emailToken.updateMany).mockResolvedValue({ count: 0 });
      asMock(prisma.emailToken.create).mockResolvedValue({ id: 'token-1' });

      const result = await AuthService.requestPasswordReset(TEST_EMAIL);

      expect(result.success).toBe(true);
      expect(prisma.emailToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: user.id,
          purpose: 'PASSWORD_RESET',
          token: expect.any(String),
        }),
      });
      expect(EmailService.sendPasswordReset).toHaveBeenCalledWith(TEST_EMAIL, user.firstName, expect.any(String));
    });
  });

  // ────────────────────────────────────────────────────────────
  // 4. TOKEN REFRESH — rotate tokens, detect reuse
  // ────────────────────────────────────────────────────────────
  describe('Token Refresh', () => {
    it('should refresh tokens and rotate', async () => {
      // First create a real refresh token to use
      const refreshToken = AuthService.generateRefreshToken({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      // Create a hash matching what the DB would store
      const crypto = await import('node:crypto');
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      const session = mockSession({ refreshTokenHash: tokenHash });
      const user = mockUser();

      asMock(prisma.session.findUnique).mockResolvedValue(session);
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.session.updateMany).mockResolvedValue({ count: 1 });

      const result = await AuthService.refreshTokens(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // Verify rotation: session was updated with a NEW hash
      expect(prisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'session-1' }),
          data: expect.objectContaining({ refreshTokenHash: expect.any(String) }),
        }),
      );
    });

    it('should detect token reuse and revoke session', async () => {
      const refreshToken = AuthService.generateRefreshToken({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      // Session has a DIFFERENT hash (old token was already rotated)
      const session = mockSession({ refreshTokenHash: 'stale-hash-from-previous-rotation' });
      asMock(prisma.session.findUnique).mockResolvedValue(session);
      asMock(prisma.session.delete).mockResolvedValue(session);

      await expect(AuthService.refreshTokens(refreshToken))
        .rejects.toThrow('Token reuse detected');

      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: session.id } });
    });

    it('should reject expired session', async () => {
      const refreshToken = AuthService.generateRefreshToken({
        userId: 'user-1',
        sessionId: 'session-1',
      });
      const session = mockSession({ expiresAt: new Date(Date.now() - 1000) });
      asMock(prisma.session.findUnique).mockResolvedValue(session);

      await expect(AuthService.refreshTokens(refreshToken))
        .rejects.toThrow('Session expired');
    });

    it('should reject banned user on token refresh', async () => {
      const refreshToken = AuthService.generateRefreshToken({
        userId: 'user-1',
        sessionId: 'session-1',
      });
      const crypto = await import('node:crypto');
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const session = mockSession({ refreshTokenHash: tokenHash });
      asMock(prisma.session.findUnique).mockResolvedValue(session);
      asMock(prisma.user.findUnique).mockResolvedValue(mockUser({ status: 'BANNED' }));

      await expect(AuthService.refreshTokens(refreshToken))
        .rejects.toThrow('Account is not active');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 5. SESSION MANAGEMENT — list, revoke, logout
  // ────────────────────────────────────────────────────────────
  describe('Session Management', () => {
    it('should list active sessions for user', async () => {
      const sessions = [mockSession(), mockSession({ id: 'session-2', deviceInfo: 'iPhone' })];
      asMock(prisma.session.findMany).mockResolvedValue(sessions);

      const result = await AuthService.listSessions('user-1');

      expect(result).toHaveLength(2);
    });

    it('should revoke a specific session', async () => {
      const session = mockSession();
      asMock(prisma.session.findUnique).mockResolvedValue(session);
      asMock(prisma.session.delete).mockResolvedValue(session);

      await AuthService.revokeSession('user-1', 'session-1');

      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });

    it('should reject revoking another user session', async () => {
      const session = mockSession({ userId: 'other-user' });
      asMock(prisma.session.findUnique).mockResolvedValue(session);

      await expect(AuthService.revokeSession('user-1', 'session-1'))
        .rejects.toThrow('Session not found');
    });

    it('should revoke all sessions except current', async () => {
      asMock(prisma.session.deleteMany).mockResolvedValue({ count: 3 });

      const count = await AuthService.revokeAllSessions('user-1', 'keep-session');

      expect(count).toBe(3);
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', id: { not: 'keep-session' } },
      });
    });

    it('should logout (delete session)', async () => {
      asMock(prisma.session.delete).mockResolvedValue(mockSession());

      await AuthService.logout('session-1');

      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });
  });

  // ────────────────────────────────────────────────────────────
  // 6. PIN MANAGEMENT — set, change, reset
  // ────────────────────────────────────────────────────────────
  describe('PIN Management', () => {
    it('should set PIN for user without existing PIN', async () => {
      const user = mockUser({ pinHash: null });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue({ ...user, pinHash: 'new-hash' });

      await AuthService.setPin('user-1', TEST_PIN);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { pinHash: expect.any(String) },
      });
    });

    it('should change PIN with correct current PIN', async () => {
      const currentPin = '1234';
      const newPin = '5678';
      const user = mockUser({ pinHash: await fastHash(currentPin) });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue(user);

      await AuthService.changePin('user-1', currentPin, newPin);

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should reject PIN change with wrong current PIN', async () => {
      const user = mockUser({ pinHash: await fastHash('1234') });
      asMock(prisma.user.findUnique).mockResolvedValue(user);

      await expect(AuthService.changePin('user-1', '0000', '5678'))
        .rejects.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 7. PASSWORD MANAGEMENT
  // ────────────────────────────────────────────────────────────
  describe('Password Management', () => {
    it('should change password with correct current password', async () => {
      const currentPw = 'OldP@ss123';
      const user = mockUser({ passwordHash: await fastHash(currentPw) });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue(user);

      await AuthService.changePassword('user-1', currentPw, 'NewP@ss456');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: expect.any(String) },
      });
    });

    it('should reject password change with wrong current password', async () => {
      const user = mockUser({ passwordHash: await fastHash('correct-pw') });
      asMock(prisma.user.findUnique).mockResolvedValue(user);

      await expect(AuthService.changePassword('user-1', 'wrong-pw', 'new-pw'))
        .rejects.toThrow('Current password is incorrect');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 8. JWT TOKEN GENERATION
  // ────────────────────────────────────────────────────────────
  describe('JWT Tokens', () => {
    it('should generate access token with roles', () => {
      const token = AuthService.generateAccessToken({
        userId: 'user-1',
        role: 'RIDER' as any,
        roles: ['RIDER', 'CLIENT'] as any[],
        sessionId: 'session-1',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('should generate refresh token', () => {
      const token = AuthService.generateRefreshToken({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should verify valid refresh token', () => {
      const token = AuthService.generateRefreshToken({
        userId: 'user-1',
        sessionId: 'session-1',
      });

      const decoded = AuthService.verifyRefreshToken(token);

      expect(decoded.userId).toBe('user-1');
      expect(decoded.sessionId).toBe('session-1');
    });

    it('should reject tampered refresh token', () => {
      expect(() => AuthService.verifyRefreshToken('invalid.jwt.token'))
        .toThrow('Invalid or expired refresh token');
    });
  });

  // ────────────────────────────────────────────────────────────
  // 9. OTP CODE GENERATION — always 6 digits
  // ────────────────────────────────────────────────────────────
  describe('generateOtpCode', () => {
    it('should generate 6-digit numeric codes', () => {
      for (let i = 0; i < 20; i++) {
        const code = AuthService.generateOtpCode();
        expect(code).toMatch(/^\d{6}$/);
        const num = parseInt(code, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });
  });
});
