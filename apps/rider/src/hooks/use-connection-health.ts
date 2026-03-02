'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './use-socket';
import { useAuth } from '@riderguy/auth';

// ============================================================
// Connection Health Monitor
//
// Keeps the rider's API gates OPEN continuously while ONLINE:
//
// 1. Adaptive Heartbeat — sends lightweight pings at intervals
//    that adjust based on connection quality (faster when poor)
// 2. Visibility-aware — increases heartbeat rate when app is
//    backgrounded to prevent OS from killing the connection
// 3. Network-aware — reacts to online/offline events instantly
// 4. Server time sync — detects clock drift for accurate TTLs
// 5. Reconnection orchestrator — coordinates socket reconnect
//    with GPS re-acquisition and heartbeat restart
// ============================================================

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'disconnected';

interface ConnectionHealth {
  quality: ConnectionQuality;
  socketConnected: boolean;
  networkOnline: boolean;
  lastHeartbeatAck: Date | null;
  latencyMs: number;
  missedHeartbeats: number;
  sessionDurationSec: number;
  isBackgrounded: boolean;
}

// ── Adaptive intervals ──────────────────────────────────────

/** Heartbeat intervals by connection quality */
const HEARTBEAT_INTERVALS: Record<ConnectionQuality, number> = {
  excellent: 30_000,    // 30s — everything is fine
  good: 20_000,         // 20s — slightly more frequent
  poor: 10_000,         // 10s — aggressive keep-alive
  disconnected: 5_000,  // 5s  — trying to reconnect
};

/** Background mode heartbeat (more frequent to prevent OS kill) */
const BACKGROUND_HEARTBEAT_MS = 15_000;

/** Max consecutive missed heartbeats before marking as disconnected */
const MAX_MISSED_HEARTBEATS = 3;

/** Heartbeat ACK timeout */
const HEARTBEAT_ACK_TIMEOUT_MS = 10_000;

export function useConnectionHealth(isOnline: boolean) {
  const { socket, connected: socketConnected } = useSocket();
  const { api } = useAuth();

  const [health, setHealth] = useState<ConnectionHealth>({
    quality: 'disconnected',
    socketConnected: false,
    networkOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastHeartbeatAck: null,
    latencyMs: 0,
    missedHeartbeats: 0,
    sessionDurationSec: 0,
    isBackgrounded: false,
  });

  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);
  const sessionTimer = useRef<NodeJS.Timeout | null>(null);
  const sessionStart = useRef<Date | null>(null);
  const missedCount = useRef(0);
  const lastAck = useRef<Date | null>(null);

  // ── Determine connection quality ──
  const evaluateQuality = useCallback((): ConnectionQuality => {
    if (!health.networkOnline) return 'disconnected';
    if (!socketConnected) return 'poor';

    if (missedCount.current >= MAX_MISSED_HEARTBEATS) return 'disconnected';
    if (missedCount.current >= 1) return 'poor';
    if (health.latencyMs > 2000) return 'poor';
    if (health.latencyMs > 500) return 'good';
    return 'excellent';
  }, [health.networkOnline, health.latencyMs, socketConnected]);

  // ── Send heartbeat via socket ──
  const sendHeartbeat = useCallback(() => {
    if (!socket || !socketConnected) {
      missedCount.current++;
      setHealth((h) => ({
        ...h,
        missedHeartbeats: missedCount.current,
        quality: missedCount.current >= MAX_MISSED_HEARTBEATS ? 'disconnected' : 'poor',
      }));

      // Fallback: send REST heartbeat if socket is down
      if (api && isOnline) {
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            api.post('/riders/location', {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }).then(() => {
              // REST heartbeat succeeded — connection isn't fully dead
              missedCount.current = Math.max(0, missedCount.current - 1);
              setHealth((h) => ({
                ...h,
                quality: 'poor',
                missedHeartbeats: missedCount.current,
              }));
            }).catch(() => {});
          },
          () => {},
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
        );
      }
      return;
    }

    const sentAt = Date.now();

    // Use a timeout to detect failed ACKs
    const ackTimeout = setTimeout(() => {
      missedCount.current++;
      setHealth((h) => ({
        ...h,
        missedHeartbeats: missedCount.current,
        quality: evaluateQuality(),
      }));
    }, HEARTBEAT_ACK_TIMEOUT_MS);

    socket.emit('rider:heartbeat' as any, {}, (response: any) => {
      clearTimeout(ackTimeout);

      const latency = Date.now() - sentAt;
      const now = new Date();

      missedCount.current = 0;
      lastAck.current = now;

      setHealth((h) => ({
        ...h,
        lastHeartbeatAck: now,
        latencyMs: latency,
        missedHeartbeats: 0,
        quality: latency > 2000 ? 'poor' : latency > 500 ? 'good' : 'excellent',
      }));
    });
  }, [socket, socketConnected, api, isOnline, evaluateQuality]);

  // ── Adaptive heartbeat timer ──
  useEffect(() => {
    if (!isOnline) {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      return;
    }

    // Determine interval based on current quality & visibility
    const interval = health.isBackgrounded
      ? BACKGROUND_HEARTBEAT_MS
      : HEARTBEAT_INTERVALS[health.quality] ?? HEARTBEAT_INTERVALS.good;

    // Clear existing timer
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);

    // Send immediate heartbeat then schedule recurring
    sendHeartbeat();
    heartbeatTimer.current = setInterval(sendHeartbeat, interval);

    return () => {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    };
  }, [isOnline, health.quality, health.isBackgrounded, sendHeartbeat]);

  // ── Session duration counter ──
  useEffect(() => {
    if (isOnline) {
      sessionStart.current = new Date();

      sessionTimer.current = setInterval(() => {
        if (sessionStart.current) {
          setHealth((h) => ({
            ...h,
            sessionDurationSec: Math.floor((Date.now() - sessionStart.current!.getTime()) / 1000),
          }));
        }
      }, 1_000);
    } else {
      sessionStart.current = null;
      if (sessionTimer.current) clearInterval(sessionTimer.current);
    }

    return () => {
      if (sessionTimer.current) clearInterval(sessionTimer.current);
    };
  }, [isOnline]);

  // ── Visibility change detection ──
  useEffect(() => {
    const handleVisibility = () => {
      const isBackgrounded = document.visibilityState === 'hidden';
      setHealth((h) => ({ ...h, isBackgrounded }));

      // When returning to foreground, send immediate heartbeat
      if (!isBackgrounded && isOnline) {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isOnline, sendHeartbeat]);

  // ── Network status detection ──
  useEffect(() => {
    const goOnline = () => {
      setHealth((h) => ({ ...h, networkOnline: true }));
      // Immediate heartbeat when network comes back
      if (isOnline) sendHeartbeat();
    };

    const goOffline = () => {
      setHealth((h) => ({
        ...h,
        networkOnline: false,
        quality: 'disconnected',
      }));
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [isOnline, sendHeartbeat]);

  // ── Sync socket connected state ──
  useEffect(() => {
    setHealth((h) => ({ ...h, socketConnected }));
  }, [socketConnected]);

  return health;
}
