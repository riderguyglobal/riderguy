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
import * as ChatService from '../services/chat.service';

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
  io.on('connection', async (socket) => {
    const userId = (socket.data as any).userId as string;
    const role = (socket.data as any).role as string;

    logger.info({ socketId: socket.id, userId, role }, 'WebSocket connected');

    // Auto-join the user's own room for direct notifications
    socket.join(`user:${userId}`);

    // Auto-join role-based room for targeted broadcasts (e.g., job:new to riders only)
    socket.join(`role:${role}`);

    // Cache user firstName to avoid DB queries on typing events
    const connectedUser = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    (socket as any).data = { ...(socket as any).data, firstName: connectedUser?.firstName ?? 'Someone' };

    // Throttle map: track last location update time per rider
    let lastLocationUpdate = 0;
    const LOCATION_THROTTLE_MS = 3000; // Minimum 3 seconds between location updates

    // ── Rider location updates ──
    socket.on('rider:updateLocation', async (data, ack) => {
      try {
        // Throttle: reject updates that come too fast
        const now = Date.now();
        if (now - lastLocationUpdate < LOCATION_THROTTLE_MS) {
          ack?.({ success: true }); // Silently accept but don't process
          return;
        }
        lastLocationUpdate = now;

        const { latitude, longitude, heading, speed } = data;

        // Update rider's current position and get profile in a single query
        const riderProfile = await prisma.riderProfile.update({
          where: { userId },
          data: {
            currentLatitude: latitude,
            currentLongitude: longitude,
            lastLocationUpdate: new Date(),
          },
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

    // ── Subscribe to order updates (with access control) ──
    socket.on('order:subscribe', async ({ orderId }) => {
      try {
        // Verify the user is part of this order (client, assigned rider, or admin)
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            clientId: true,
            rider: { select: { userId: true } },
          },
        });

        if (!order) return;

        const isClient = order.clientId === userId;
        const isRider = order.rider?.userId === userId;
        const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'DISPATCHER';

        if (!isClient && !isRider && !isAdmin) {
          logger.warn({ socketId: socket.id, userId, orderId }, 'Unauthorized order:subscribe attempt');
          return;
        }

        socket.join(`order:${orderId}`);
        logger.debug({ socketId: socket.id, orderId }, 'Subscribed to order room');
      } catch (err) {
        logger.error({ err, userId, orderId }, 'Failed to authorize order:subscribe');
      }
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
      if (!socket.rooms.has(`order:${orderId}`)) return;
      socket.to(`order:${orderId}`).emit('message:typing', {
        orderId,
        senderId: userId,
        senderName: (socket as any).data.firstName ?? 'Someone',
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

    // ── Community Chat — Sprint 11 ──

    // Join a community chat room (for real-time messages)
    socket.on('community:join', async (data, ack) => {
      try {
        const member = await prisma.chatMember.findFirst({
          where: { roomId: data.roomId, userId },
        });
        if (!member) {
          ack?.({ success: false });
          return;
        }
        socket.join(`community:${data.roomId}`);
        logger.debug({ socketId: socket.id, roomId: data.roomId }, 'Joined community chat room');
        ack?.({ success: true });
      } catch (err) {
        logger.error({ err, userId }, 'Failed to join community room');
        ack?.({ success: false });
      }
    });

    // Leave a community chat room
    socket.on('community:leave', (data) => {
      socket.leave(`community:${data.roomId}`);
    });

    // Send a message in a community chat room
    socket.on('community:send', async (data, ack) => {
      try {
        const message = await ChatService.sendMessage({
          roomId: data.roomId,
          senderId: userId,
          content: data.content,
          type: (data.type as any) ?? 'TEXT',
          mediaUrl: data.mediaUrl,
          replyToId: data.replyToId,
        });

        // Broadcast to everyone in the room
        io.to(`community:${data.roomId}`).emit('community:message', {
          id: message.id,
          roomId: message.roomId,
          senderId: message.senderId,
          senderName: message.senderName,
          senderAvatar: message.senderAvatar ?? null,
          type: message.type as any,
          content: message.content,
          mediaUrl: message.mediaUrl,
          replyToId: message.replyToId,
          reactions: message.reactions as any,
          createdAt: message.createdAt,
        });

        ack?.({ success: true, messageId: message.id });
      } catch (err) {
        logger.error({ err, userId }, 'Failed to send community message');
        ack?.({ success: false });
      }
    });

    // Community chat typing indicator
    socket.on('community:typing', (data) => {
      socket.to(`community:${data.roomId}`).emit('community:typing', {
        roomId: data.roomId,
        userId,
        firstName: (socket as any).data.firstName ?? 'Someone',
      });
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
  if (zoneId) {
    // Emit only to riders in the specific zone room
    io.to(`zone:${zoneId}`).emit('job:new', data);
  } else {
    // Fallback: emit to the global riders room (not all connected users)
    io.to('role:RIDER').emit('job:new', data);
  }
}
