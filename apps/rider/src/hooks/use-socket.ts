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

  useEffect(() => {
    const s = getOrCreateSocket();
    listenerCount++;
    if (!s.connected) s.connect();
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
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
    sharedSocket?.emit('job:offer:respond', { orderId, accepted });
  }, []);

  return {
    socket,
    connected,
    emitLocation,
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
    respondToOffer,
  };
}
