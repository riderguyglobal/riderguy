'use client';

import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { tokenStorage } from '@riderguy/auth';

const API_WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace('/api/v1', '');

let sharedSocket: Socket | null = null;
let listenerCount = 0;

// ── Reconnection constants ──────────────────────────────────
const MAX_RECONNECT_ATTEMPTS = Infinity; // Never stop trying while rider is ONLINE
const RECONNECT_DELAY_BASE = 1_000;      // Start at 1s
const RECONNECT_DELAY_MAX = 30_000;      // Cap at 30s
const CONNECT_TIMEOUT = 15_000;          // 15s timeout for initial connect

function getOrCreateSocket(): Socket {
  if (sharedSocket && !sharedSocket.disconnected) return sharedSocket;

  sharedSocket = io(API_WS_URL, {
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
    // Keep callback form so token is read at connection time, not capture time
    (sharedSocket as any).auth = (cb: (v: Record<string, string>) => void) =>
      cb({ token: tokenStorage.getAccessToken() ?? '' });
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

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    const s = getOrCreateSocket();
    listenerCount++;
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
        // Server forced disconnect — reconnect with fresh token
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

    // iOS kills WebSocket after ~30s in background — force instant reconnect on wake
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !s.connected) {
        s.io.opts.reconnectionDelay = RECONNECT_DELAY_BASE;
        s.connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.io.off('reconnect_attempt', onReconnecting);
      s.io.off('reconnect', onReconnect);
      document.removeEventListener('visibilitychange', handleVisibility);
      listenerCount--;
      if (listenerCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        listenerCount = 0;
      }
    };
  }, []);

  const emitLocation = useCallback((lat: number, lng: number, heading?: number) => {
    sharedSocket?.emit('rider:updateLocation', { latitude: lat, longitude: lng, heading });
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

  const respondToOffer = useCallback((orderId: string, accepted: boolean) => {
    const response = accepted ? 'accept' : 'decline';
    sharedSocket?.emit('job:offer:respond', { orderId, response } as any);
  }, []);

  /** Respond to a job offer and await the server acknowledgement */
  const respondToOfferAsync = useCallback(
    (orderId: string, accepted: boolean): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!sharedSocket?.connected) {
          resolve({ success: false, error: 'Not connected to server' });
          return;
        }
        const response = accepted ? 'accept' : 'decline';
        // Timeout handle — cleared when ACK arrives
        const timer = setTimeout(() => {
          resolve({ success: false, error: 'Server response timed out' });
        }, 10_000);
        // Use Socket.IO acknowledgement callback
        sharedSocket.emit(
          'job:offer:respond',
          { orderId, response } as any,
          (ack: { success: boolean; error?: string }) => {
            clearTimeout(timer);
            resolve(ack ?? { success: false, error: 'No response from server' });
          },
        );
      });
    },
    [],
  );

  return {
    socket,
    connected,
    socketError,
    reconnecting,
    reconnectAttempt,
    emitLocation,
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
    respondToOffer,
    respondToOfferAsync,
  };
}
