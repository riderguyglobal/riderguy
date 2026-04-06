import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
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

// ── Test Data ──
const RIDER_PHONE = '+233241234567';
const CLIENT_PHONE = '+233501234567';
const TEST_EMAIL = 'test@riderguy.com';
const TEST_OTP = '123456';
const TEST_PIN = '1234';

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

// ============================================================
// AUTH SERVICE — COMPREHENSIVE SIMULATION TESTS
// ============================================================

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  // ────────────────────────────────────────────────────────────
  // 3. LOGIN — OTP, PIN, and Password flows
  // ────────────────────────────────────────────────────────────
  describe('Login with OTP', () => {
    it('should log in user with valid OTP', async () => {
      const otp = mockOtp({ purpose: 'LOGIN' });
      const user = mockUser();
      const session = mockSession();

      asMock(prisma.otp.findFirst).mockResolvedValue(otp);
      asMock(prisma.otp.update).mockResolvedValue({ ...otp, verified: true });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.session.create).mockResolvedValue(session);
      asMock(prisma.session.update).mockResolvedValue(session);
      asMock(prisma.user.update).mockResolvedValue(user);

      const result = await AuthService.loginWithOtp(RIDER_PHONE, TEST_OTP);

      expect(result.user.id).toBe('user-1');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
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
      const user = mockUser({ pinHash: await AuthService.hashPassword(TEST_PIN) });
      const session = mockSession();

      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.session.create).mockResolvedValue(session);
      asMock(prisma.session.update).mockResolvedValue(session);
      asMock(prisma.user.update).mockResolvedValue(user);

      const result = await AuthService.loginWithPin(RIDER_PHONE, TEST_PIN);

      expect(result.user.phone).toBe(RIDER_PHONE);
      expect(result.accessToken).toBeDefined();
    });

    it('should reject invalid PIN', async () => {
      const user = mockUser({ pinHash: await AuthService.hashPassword(TEST_PIN) });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue(user); // recordFailedLogin

      await expect(AuthService.loginWithPin(RIDER_PHONE, '9999'))
        .rejects.toThrow('Invalid phone number or PIN');
    });

    it('should reject login for user without PIN set', async () => {
      asMock(prisma.user.findUnique).mockResolvedValue(mockUser({ pinHash: null }));

      await expect(AuthService.loginWithPin(RIDER_PHONE, TEST_PIN))
        .rejects.toThrow('Invalid phone number or PIN');
    });

    it('should reject locked account (5 failed attempts)', async () => {
      const user = mockUser({
        pinHash: await AuthService.hashPassword(TEST_PIN),
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // locked for 10 more min
      });
      asMock(prisma.user.findUnique).mockResolvedValue(user);

      await expect(AuthService.loginWithPin(RIDER_PHONE, TEST_PIN))
        .rejects.toThrow();
    });
  });

  describe('Login with Password', () => {
    it('should log in with valid email and password', async () => {
      const password = 'SecureP@ss123';
      const user = mockUser({
        email: TEST_EMAIL,
        passwordHash: await AuthService.hashPassword(password),
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
        passwordHash: await AuthService.hashPassword('correct-password'),
      });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue(user);

      await expect(AuthService.loginWithPassword(TEST_EMAIL, 'wrong-password'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should reject non-existent email', async () => {
      asMock(prisma.user.findUnique).mockResolvedValue(null);

      await expect(AuthService.loginWithPassword('nobody@test.com', 'anything'))
        .rejects.toThrow('Invalid email or password');
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
      const user = mockUser({ pinHash: await AuthService.hashPassword(currentPin) });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue(user);

      await AuthService.changePin('user-1', currentPin, newPin);

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should reject PIN change with wrong current PIN', async () => {
      const user = mockUser({ pinHash: await AuthService.hashPassword('1234') });
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
      const user = mockUser({ passwordHash: await AuthService.hashPassword(currentPw) });
      asMock(prisma.user.findUnique).mockResolvedValue(user);
      asMock(prisma.user.update).mockResolvedValue(user);

      await AuthService.changePassword('user-1', currentPw, 'NewP@ss456');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: expect.any(String) },
      });
    });

    it('should reject password change with wrong current password', async () => {
      const user = mockUser({ passwordHash: await AuthService.hashPassword('correct-pw') });
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
