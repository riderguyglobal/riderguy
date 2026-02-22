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
  const url = config.redis.url;
  if (!url || url === 'redis://localhost:6379') {
    if (config.nodeEnv === 'production') return false;
  }
  return true;
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
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 200, 1000);
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
    logger.warn('Redis not available — using in-memory rate limiter');

    globalLimiter = new RateLimiterMemory({ points: 100, duration: 60, keyPrefix: 'rl_global' });
    authLimiter = new RateLimiterMemory({ points: 10, duration: 60, keyPrefix: 'rl_auth' });
    sensitiveApiLimiter = new RateLimiterMemory({ points: 5, duration: 60, keyPrefix: 'rl_sensitive' });
  }
} else {
  logger.info('Redis not configured — using in-memory rate limiter');

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

export const globalRateLimit = createRateLimitMiddleware(globalLimiter);
export const authRateLimit = createRateLimitMiddleware(authLimiter);
export const sensitiveRateLimit = createRateLimitMiddleware(sensitiveApiLimiter);
