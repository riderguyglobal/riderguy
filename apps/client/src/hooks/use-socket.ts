'use client';

import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/constants';
import { tokenStorage } from '@riderguy/auth';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  const baseUrl = API_BASE_URL.replace('/api/v1', '');
  socket = io(baseUrl, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    auth: (cb) => {
      const token = tokenStorage.getAccessToken();
      cb({ token });
    },
  });

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function subscribeToOrder(orderId: string) {
  getSocket().emit('order:subscribe', { orderId });
}

export function unsubscribeFromOrder(orderId: string) {
  getSocket().emit('order:unsubscribe', { orderId });
}

export function sendMessage(orderId: string, content: string) {
  getSocket().emit('message:send', { orderId, content });
}

export function sendTyping(orderId: string) {
  getSocket().emit('message:typing', { orderId });
}
