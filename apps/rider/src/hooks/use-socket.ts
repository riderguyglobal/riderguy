'use client';

import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { tokenStorage } from '@riderguy/auth';

const API_WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace('/api/v1', '');

let sharedSocket: Socket | null = null;
let listenerCount = 0;

function getOrCreateSocket(): Socket {
  if (sharedSocket && !sharedSocket.disconnected) return sharedSocket;

  sharedSocket = io(API_WS_URL, {
    auth: (cb) => cb({ token: tokenStorage.getAccessToken() }),
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 15,
    reconnectionDelay: 2_000,
    timeout: 10_000,
  });

  return sharedSocket;
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);

  useEffect(() => {
    const s = getOrCreateSocket();
    listenerCount++;
    if (!s.connected) s.connect();
    setSocket(s);

    const onConnect = () => {
      console.log('[Socket] Connected ✓ id:', s.id);
      setConnected(true);
      setSocketError(null);
    };
    const onDisconnect = (reason: string) => {
      console.warn('[Socket] Disconnected:', reason);
      setConnected(false);
    };
    const onConnectError = (err: Error) => {
      console.error('[Socket] Connection error:', err.message);
      setSocketError(err.message);
      setConnected(false);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    if (s.connected) {
      setConnected(true);
      setSocketError(null);
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
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

  return {
    socket,
    connected,
    socketError,
    emitLocation,
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
    respondToOffer,
  };
}
