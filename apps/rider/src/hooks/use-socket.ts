'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { tokenStorage } from '@riderguy/auth';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@riderguy/types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

// ── Module-scoped singleton ─────────────────────────────────
// All components that call useSocket() share ONE socket connection.
let sharedSocket: AppSocket | null = null;
let subscriberCount = 0;
let connectedListeners: Set<(val: boolean) => void> = new Set();
let isConnected = false;

function setGlobalConnected(val: boolean) {
  isConnected = val;
  connectedListeners.forEach((fn) => fn(val));
}

function getOrCreateSocket(): AppSocket | null {
  const token = tokenStorage.getAccessToken();
  if (!token) return null;
  if (sharedSocket?.connected) return sharedSocket;
  if (sharedSocket) return sharedSocket; // reconnecting

  const socket: AppSocket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    setGlobalConnected(true);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    setGlobalConnected(false);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
    setGlobalConnected(false);
  });

  sharedSocket = socket;
  return socket;
}

/**
 * Singleton Socket.IO connection for the rider app.
 * All components share a single connection. Connection is
 * created on first mount and destroyed when the last
 * subscriber unmounts.
 */
export function useSocket() {
  const [connected, setConnected] = useState(isConnected);

  useEffect(() => {
    // Track this subscriber
    subscriberCount++;
    connectedListeners.add(setConnected);

    // Ensure socket exists
    getOrCreateSocket();

    // Sync initial state
    setConnected(sharedSocket?.connected ?? false);

    return () => {
      subscriberCount--;
      connectedListeners.delete(setConnected);

      // Disconnect only when the last subscriber unmounts
      if (subscriberCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        subscriberCount = 0;
        setGlobalConnected(false);
      }
    };
  }, []);

  const emitLocation = useCallback(
    (lat: number, lng: number, heading?: number, speed?: number) => {
      sharedSocket?.emit('rider:updateLocation', { latitude: lat, longitude: lng, heading, speed }, () => {
        // ack
      });
    },
    [],
  );

  const subscribeToOrder = useCallback((orderId: string) => {
    sharedSocket?.emit('order:subscribe', { orderId });
  }, []);

  const unsubscribeFromOrder = useCallback((orderId: string) => {
    sharedSocket?.emit('order:unsubscribe', { orderId });
  }, []);

  const sendMessage = useCallback(
    (orderId: string, content: string) => {
      sharedSocket?.emit(
        'message:send',
        { orderId, content },
        () => {
          // ack
        },
      );
    },
    [],
  );

  const sendTyping = useCallback((orderId: string) => {
    sharedSocket?.emit('message:typing', { orderId });
  }, []);

  const respondToOffer = useCallback(
    (orderId: string, response: 'accept' | 'decline', ack?: (res: { success: boolean; error?: string }) => void) => {
      sharedSocket?.emit('job:offer:respond', { orderId, response }, ack);
    },
    [],
  );

  return {
    socket: sharedSocket,
    connected,
    emitLocation,
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
    respondToOffer,
  };
}
