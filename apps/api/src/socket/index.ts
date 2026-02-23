import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../lib/logger';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@riderguy/types';
import { prisma } from '@riderguy/database';
import { handleOfferResponse } from '../services/auto-dispatch.service';

// ============================================================
// Socket.IO Server — real-time layer for RiderGuy
// Handles: rider location tracking, order status updates,
// in-app messaging, and dispatch notifications.
// ============================================================

export type AppSocket = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

let io: AppSocket;

/**
 * Initialise the Socket.IO server and attach event handlers.
 */
export function initSocketServer(httpServer: HttpServer): AppSocket {
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: config.cors.origins,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
  });

  // ── Authentication middleware ──
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verify(token, config.jwt.accessSecret) as {
        userId: string;
        role: string;
      };
      (socket.data as any).userId = payload.userId;
      (socket.data as any).role = payload.role;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ──
  io.on('connection', (socket) => {
    const userId = (socket.data as any).userId as string;
    const role = (socket.data as any).role as string;

    logger.info({ socketId: socket.id, userId, role }, 'WebSocket connected');

    // Auto-join the user's own room for direct notifications
    socket.join(`user:${userId}`);

    // ── Rider location updates ──
    socket.on('rider:updateLocation', async (data, ack) => {
      try {
        const { latitude, longitude, heading, speed } = data;

        // Update rider's current position in DB
        await prisma.riderProfile.updateMany({
          where: { userId },
          data: {
            currentLatitude: latitude,
            currentLongitude: longitude,
            lastLocationUpdate: new Date(),
          },
        });

        // Find rider's active orders and broadcast to those rooms
        const riderProfile = await prisma.riderProfile.findUnique({
          where: { userId },
          select: { id: true },
        });

        if (riderProfile) {
          const activeOrders = await prisma.order.findMany({
            where: {
              riderId: riderProfile.id,
              status: {
                in: [
                  'ASSIGNED',
                  'PICKUP_EN_ROUTE',
                  'AT_PICKUP',
                  'PICKED_UP',
                  'IN_TRANSIT',
                  'AT_DROPOFF',
                ],
              },
            },
            select: { id: true },
          });

          for (const order of activeOrders) {
            io.to(`order:${order.id}`).emit('rider:location', {
              orderId: order.id,
              riderId: riderProfile.id,
              latitude,
              longitude,
              heading,
              speed,
              timestamp: new Date().toISOString(),
            });
          }
        }

        ack?.({ success: true });
      } catch (err) {
        logger.error({ err, userId }, 'Failed to update rider location');
        ack?.({ success: false });
      }
    });

    // ── Subscribe to order updates ──
    socket.on('order:subscribe', ({ orderId }) => {
      socket.join(`order:${orderId}`);
      logger.debug({ socketId: socket.id, orderId }, 'Subscribed to order room');
    });

    socket.on('order:unsubscribe', ({ orderId }) => {
      socket.leave(`order:${orderId}`);
    });

    // ── In-app messaging ──
    socket.on('message:send', async (data, ack) => {
      try {
        const { orderId, content } = data;

        // Verify the user is part of this order
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            clientId: true,
            rider: { select: { userId: true } },
          },
        });

        if (!order) {
          ack?.({ success: false });
          return;
        }

        const isClient = order.clientId === userId;
        const isRider = order.rider?.userId === userId;
        if (!isClient && !isRider) {
          ack?.({ success: false });
          return;
        }

        // Get sender name
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        });

        // Save message to DB
        const message = await prisma.orderMessage.create({
          data: {
            orderId,
            senderId: userId,
            content,
          },
        });

        const senderName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
        const senderRole = isRider ? 'rider' : 'client';

        // Broadcast to order room
        io.to(`order:${orderId}`).emit('message:new', {
          id: message.id,
          orderId,
          senderId: userId,
          senderName,
          senderRole: senderRole as 'rider' | 'client',
          content,
          timestamp: message.createdAt.toISOString(),
        });

        ack?.({ success: true, messageId: message.id });
      } catch (err) {
        logger.error({ err, userId }, 'Failed to send message');
        ack?.({ success: false });
      }
    });

    // ── Typing indicator ──
    socket.on('message:typing', async ({ orderId }) => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true },
      });
      socket.to(`order:${orderId}`).emit('message:typing', {
        orderId,
        senderId: userId,
        senderName: user?.firstName ?? 'Someone',
      });
    });

    // ── Respond to targeted job offer (auto-dispatch) ──
    socket.on('job:offer:respond', async (data, ack) => {
      try {
        const { orderId, response } = data;
        const result = await handleOfferResponse(orderId, userId, response);
        ack?.({ success: result.success, error: result.error });
      } catch (err) {
        logger.error({ err, userId }, 'Failed to process job offer response');
        ack?.({ success: false, error: 'Internal error' });
      }
    });

    // ── Disconnect ──
    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'WebSocket disconnected');
    });
  });

  logger.info('Socket.IO server initialised');
  return io;
}

/**
 * Get the Socket.IO server instance (call after init).
 */
export function getIO(): AppSocket {
  if (!io) throw new Error('Socket.IO not initialised — call initSocketServer() first');
  return io;
}

/**
 * Emit an order status update to everyone subscribed to that order.
 */
export function emitOrderStatusUpdate(data: {
  orderId: string;
  orderNumber: string;
  status: string;
  previousStatus: string;
  actor: string;
  note?: string;
}) {
  if (!io) return;
  io.to(`order:${data.orderId}`).emit('order:status', {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit a new job notification to all riders in a zone.
 */
export function emitNewJob(zoneId: string | null, data: {
  orderId: string;
  orderNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  totalPrice: number;
  packageType: string;
}) {
  if (!io) return;
  // Broadcast to all connected riders — they filter client-side by zone
  io.emit('job:new', data);
}
