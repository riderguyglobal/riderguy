'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/constants';
import { tokenStorage } from '@riderguy/auth';

// ── Shared singleton with reference counting ────────────
const API_WS_URL = API_BASE_URL.replace('/api/v1', '');

let sharedSocket: Socket | null = null;
let refCount = 0;

function getOrCreateSocket(): Socket {
  if (sharedSocket && !sharedSocket.disconnected) return sharedSocket;

  sharedSocket = io(API_WS_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    auth: (cb) => {
      const token = tokenStorage.getAccessToken();
      cb({ token });
    },
  });

  return sharedSocket;
}

// ── Hook — manages lifecycle via reference counting ─────
export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = getOrCreateSocket();
    refCount++;
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
    subscribeToOrder,
    unsubscribeFromOrder,
    sendMessage,
    sendTyping,
  };
}
