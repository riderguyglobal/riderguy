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
    throw ApiError.unauthorized('Missing or malformed authorization header');
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
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
