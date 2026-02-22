'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { tokenStorage } from '@riderguy/auth';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@riderguy/types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

/**
 * Singleton Socket.IO connection for the rider app.
 * Automatically connects when a user is authenticated.
 */
export function useSocket() {
  const socketRef = useRef<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (!token) return;

    if (socketRef.current?.connected) return;

    const socket: AppSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      setConnected(true);
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      setConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, []);

  const emitLocation = useCallback(
    (lat: number, lng: number, heading?: number, speed?: number) => {
      socketRef.current?.emit('rider:updateLocation', { latitude: lat, longitude: lng, heading, speed }, () => {
        // ack
      });
    },
    [],
  );

  const subscribeToOrder = useCallback((orderId: string) => {
    socketRef.current?.emit('order:subscribe', { orderId });
  }, []);

  const unsubscribeFromOrder = useCallback((orderId: string) => {
    socketRef.current?.emit('order:unsubscribe', { orderId });
  }, []);

  const sendMessage = useCallback(
    (orderId: string, content: string) => {
      socketRef.current?.emit(
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
    socketRef.current?.emit('message:typing', { orderId });
  }, []);

  return {
    socket: socketRef.current,
    connected,
    emitLocation,
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
  };
}
