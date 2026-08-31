import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import {
  emailRegisterSchema,
  ghanaCardRegisterSchema,
  loginWithGhanaCardSchema,
  registerSchema,
  requestOtpSchema,
  resetPinSchema,
  verifyOtpSchema,
} from '@riderguy/validators';
import { validate } from './validate';
import { authenticate, getAuthRoles, hasAnyRole, requireRole } from './auth';

vi.mock('../config', () => ({
  config: {
    jwt: {
      accessSecret: 'test-access-secret-with-enough-length-32chars',
      refreshSecret: 'test-refresh-secret-with-enough-length-32chars',
    },
  },
}));

vi.mock('../lib/redis', () => ({
  getRedisClient: vi.fn(() => null),
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@riderguy/database';

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function runValidation(schema: Parameters<typeof validate>[0], body: unknown, source: 'body' | 'query' = 'body') {
  const req = { [source]: body } as unknown as Request;
  const next = vi.fn() as NextFunction;
  validate(schema, source)(req, {} as Response, next);
  return { req, next };
}

describe('auth API validation and middleware contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(prisma.session.findUnique).mockResolvedValue({
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        role: 'CLIENT',
        roles: ['CLIENT'],
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
  });

  it('accepts native phone OTP registration payloads after client-side OTP verification', () => {
    const { req, next } = runValidation(registerSchema, {
      phone: '+233501234567',
      firstName: 'Ama',
      lastName: 'Client',
      email: 'ama@example.com',
      password: 'Password1',
      pin: '123456',
      otpCode: '654321',
      role: 'CLIENT',
      referralCode: 'REF123',
    });

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toMatchObject({ role: 'CLIENT', pin: '123456', otpCode: '654321' });
  });

  it('rejects native phone registration with a 4-digit PIN at middleware validation', () => {
    expect(() => runValidation(registerSchema, {
      phone: '+233501234567',
      firstName: 'Ama',
      lastName: 'Client',
      pin: '1234',
      otpCode: '654321',
      role: 'CLIENT',
    })).toThrow('Validation failed');
  });

  it('accepts OTP request and verification payloads', () => {
    expect(runValidation(requestOtpSchema, { phone: '+233501234567', purpose: 'REGISTRATION' }).next).toHaveBeenCalledOnce();
    expect(runValidation(verifyOtpSchema, { phone: '+233501234567', otp: '654321', purpose: 'REGISTRATION' }).next).toHaveBeenCalledOnce();
  });

  it('accepts email registration payloads and rejects weak passwords', () => {
    expect(runValidation(emailRegisterSchema, {
      email: 'ama@example.com',
      password: 'Password1',
      firstName: 'Ama',
      lastName: 'Client',
      role: 'CLIENT',
    }).next).toHaveBeenCalledOnce();

    expect(() => runValidation(emailRegisterSchema, {
      email: 'ama@example.com',
      password: 'password',
      firstName: 'Ama',
      lastName: 'Client',
      role: 'CLIENT',
    })).toThrow('Validation failed');
  });

  it('accepts Ghana Card registration and login payloads', () => {
    expect(runValidation(ghanaCardRegisterSchema, {
      ghanaCard: 'GHA-123456789-1',
      password: 'Password1',
      firstName: 'Ama',
      lastName: 'Client',
      role: 'CLIENT',
      securityQuestion: 'What city were you born in?',
      securityAnswer: 'Accra',
    }).next).toHaveBeenCalledOnce();

    expect(runValidation(loginWithGhanaCardSchema, {
      ghanaCard: 'GHA-123456789-1',
      password: 'Password1',
    }).next).toHaveBeenCalledOnce();
  });

  it('rejects reset PIN payloads unless the new PIN is exactly 6 digits', () => {
    expect(() => runValidation(resetPinSchema, {
      phone: '+233501234567',
      otp: '654321',
      newPin: '1234',
    })).toThrow('Validation failed');

    expect(runValidation(resetPinSchema, {
      phone: '+233501234567',
      otp: '654321',
      newPin: '123456',
    }).next).toHaveBeenCalledOnce();
  });

  it('authenticates valid access tokens and attaches all current user roles', async () => {
    const token = jwt.sign(
      { userId: 'user-1', role: 'CLIENT', roles: ['CLIENT'], sessionId: 'session-1' },
      'test-access-secret-with-enough-length-32chars',
      { expiresIn: '15m' },
    );
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ userId: 'user-1', roles: ['CLIENT'], sessionId: 'session-1' });
  });

  it('rejects missing auth header and enforces role middleware', async () => {
    const missingReq = { headers: {} } as Request;
    const missingNext = vi.fn() as NextFunction;
    await authenticate(missingReq, {} as Response, missingNext);
    expect(missingNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));

    const roleReq = { user: { userId: 'user-1', role: 'CLIENT', roles: ['CLIENT'], sessionId: 'session-1' } } as unknown as Request;
    expect(() => requireRole('RIDER' as any)(roleReq, {} as Response, vi.fn() as NextFunction)).toThrow('You do not have permission');
  });

  it('rejects a valid token when its database session has been revoked', async () => {
    asMock(prisma.session.findUnique).mockResolvedValue(null);
    const token = jwt.sign(
      { userId: 'user-1', role: 'CLIENT', roles: ['CLIENT'], sessionId: 'revoked-session' },
      'test-access-secret-with-enough-length-32chars',
      { expiresIn: '15m' },
    );
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(req.user).toBeUndefined();
  });

  it('rejects suspended accounts even while their access token remains valid', async () => {
    asMock(prisma.session.findUnique).mockResolvedValue({
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        role: 'ADMIN',
        roles: ['ADMIN'],
        status: 'SUSPENDED',
        deletedAt: null,
      },
    });
    const token = jwt.sign(
      { userId: 'user-1', role: 'ADMIN', roles: ['ADMIN'], sessionId: 'session-1' },
      'test-access-secret-with-enough-length-32chars',
      { expiresIn: '15m' },
    );
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(req.user).toBeUndefined();
  });

  it('uses current database roles instead of stale elevated token claims', async () => {
    const token = jwt.sign(
      { userId: 'user-1', role: 'ADMIN', roles: ['ADMIN'], sessionId: 'session-1' },
      'test-access-secret-with-enough-length-32chars',
      { expiresIn: '15m' },
    );
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const next = vi.fn() as NextFunction;

    await authenticate(req, {} as Response, next);

    expect(req.user).toMatchObject({ role: 'CLIENT', roles: ['CLIENT'] });
    expect(() => requireRole('ADMIN' as any)(req, {} as Response, vi.fn() as NextFunction))
      .toThrow('You do not have permission');
  });

  it('authorizes a multi-role token from its roles array, not its legacy primary role', () => {
    const user = {
      userId: 'user-1',
      role: 'CLIENT',
      roles: ['CLIENT', 'RIDER'],
      sessionId: 'session-1',
    } as any;
    const req = { user } as Request;
    const next = vi.fn() as NextFunction;

    requireRole('RIDER' as any)(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(getAuthRoles(user)).toEqual(['CLIENT', 'RIDER']);
    expect(hasAnyRole(user, 'RIDER' as any)).toBe(true);
    expect(hasAnyRole(user, 'ADMIN' as any, 'SUPER_ADMIN' as any)).toBe(false);
  });
});
