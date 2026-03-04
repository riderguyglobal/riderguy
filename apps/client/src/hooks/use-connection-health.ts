'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './use-socket';

// ============================================================
// Connection Health Monitor — Client App
//
// Keeps real-time order tracking connections alive:
//
// 1. Adaptive Heartbeat — sends lightweight pings at intervals
//    that adjust based on connection quality
// 2. Visibility-aware — detects when app is backgrounded and
//    sends immediate heartbeat on foreground return
// 3. Network-aware — reacts to online/offline events instantly
// 4. Quality scoring — tracks latency and missed heartbeats
//    to determine connection quality
// 5. REST fallback — pings API if socket is unreachable
// ============================================================

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'disconnected';

interface ConnectionHealth {
  quality: ConnectionQuality;
  socketConnected: boolean;
  networkOnline: boolean;
  lastHeartbeatAck: Date | null;
  latencyMs: number;
  missedHeartbeats: number;
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

/** Background mode heartbeat (more frequent to keep order updates flowing) */
const BACKGROUND_HEARTBEAT_MS = 15_000;

/** Max consecutive missed heartbeats before marking as disconnected */
const MAX_MISSED_HEARTBEATS = 3;

/** Heartbeat ACK timeout */
const HEARTBEAT_ACK_TIMEOUT_MS = 10_000;

export function useConnectionHealth() {
  const { socket, connected: socketConnected } = useSocket();

  const [health, setHealth] = useState<ConnectionHealth>({
    quality: 'disconnected',
    socketConnected: false,
    networkOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastHeartbeatAck: null,
    latencyMs: 0,
    missedHeartbeats: 0,
    isBackgrounded: false,
  });

  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);
  const missedCount = useRef(0);

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

    socket.emit('client:heartbeat' as any, {}, (response: any) => {
      clearTimeout(ackTimeout);

      const latency = Date.now() - sentAt;
      const now = new Date();

      missedCount.current = 0;

      setHealth((h) => ({
        ...h,
        lastHeartbeatAck: now,
        latencyMs: latency,
        missedHeartbeats: 0,
        quality: latency > 2000 ? 'poor' : latency > 500 ? 'good' : 'excellent',
      }));
    });
  }, [socket, socketConnected, evaluateQuality]);

  // ── Adaptive heartbeat timer ──
  useEffect(() => {
    if (!health.networkOnline) {
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
  }, [health.networkOnline, health.quality, health.isBackgrounded, sendHeartbeat]);

  // ── Visibility change detection ──
  useEffect(() => {
    const handleVisibility = () => {
      const isBackgrounded = document.visibilityState === 'hidden';
      setHealth((h) => ({ ...h, isBackgrounded }));

      // When returning to foreground, send immediate heartbeat
      if (!isBackgrounded && health.networkOnline) {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [health.networkOnline, sendHeartbeat]);

  // ── Network status detection ──
  useEffect(() => {
    const goOnline = () => {
      setHealth((h) => ({ ...h, networkOnline: true }));
      sendHeartbeat();
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
  }, [sendHeartbeat]);

  // ── Sync socket connected state ──
  useEffect(() => {
    setHealth((h) => ({ ...h, socketConnected }));
  }, [socketConnected]);

  return health;
}
