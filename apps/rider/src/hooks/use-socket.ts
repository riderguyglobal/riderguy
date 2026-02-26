'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { tokenStorage } from '@riderguy/auth';

const API_WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace('/api/v1', '');

let sharedSocket: Socket | null = null;
let listenerCount = 0;

function getOrCreateSocket(): Socket {
  if (sharedSocket?.connected) return sharedSocket;

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
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getOrCreateSocket();
    socketRef.current = socket;
    listenerCount++;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      listenerCount--;
      if (listenerCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        listenerCount = 0;
      }
    };
  }, []);

  const emitLocation = useCallback((lat: number, lng: number, heading?: number) => {
    socketRef.current?.emit('rider:updateLocation', { latitude: lat, longitude: lng, heading });
  }, []);

  const subscribeToOrder = useCallback((orderId: string) => {
    socketRef.current?.emit('order:subscribe', { orderId });
  }, []);

  const unsubscribeFromOrder = useCallback((orderId: string) => {
    socketRef.current?.emit('order:unsubscribe', { orderId });
  }, []);

  const sendMessage = useCallback((orderId: string, content: string) => {
    socketRef.current?.emit('message:send', { orderId, content });
  }, []);

  const sendTyping = useCallback((orderId: string) => {
    socketRef.current?.emit('message:typing', { orderId });
  }, []);

  const respondToOffer = useCallback((orderId: string, accepted: boolean) => {
    socketRef.current?.emit('job:offer:respond', { orderId, accepted });
  }, []);

  return {
    socket: socketRef.current,
    connected,
    emitLocation,
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
    respondToOffer,
  };
}
