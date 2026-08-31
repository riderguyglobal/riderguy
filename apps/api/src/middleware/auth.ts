import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ApiError } from '../lib/api-error';
import { getRedisClient } from '../lib/redis';
import { prisma } from '@riderguy/database';
import type { UserRole } from '@riderguy/types';

// ============================================================
// Auth middleware — extracts and verifies the JWT access token
// from the Authorization header, attaches decoded payload to
// req.user.
// ============================================================

export interface AuthPayload {
  userId: string;
  role: UserRole;     // primary / active role (backwards compat)
  roles?: UserRole[]; // all roles the user holds
  sessionId: string;
  jti?: string;       // AUTH-04: token id for Redis revocation list
  exp?: number;       // expiry timestamp (epoch seconds), set by jwt.sign
}

/**
 * Return the roles that are authoritative for this token. Newer tokens carry
 * `roles`; legacy tokens carry only `role`.
 *
 * Do not branch on `payload.role` directly for authorization. A multi-role
 * account can be using a different application from its legacy primary role.
 */
export function getAuthRoles<T extends string>(
  payload: { role: T; roles?: T[] },
): T[] {
  return payload.roles?.length ? payload.roles : [payload.role];
}

export function hasAnyRole<T extends string>(
  payload: { role: T; roles?: T[] },
  ...roles: string[]
): boolean {
  const currentRoles = getAuthRoles(payload);
  return currentRoles.some((role) => roles.includes(role));
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Require a valid access token.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing or malformed authorization header'));
  }

  const token = header.slice(7);

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, config.jwt.accessSecret) as AuthPayload;
  } catch {
    return next(ApiError.unauthorized('Invalid or expired access token'));
  }

  // AUTH-04: Reject tokens whose jti is on the Redis revocation list. Redis is
  // an optimization only; the authoritative session/account check below is
  // always performed so logout, suspension, deletion, and role changes take
  // effect immediately even during a Redis outage.
  if (payload.jti) {
    try {
      const redis = getRedisClient();
      if (redis) {
        const revoked = await redis.get(`auth:revoked:${payload.jti}`);
        if (revoked) return next(ApiError.unauthorized('Token has been revoked'));
      }
    } catch {
      // Continue to the database-backed session check rather than failing open.
    }
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: {
        userId: true,
        expiresAt: true,
        user: {
          select: {
            role: true,
            roles: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (
      !session
      || session.userId !== payload.userId
      || session.expiresAt <= new Date()
    ) {
      return next(ApiError.unauthorized('Session expired or invalid'));
    }

    if (
      session.user.deletedAt
      || ['SUSPENDED', 'DEACTIVATED', 'BANNED'].includes(session.user.status)
    ) {
      return next(ApiError.forbidden('Your account is not active'));
    }

    // Never trust stale role claims after an administrator changes membership.
    payload.role = session.user.role as UserRole;
    payload.roles = session.user.roles.length
      ? session.user.roles.map((role) => role as UserRole)
      : [payload.role];
  } catch {
    return next(ApiError.internal('Authentication service unavailable'));
  }

  req.user = payload;
  next();
}

/**
 * Require one of the listed roles (must be used AFTER authenticate).
 * Checks against both the `roles` array and the legacy `role` field.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    // Check against roles array (multi-role) or fall back to single role
    const hasPermission = hasAnyRole(req.user, ...roles);
    if (!hasPermission) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }
    next();
  };
}
