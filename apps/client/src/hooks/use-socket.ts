'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/constants';
import { tokenStorage } from '@riderguy/auth';

// ── Shared singleton with reference counting ────────────
const API_WS_URL = API_BASE_URL.replace('/api/v1', '');

let sharedSocket: Socket | null = null;
let refCount = 0;

// ── Reconnection constants ──────────────────────────────
const MAX_RECONNECT_ATTEMPTS = Infinity; // Never stop trying while user has the app open
const RECONNECT_DELAY_BASE = 1_000;      // Start at 1s
const RECONNECT_DELAY_MAX = 30_000;      // Cap at 30s
const CONNECT_TIMEOUT = 15_000;          // 15s timeout for initial connect

function getOrCreateSocket(): Socket {
  if (sharedSocket && !sharedSocket.disconnected) return sharedSocket;

  sharedSocket = io(API_WS_URL, {
    autoConnect: false,
    auth: (cb) => cb({ token: tokenStorage.getAccessToken() }),
    transports: ['websocket', 'polling'],
    // ── Persistent connection config ──
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_DELAY_BASE,
    reconnectionDelayMax: RECONNECT_DELAY_MAX,
    randomizationFactor: 0.3,       // Jitter to prevent thundering herd
    timeout: CONNECT_TIMEOUT,
    // ── Upgrade from polling to websocket automatically ──
    upgrade: true,
    rememberUpgrade: true,
  });

  // ── Auto-refresh auth token on reconnect attempt ──
  sharedSocket.io.on('reconnect_attempt', (attempt) => {
    console.log(`[Socket] Reconnect attempt #${attempt}`);
    // Re-read token in case it was refreshed while disconnected
    (sharedSocket as any).auth = { token: tokenStorage.getAccessToken() };
  });

  // ── Handle auth errors — token may be expired ──
  sharedSocket.on('connect_error', (err) => {
    if (err.message?.includes('expired') || err.message?.includes('Invalid')) {
      console.warn('[Socket] Auth error — token may need refresh');
      // The auth interceptor in @riderguy/auth will handle refresh
      // Next reconnect attempt will use the fresh token
    }
  });

  return sharedSocket;
}

// ── Hook — manages lifecycle via reference counting ─────
export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    const s = getOrCreateSocket();
    refCount++;
    if (!s.connected) s.connect();
    setSocket(s);

    const onConnect = () => {
      console.log('[Socket] Connected ✓ id:', s.id);
      setConnected(true);
      setSocketError(null);
      setReconnecting(false);
      setReconnectAttempt(0);
    };
    const onDisconnect = (reason: string) => {
      console.warn('[Socket] Disconnected:', reason);
      setConnected(false);

      // If the server disconnected us (e.g., auth failure), try to reconnect
      if (reason === 'io server disconnect') {
        s.auth = { token: tokenStorage.getAccessToken() };
        s.connect();
      }
    };
    const onConnectError = (err: Error) => {
      console.error('[Socket] Connection error:', err.message);
      setSocketError(err.message);
      setConnected(false);
    };
    const onReconnecting = (attempt: number) => {
      setReconnecting(true);
      setReconnectAttempt(attempt);
    };
    const onReconnect = () => {
      console.log('[Socket] Reconnected ✓');
      setReconnecting(false);
      setReconnectAttempt(0);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.io.on('reconnect_attempt', onReconnecting);
    s.io.on('reconnect', onReconnect);
    if (s.connected) {
      setConnected(true);
      setSocketError(null);
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.io.off('reconnect_attempt', onReconnecting);
      s.io.off('reconnect', onReconnect);
      refCount--;
      if (refCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        refCount = 0;
      }
    };
  }, []);

  const subscribeToOrder = useCallback((orderId: string) => {
    sharedSocket?.emit('order:subscribe', { orderId });
  }, []);

  const unsubscribeFromOrder = useCallback((orderId: string) => {
    sharedSocket?.emit('order:unsubscribe', { orderId });
  }, []);

  const sendMessage = useCallback((orderId: string, content: string) => {
    sharedSocket?.emit('message:send', { orderId, content });
  }, []);

  const sendTyping = useCallback((orderId: string) => {
    sharedSocket?.emit('message:typing', { orderId });
  }, []);

  return {
    socket,
    connected,
    socketError,
    reconnecting,
    reconnectAttempt,
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
  };
}
