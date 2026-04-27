import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ApiError } from '../lib/api-error';
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
export function authenticate(req: Request, _res: Response, next: NextFunction) {
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

  // AUTH-04: Reject tokens whose jti is on the Redis revocation list.
  //          Fail-open if Redis is unavailable — tokens still expire <=15min naturally.
  if (payload.jti) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getRedisClient } = require('../lib/redis');
      const redis = getRedisClient();
      if (redis) {
        redis.get(`auth:revoked:${payload.jti}`)
          .then((revoked: string | null) => {
            if (revoked) {
              return next(ApiError.unauthorized('Token has been revoked'));
            }
            req.user = payload;
            next();
          })
          .catch(() => {
            // Redis hiccup — fail open
            req.user = payload;
            next();
          });
        return;
      }
    } catch { /* fall through to fail-open */ }
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
    const userRoles = req.user.roles?.length ? req.user.roles : [req.user.role];
    const hasPermission = userRoles.some(r => roles.includes(r));
    if (!hasPermission) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }
    next();
  };
}
