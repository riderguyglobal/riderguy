import { RateLimiterMemory, RateLimiterRedis, type RateLimiterAbstract } from 'rate-limiter-flexible';
import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../lib/api-error';
import { config } from '../config';
import { logger } from '../lib/logger';

// ============================================================
// Rate limiters — Redis-backed with in-memory fallback.
//
// Uses ioredis to connect to the configured Redis instance.
// If Redis is not configured or unavailable, uses in-memory
// rate limiting (suitable for single-process deployments).
// ============================================================

function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

let globalLimiter: RateLimiterAbstract;
let authLimiter: RateLimiterAbstract;
let sensitiveApiLimiter: RateLimiterAbstract;

// Only attempt Redis if REDIS_URL is explicitly configured
if (isRedisConfigured()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis');
    const redisClient = new Redis(config.redis.url, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,  // Fail immediately — insurance limiter takes over
      lazyConnect: true,
      connectTimeout: 3000,     // 3s max to connect
      commandTimeout: 2000,     // 2s max per command
      retryStrategy: (times: number) => {
        if (times > 2) return null; // Stop retrying after 2 attempts
        return Math.min(times * 100, 500);
      },
    });

    redisClient.on('error', () => {
      // Silently handled — insurance limiter takes over
    });

    redisClient.connect().catch(() => {
      logger.warn('Redis connection failed for rate limiter — falling back to in-memory');
    });

    globalLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      points: 100,
      duration: 60,
      keyPrefix: 'rl_global',
      insuranceLimiter: new RateLimiterMemory({ points: 100, duration: 60 }),
    });

    authLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      points: 10,
      duration: 60,
      keyPrefix: 'rl_auth',
      insuranceLimiter: new RateLimiterMemory({ points: 10, duration: 60 }),
    });

    sensitiveApiLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      points: 5,
      duration: 60,
      keyPrefix: 'rl_sensitive',
      insuranceLimiter: new RateLimiterMemory({ points: 5, duration: 60 }),
    });

    logger.info('Rate limiter initialised with Redis backend');
  } catch {
    if (config.isProduction) {
      throw new Error(
        'Redis connection failed for rate limiter in production. ' +
        'In-memory rate limiting is unsafe behind a load balancer.'
      );
    }

    logger.warn('Redis not available — using in-memory rate limiter (dev only)');

    globalLimiter = new RateLimiterMemory({ points: 100, duration: 60, keyPrefix: 'rl_global' });
    authLimiter = new RateLimiterMemory({ points: 10, duration: 60, keyPrefix: 'rl_auth' });
    sensitiveApiLimiter = new RateLimiterMemory({ points: 5, duration: 60, keyPrefix: 'rl_sensitive' });
  }
} else {
  if (config.isProduction) {
    throw new Error(
      'REDIS_URL is required in production for distributed rate limiting. ' +
      'In-memory rate limiting is unsafe behind a load balancer.'
    );
  }

  logger.info('Redis not configured — using in-memory rate limiter (dev only)');

  globalLimiter = new RateLimiterMemory({ points: 100, duration: 60, keyPrefix: 'rl_global' });
  authLimiter = new RateLimiterMemory({ points: 10, duration: 60, keyPrefix: 'rl_auth' });
  sensitiveApiLimiter = new RateLimiterMemory({ points: 5, duration: 60, keyPrefix: 'rl_sensitive' });
}

function createRateLimitMiddleware(limiter: RateLimiterAbstract) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.ip ?? req.socket.remoteAddress ?? `anon_${req.headers['user-agent']?.slice(0, 32) ?? 'no-ua'}`;
      const result = await limiter.consume(key);

      // Set standard rate-limit response headers
      res.setHeader('X-RateLimit-Limit', limiter.points);
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.msBeforeNext / 1000));

      next();
    } catch (rateLimiterRes) {
      // Set retry-after header
      if (rateLimiterRes && typeof rateLimiterRes === 'object' && 'msBeforeNext' in rateLimiterRes) {
        const retryAfter = Math.ceil((rateLimiterRes as { msBeforeNext: number }).msBeforeNext / 1000);
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-RateLimit-Limit', limiter.points);
        res.setHeader('X-RateLimit-Remaining', 0);
      }
      next(ApiError.tooManyRequests());
    }
  };
}

// ── AUTH-02: Composite rate-limit for auth endpoints ────────
// Per-IP only buckets are bypassable behind NAT (multiple attackers
// share one IP and each get a full 10/min budget against a single
// victim phone). The composite middleware consumes from BOTH:
//   1. The per-IP bucket (existing 10/min) — caps total per IP.
//   2. A per-identifier bucket (10/min) keyed by the phone/email
//      submitted in the request — caps attempts against any single
//      account regardless of attacker IP.
//
// Either bucket exhausting triggers a 429.
function pickAuthIdentifier(req: Request): string | null {
  // Try common login/register/reset payload fields, in order of preference.
  const body = (req.body ?? {}) as Record<string, unknown>;
  const candidates = [
    body.phone,
    body.phoneNumber,
    body.email,
    body.identifier, // unified login field
    body.username,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length >= 3) {
      return c.trim().toLowerCase();
    }
  }
  return null;
}

function createAuthRateLimitMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ipKey = req.ip ?? req.socket.remoteAddress ?? `anon_${req.headers['user-agent']?.slice(0, 32) ?? 'no-ua'}`;
    const identifier = pickAuthIdentifier(req);

    try {
      // Always consume the per-IP bucket
      const ipResult = await authLimiter.consume(`ip:${ipKey}`);

      // If we have an identifier, also consume from its bucket.
      // We do NOT refund the IP consumption on identifier-bucket failure —
      // failed login attempts should cost both budgets.
      let result = ipResult;
      if (identifier) {
        const idResult = await authLimiter.consume(`id:${identifier}`);
        // Surface whichever bucket has fewer remaining points
        if (idResult.remainingPoints < ipResult.remainingPoints) {
          result = idResult;
        }
      }

      res.setHeader('X-RateLimit-Limit', authLimiter.points);
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.msBeforeNext / 1000));
      next();
    } catch (rateLimiterRes) {
      if (rateLimiterRes && typeof rateLimiterRes === 'object' && 'msBeforeNext' in rateLimiterRes) {
        const retryAfter = Math.ceil((rateLimiterRes as { msBeforeNext: number }).msBeforeNext / 1000);
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-RateLimit-Limit', authLimiter.points);
        res.setHeader('X-RateLimit-Remaining', 0);
      }
      next(ApiError.tooManyRequests());
    }
  };
}

export const globalRateLimit = createRateLimitMiddleware(globalLimiter);
export const authRateLimit = createAuthRateLimitMiddleware();
export const sensitiveRateLimit = createRateLimitMiddleware(sensitiveApiLimiter);
