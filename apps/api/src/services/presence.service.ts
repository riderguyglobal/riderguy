import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { getRedisClient } from '../lib/redis';

// ============================================================
// Rider Presence Manager
//
// Keeps rider API gates OPEN as long as rider is ONLINE.
// Tracks connections, heartbeats, and stale-rider cleanup.
//
// Architecture:
// 1. In-memory Map for sub-second presence checks (local cache)
// 2. D-08: Redis hashes for cross-instance presence (horizontal scaling)
// 3. Periodic DB sync (every 60s) for persistence across restarts
// 4. Stale rider detector — auto-OFFLINE riders with no heartbeat
// 5. Session duration tracking for analytics & gamification
// ============================================================

// ── Types ───────────────────────────────────────────────────

interface RiderPresence {
  userId: string;
  riderProfileId: string;
  socketId: string | null;
  isConnected: boolean;
  lastHeartbeat: Date;
  lastSeenAt: Date;
  sessionStartedAt: Date;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
  /** Accumulated seconds BEFORE the current session (from DB) */
  priorOnlineSeconds: number;
  /** Consecutive missed heartbeats */
  missedHeartbeats: number;
  /** Last GPS coordinates (avoid DB read for dispatch) */
  latitude: number | null;
  longitude: number | null;
}

// ── Constants ───────────────────────────────────────────────

/** How often the stale-rider sweep runs (ms) */
const SWEEP_INTERVAL_MS = 60_000; // 1 minute

/** How long before a rider is considered stale (ms) — 3 missed heartbeats at ~30s each */
const STALE_THRESHOLD_MS = 2 * 60_000; // 2 minutes

/** How long before a disconnected rider is auto-set to OFFLINE (ms) */
const OFFLINE_GRACE_PERIOD_MS = 5 * 60_000; // 5 minutes — allows for brief network drops

/** Maximum time to consider a rider "recently active" for dispatch (ms) */
const DISPATCH_FRESHNESS_MS = 10 * 60_000; // 10 minutes

/** DB sync interval — flush in-memory presence to Prisma (ms) */
const DB_SYNC_INTERVAL_MS = 60_000; // 1 minute

/** Minimum interval between heartbeats per rider (ms) — prevents flooding */
const HEARTBEAT_THROTTLE_MS = 3_000; // 3 seconds

// ── In-memory presence store ────────────────────────────────

const presenceMap = new Map<string, RiderPresence>();
/** Last accepted heartbeat timestamp per userId for throttling */
const lastHeartbeatTime = new Map<string, number>();

let sweepTimer: NodeJS.Timeout | null = null;
let dbSyncTimer: NodeJS.Timeout | null = null;

// ── D-08: Redis-backed presence for horizontal scaling ──────

const REDIS_PRESENCE_PREFIX = 'presence:';
const REDIS_PRESENCE_TTL = 360; // 6 min — auto-expire if no heartbeat refresh

/** Mirror a rider's presence to Redis (non-blocking) */
function syncPresenceToRedis(presence: RiderPresence): void {
  const redis = getRedisClient();
  if (!redis) return;
  const key = `${REDIS_PRESENCE_PREFIX}${presence.userId}`;
  const data = JSON.stringify({
    userId: presence.userId,
    riderProfileId: presence.riderProfileId,
    isConnected: presence.isConnected,
    lastHeartbeat: presence.lastHeartbeat.toISOString(),
    lastSeenAt: presence.lastSeenAt.toISOString(),
    connectionQuality: presence.connectionQuality,
    latitude: presence.latitude,
    longitude: presence.longitude,
  });
  redis.set(key, data, 'EX', REDIS_PRESENCE_TTL).catch(() => {});
}

/** Remove a rider's presence from Redis */
function removePresenceFromRedis(userId: string): void {
  const redis = getRedisClient();
  if (!redis) return;
  redis.del(`${REDIS_PRESENCE_PREFIX}${userId}`).catch(() => {});
}

/** Get all online riders from Redis (for cross-instance visibility) */
async function getOnlineRidersFromRedis(): Promise<RiderPresence[]> {
  const redis = getRedisClient();
  if (!redis) return [];
  try {
    // Use SCAN instead of KEYS to avoid blocking Redis on large keyspaces
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', `${REDIS_PRESENCE_PREFIX}*`, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    if (keys.length === 0) return [];
    const pipeline = redis.pipeline();
    for (const key of keys) pipeline.get(key);
    const results = await pipeline.exec();
    if (!results) return [];
    const riders: RiderPresence[] = [];
    for (const [err, val] of results) {
      if (err || !val) continue;
      try {
        const data = JSON.parse(val as string);
        riders.push({
          userId: data.userId,
          riderProfileId: data.riderProfileId,
          socketId: null,
          isConnected: data.isConnected,
          lastHeartbeat: new Date(data.lastHeartbeat),
          lastSeenAt: new Date(data.lastSeenAt),
          sessionStartedAt: new Date(),
          connectionQuality: data.connectionQuality,
          priorOnlineSeconds: 0,
          missedHeartbeats: 0,
          latitude: data.latitude,
          longitude: data.longitude,
        });
      } catch { /* skip malformed */ }
    }
    return riders;
  } catch {
    return [];
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Start the presence manager — call once at server boot.
 * Recovers previously-online riders from DB and starts timers.
 */
export async function startPresenceManager(): Promise<void> {
  // Recover riders that were ONLINE before a server restart
  try {
    const onlineRiders = await prisma.riderProfile.findMany({
      where: { availability: 'ONLINE' },
      select: {
        id: true,
        userId: true,
        socketId: true,
        lastHeartbeat: true,
        lastSeenAt: true,
        sessionStartedAt: true,
        totalOnlineSeconds: true,
        currentLatitude: true,
        currentLongitude: true,
      },
    });

    for (const rider of onlineRiders) {
      presenceMap.set(rider.userId, {
        userId: rider.userId,
        riderProfileId: rider.id,
        socketId: rider.socketId,
        isConnected: false, // Will be set true when they reconnect via socket
        lastHeartbeat: rider.lastHeartbeat ?? new Date(),
        lastSeenAt: rider.lastSeenAt ?? new Date(),
        sessionStartedAt: rider.sessionStartedAt ?? new Date(),
        connectionQuality: 'disconnected',
        priorOnlineSeconds: rider.totalOnlineSeconds ?? 0,
        missedHeartbeats: 0,
        latitude: rider.currentLatitude,
        longitude: rider.currentLongitude,
      });
    }

    logger.info({ count: onlineRiders.length }, '[Presence] Recovered online riders from DB');
  } catch (err) {
    logger.error({ err }, '[Presence] Failed to recover online riders');
  }

  // Start periodic sweep for stale riders
  sweepTimer = setInterval(sweepStaleRiders, SWEEP_INTERVAL_MS);

  // Start periodic DB sync
  dbSyncTimer = setInterval(syncPresenceToDB, DB_SYNC_INTERVAL_MS);

  logger.info('[Presence] Manager started');
}

/**
 * Stop the presence manager — call on graceful shutdown.
 */
export async function stopPresenceManager(): Promise<void> {
  if (sweepTimer) clearInterval(sweepTimer);
  if (dbSyncTimer) clearInterval(dbSyncTimer);

  // Final DB sync before shutdown
  await syncPresenceToDB();

  presenceMap.clear();
  logger.info('[Presence] Manager stopped');
}

/**
 * Rider connected via Socket.IO — register their presence.
 */
export async function riderConnected(
  userId: string,
  socketId: string
): Promise<void> {
  const now = new Date();

  let presence = presenceMap.get(userId);

  if (presence) {
    // Reconnecting — update socket but keep session intact
    presence.socketId = socketId;
    presence.isConnected = true;
    presence.lastHeartbeat = now;
    presence.lastSeenAt = now;
    presence.connectionQuality = 'good';
    presence.missedHeartbeats = 0;
  } else {
    // First connection — look up rider profile
    const profile = await prisma.riderProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        totalOnlineSeconds: true,
        currentLatitude: true,
        currentLongitude: true,
      },
    });

    if (!profile) return;

    presence = {
      userId,
      riderProfileId: profile.id,
      socketId,
      isConnected: true,
      lastHeartbeat: now,
      lastSeenAt: now,
      sessionStartedAt: now,
      connectionQuality: 'good',
      priorOnlineSeconds: profile.totalOnlineSeconds ?? 0,
      missedHeartbeats: 0,
      latitude: profile.currentLatitude,
      longitude: profile.currentLongitude,
    };
    presenceMap.set(userId, presence);
  }

  // Persist to DB
  await prisma.riderProfile.update({
    where: { userId },
    data: {
      socketId,
      isConnected: true,
      lastHeartbeat: now,
      lastSeenAt: now,
      connectionQuality: 'good',
      sessionStartedAt: presence.sessionStartedAt,
    },
  }).catch((err) => {
    logger.error({ err, userId }, '[Presence] Failed to persist connection');
  });

  logger.info({ userId, socketId }, '[Presence] Rider connected');
  syncPresenceToRedis(presence);
}

/**
 * Rider disconnected from Socket.IO — start grace period.
 * Does NOT immediately go OFFLINE (allows for reconnection).
 */
export async function riderDisconnected(
  userId: string,
  reason: string
): Promise<void> {
  const presence = presenceMap.get(userId);
  if (!presence) return;

  presence.isConnected = false;
  presence.socketId = null;
  presence.connectionQuality = 'disconnected';

  // Persist disconnection to DB but DO NOT change availability
  await prisma.riderProfile.update({
    where: { userId },
    data: {
      isConnected: false,
      socketId: null,
      connectionQuality: 'disconnected',
      lastSeenAt: new Date(),
    },
  }).catch((err) => {
    logger.error({ err, userId }, '[Presence] Failed to persist disconnection');
  });

  logger.info({ userId, reason }, '[Presence] Rider disconnected — grace period started');
  syncPresenceToRedis(presence);
}

/**
 * Process a heartbeat from a rider (socket ping or REST location update).
 * This is the core "keep-alive" — as long as heartbeats arrive, gates stay open.
 */
export function recordHeartbeat(
  userId: string,
  coords?: { latitude: number; longitude: number }
): void {
  const presence = presenceMap.get(userId);
  if (!presence) return;

  // Per-userId throttle — reject rapid-fire heartbeats
  const now = Date.now();
  const lastTime = lastHeartbeatTime.get(userId);
  if (lastTime && now - lastTime < HEARTBEAT_THROTTLE_MS) {
    return; // Too soon — skip
  }
  lastHeartbeatTime.set(userId, now);

  const nowDate = new Date(now);
  presence.lastHeartbeat = nowDate;
  presence.lastSeenAt = nowDate;
  presence.missedHeartbeats = 0;

  if (coords) {
    presence.latitude = coords.latitude;
    presence.longitude = coords.longitude;
  }

  // Update connection quality based on heartbeat regularity
  presence.connectionQuality = presence.isConnected ? 'excellent' : 'good';
}

/**
 * Get a rider's presence info (for dispatch, admin dashboards, etc.).
 */
export function getRiderPresence(userId: string): RiderPresence | null {
  return presenceMap.get(userId) ?? null;
}

/**
 * Get all currently-online riders.
 * D-08: Merges local in-memory data with Redis for cross-instance visibility.
 */
export function getOnlineRiders(): RiderPresence[] {
  return Array.from(presenceMap.values());
}

/**
 * Get all online riders including those on other instances (async Redis read).
 * Use this for dispatch decisions where cross-instance data is critical.
 */
export async function getOnlineRidersGlobal(): Promise<RiderPresence[]> {
  const local = Array.from(presenceMap.values());
  const localIds = new Set(local.map((r) => r.userId));
  const remote = await getOnlineRidersFromRedis();
  // Merge: local takes precedence (more accurate), add remote-only riders
  for (const r of remote) {
    if (!localIds.has(r.userId)) {
      local.push(r);
    }
  }
  return local;
}

/**
 * Get count of online riders.
 */
export function getOnlineRiderCount(): number {
  return presenceMap.size;
}

/**
 * Check if a rider is truly active (connected or within grace period).
 */
export function isRiderActive(userId: string): boolean {
  const presence = presenceMap.get(userId);
  if (!presence) return false;

  if (presence.isConnected) return true;

  // Within grace period?
  const elapsed = Date.now() - presence.lastSeenAt.getTime();
  return elapsed < OFFLINE_GRACE_PERIOD_MS;
}

/**
 * Get rider's current session duration in seconds.
 */
export function getSessionDuration(userId: string): number {
  const presence = presenceMap.get(userId);
  if (!presence) return 0;

  const currentSessionSeconds = Math.floor(
    (Date.now() - presence.sessionStartedAt.getTime()) / 1000
  );
  return presence.priorOnlineSeconds + currentSessionSeconds;
}

/**
 * Manually force a rider OFFLINE (admin action, or rider toggle).
 */
export async function forceRiderOffline(userId: string): Promise<void> {
  const presence = presenceMap.get(userId);

  if (presence) {
    // Calculate total online time for this session
    const sessionSeconds = Math.floor(
      (Date.now() - presence.sessionStartedAt.getTime()) / 1000
    );
    const totalOnlineSeconds = presence.priorOnlineSeconds + sessionSeconds;

    await prisma.riderProfile.update({
      where: { userId },
      data: {
        availability: 'OFFLINE',
        isConnected: false,
        socketId: null,
        connectionQuality: null,
        sessionStartedAt: null,
        totalOnlineSeconds,
        lastSeenAt: new Date(),
      },
    }).catch((err) => {
      logger.error({ err, userId }, '[Presence] Failed to persist offline status');
    });

    presenceMap.delete(userId);
    lastHeartbeatTime.delete(userId);
    removePresenceFromRedis(userId);
    logger.info({ userId, sessionSeconds, totalOnlineSeconds }, '[Presence] Rider forced OFFLINE');
  } else {
    // Not in memory — just update DB
    await prisma.riderProfile.update({
      where: { userId },
      data: {
        availability: 'OFFLINE',
        isConnected: false,
        socketId: null,
        connectionQuality: null,
        sessionStartedAt: null,
      },
    }).catch(() => {});
  }
}

// ── Internal: Stale rider sweep ─────────────────────────────

async function sweepStaleRiders(): Promise<void> {
  const now = Date.now();
  let staleCount = 0;
  let offlinedCount = 0;

  for (const [userId, presence] of presenceMap.entries()) {
    const sinceLastHeartbeat = now - presence.lastHeartbeat.getTime();
    const sinceLastSeen = now - presence.lastSeenAt.getTime();

    // If connected but no heartbeat in STALE_THRESHOLD — mark quality as poor
    if (presence.isConnected && sinceLastHeartbeat > STALE_THRESHOLD_MS) {
      presence.connectionQuality = 'poor';
      presence.missedHeartbeats++;
      staleCount++;
    }

    // If disconnected and past grace period — auto-OFFLINE
    if (!presence.isConnected && sinceLastSeen > OFFLINE_GRACE_PERIOD_MS) {
      await forceRiderOffline(userId);
      offlinedCount++;
      continue;
    }

    // If connected but completely silent for extended period — auto-OFFLINE
    // This catches cases where the socket appears connected but is actually dead
    if (presence.isConnected && sinceLastHeartbeat > OFFLINE_GRACE_PERIOD_MS) {
      presence.isConnected = false;
      presence.connectionQuality = 'disconnected';
      await forceRiderOffline(userId);
      offlinedCount++;
    }
  }

  if (staleCount > 0 || offlinedCount > 0) {
    logger.info(
      { staleCount, offlinedCount, onlineCount: presenceMap.size },
      '[Presence] Sweep completed'
    );
  }
}

// ── Internal: DB sync ───────────────────────────────────────

async function syncPresenceToDB(): Promise<void> {
  const entries = Array.from(presenceMap.entries());
  if (entries.length === 0) return;

  let synced = 0;

  // Batch update in chunks of 10 to avoid overwhelming the DB
  for (let i = 0; i < entries.length; i += 10) {
    const chunk = entries.slice(i, i + 10);

    await Promise.allSettled(
      chunk.map(([userId, presence]) => {
        const currentSessionSeconds = Math.floor(
          (Date.now() - presence.sessionStartedAt.getTime()) / 1000
        );
        const totalOnlineSeconds = presence.priorOnlineSeconds + currentSessionSeconds;

        return prisma.riderProfile.update({
          where: { userId },
          data: {
            lastHeartbeat: presence.lastHeartbeat,
            lastSeenAt: presence.lastSeenAt,
            isConnected: presence.isConnected,
            connectionQuality: presence.connectionQuality,
            totalOnlineSeconds,
          },
        });
      })
    ).then((results) => {
      synced += results.filter((r) => r.status === 'fulfilled').length;
    });
  }

  logger.debug({ synced, total: entries.length }, '[Presence] DB sync completed');
}
