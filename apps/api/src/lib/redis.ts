import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

// ============================================================
// Centralized Redis Client
//
// Shared Redis connection used by:
// - Socket.IO adapter (multi-instance pub/sub)
// - Rate limiting (distributed counters)
// - Session caching (reduce DB load)
// - Rider presence (future: shared across instances)
//
// Falls back gracefully when REDIS_URL isn't configured.
// ============================================================

let redisClient: Redis | null = null;
let redisPub: Redis | null = null;
let redisSub: Redis | null = null;

/**
 * Get or create the primary Redis client (singleton).
 * Returns null if Redis is not configured or connection fails.
 */
export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const url = config.redis?.url;
  if (!url || url === 'redis://localhost:6379') {
    // Only skip in development without explicit REDIS_URL
    if (!process.env.REDIS_URL) {
      logger.info('[Redis] No REDIS_URL set — running without Redis');
      return null;
    }
  }

  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) {
          logger.warn('[Redis] Max retries reached — giving up');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      logger.info('[Redis] Connected');
      // BullMQ requires noeviction to prevent silent job data loss
      redisClient?.config('SET', 'maxmemory-policy', 'noeviction').then(() => {
        logger.info('[Redis] Set maxmemory-policy to noeviction');
      }).catch((err) => {
        logger.warn({ err }, '[Redis] Could not set maxmemory-policy — check Redis ACLs');
      });
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, '[Redis] Connection error');
    });

    redisClient.connect().catch((err) => {
      logger.warn({ err }, '[Redis] Initial connection failed — will retry');
    });

    return redisClient;
  } catch (err) {
    logger.error({ err }, '[Redis] Failed to create client');
    return null;
  }
}

/**
 * Get pub/sub Redis clients for Socket.IO adapter.
 * Returns [pubClient, subClient] or null if Redis unavailable.
 */
export function getRedisPubSub(): { pub: Redis; sub: Redis } | null {
  const client = getRedisClient();
  if (!client) return null;

  if (!redisPub) {
    redisPub = client.duplicate();
  }
  if (!redisSub) {
    redisSub = client.duplicate();
  }

  return { pub: redisPub, sub: redisSub };
}

/**
 * Gracefully close all Redis connections.
 */
export async function closeRedis(): Promise<void> {
  const closers: Promise<void>[] = [];

  if (redisClient) {
    closers.push(redisClient.quit().then(() => { redisClient = null; }));
  }
  if (redisPub) {
    closers.push(redisPub.quit().then(() => { redisPub = null; }));
  }
  if (redisSub) {
    closers.push(redisSub.quit().then(() => { redisSub = null; }));
  }

  await Promise.allSettled(closers);
  logger.info('[Redis] All connections closed');
}
