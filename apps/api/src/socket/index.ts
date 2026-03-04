import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../lib/logger';
import { getRedisPubSub } from '../lib/redis';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@riderguy/types';
import { prisma } from '@riderguy/database';
import { handleOfferResponse, getPendingOfferForRider } from '../services/auto-dispatch.service';
import * as ChatService from '../services/chat.service';
import {
  riderConnected,
  riderDisconnected,
  recordHeartbeat,
  getOnlineRiders,
} from '../services/presence.service';

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

  // ── Redis adapter for multi-instance support ──
  const redisPubSub = getRedisPubSub();
  if (redisPubSub) {
    try {
      // Dynamic import to avoid hard dependency
      const { createAdapter } = require('@socket.io/redis-adapter');
      io.adapter(createAdapter(redisPubSub.pub, redisPubSub.sub));
      logger.info('[Socket] Redis adapter attached — multi-instance support enabled');
    } catch (err) {
      logger.warn({ err }, '[Socket] @socket.io/redis-adapter not installed — using in-memory adapter');
    }
  }

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
        roles?: string[];
      };
      (socket.data as any).userId = payload.userId;
      (socket.data as any).role = payload.role;
      (socket.data as any).roles = payload.roles || [payload.role];
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Per-socket event rate limiter ──
  // Prevents any single connection from flooding with events
  const SOCKET_RATE_LIMIT = 60; // max events per window
  const SOCKET_RATE_WINDOW_MS = 10_000; // 10 second window

  io.use((socket, next) => {
    let eventCount = 0;
    let windowStart = Date.now();

    const originalOnEvent = (socket as any).onevent;
    (socket as any).onevent = function (packet: any) {
      const now = Date.now();
      if (now - windowStart > SOCKET_RATE_WINDOW_MS) {
        // Reset window
        eventCount = 0;
        windowStart = now;
      }
      eventCount++;
      if (eventCount > SOCKET_RATE_LIMIT) {
        logger.warn(
          { socketId: socket.id, userId: (socket.data as any)?.userId },
          '[Socket] Rate limited — too many events',
        );
        return; // Drop the event silently
      }
      return originalOnEvent.call(this, packet);
    };
    next();
  });

  // ── Connection handler ──
  io.on('connection', async (socket) => {
    const userId = (socket.data as any).userId as string;
    const role = (socket.data as any).role as string;
    const roles = (socket.data as any).roles as string[];

    logger.info({ socketId: socket.id, userId, role, roles }, 'WebSocket connected');

    // Auto-join the user's own room for direct notifications
    socket.join(`user:${userId}`);

    // Auto-join role-based rooms for targeted broadcasts (e.g., job:new to riders)
    // With multi-role support, a user may belong to more than one role room
    for (const r of roles) {
      socket.join(`role:${r}`);
    }

    // ── Register rider presence (keeps API gates open) ──
    if (roles.includes('RIDER')) {
      await riderConnected(userId, socket.id!);

      // Re-emit any pending offer if this rider reconnects while an offer is active
      // This handles the case where the rider's PWA was backgrounded and the socket dropped
      const pendingOffer = getPendingOfferForRider(userId);
      if (pendingOffer) {
        logger.info({ userId, orderId: pendingOffer.orderId }, '[Socket] Re-emitting pending offer on reconnect');
        // Fetch the order data again to build the offer payload
        const pendingOrder = await prisma.order.findUnique({
          where: { id: pendingOffer.orderId },
          select: {
            id: true, orderNumber: true, pickupAddress: true, dropoffAddress: true,
            pickupLatitude: true, pickupLongitude: true, dropoffLatitude: true, dropoffLongitude: true,
            distanceKm: true, estimatedDurationMinutes: true, totalPrice: true,
            serviceFee: true, riderEarnings: true, packageType: true,
            packageDescription: true, currency: true, isMultiStop: true,
          },
        });
        if (pendingOrder) {
          const totalPrice = typeof pendingOrder.totalPrice === 'number' ? pendingOrder.totalPrice : Number(pendingOrder.totalPrice);
          const serviceFee = typeof pendingOrder.serviceFee === 'number' ? pendingOrder.serviceFee : Number(pendingOrder.serviceFee);
          const riderEarnings = pendingOrder.riderEarnings != null
            ? (typeof pendingOrder.riderEarnings === 'number' ? pendingOrder.riderEarnings : Number(pendingOrder.riderEarnings))
            : (totalPrice - serviceFee);
          socket.emit('job:offer', {
            orderId: pendingOrder.id,
            orderNumber: pendingOrder.orderNumber,
            pickupAddress: pendingOrder.pickupAddress,
            dropoffAddress: pendingOrder.dropoffAddress,
            pickupLat: pendingOrder.pickupLatitude,
            pickupLng: pendingOrder.pickupLongitude,
            dropoffLat: pendingOrder.dropoffLatitude,
            dropoffLng: pendingOrder.dropoffLongitude,
            distanceKm: pendingOrder.distanceKm,
            estimatedDurationMinutes: pendingOrder.estimatedDurationMinutes,
            totalPrice,
            serviceFee,
            riderEarnings,
            packageType: pendingOrder.packageType,
            packageDescription: pendingOrder.packageDescription ?? undefined,
            currency: pendingOrder.currency,
            distanceToPickup: 0,  // re-emit, distance already calculated
            expiresAt: new Date(Date.now() + 25_000).toISOString(), // give ~25s remaining
            isMultiStop: pendingOrder.isMultiStop ?? false,
          });
        }
      }
    }

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
          // Broadcast to all order rooms this rider is handling
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

          // NOTE: Removed broadcast of all rider locations to all clients
          // (was: io.to('role:CLIENT').emit('rider:location', ...))
          // Only clients tracking a specific order should receive rider locations
        }

        // Record heartbeat — keeps the rider "alive" in the presence system
        recordHeartbeat(userId, { latitude, longitude });

        ack?.({ success: true });
      } catch (err) {
        logger.error({ err, userId }, 'Failed to update rider location');
        ack?.({ success: false });
      }
    });

    // ── Rider heartbeat (lightweight keep-alive, no GPS required) ──
    socket.on('rider:heartbeat' as any, (data: any, ack: any) => {
      recordHeartbeat(userId, data?.latitude && data?.longitude ? data : undefined);
      ack?.({ success: true, serverTime: Date.now() });
    });

    // ── Client heartbeat (lightweight keep-alive for order tracking) ──
    socket.on('client:heartbeat' as any, (_data: any, ack: any) => {
      ack?.({ success: true, serverTime: Date.now() });
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

        // Limit message content size (prevent abuse)
        if (!content || typeof content !== 'string' || content.length > 2000) {
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

    // ── Disconnect — start grace period, do NOT immediately go OFFLINE ──
    socket.on('disconnect', async (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'WebSocket disconnected');

      if (roles.includes('RIDER')) {
        await riderDisconnected(userId, reason);
      }
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
 * Emit a new job notification to riders near the pickup location.
 * Falls back to broadcasting to all riders if no pickup coords provided.
 */
export function emitNewJob(zoneId: string | null, data: {
  orderId: string;
  orderNumber: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  distanceKm: number;
  totalPrice: number;
  packageType: string;
  isMultiStop?: boolean;
  totalStops?: number;
  isScheduled?: boolean;
}) {
  if (!io) return;
  const payload = {
    ...data,
    isMultiStop: data.isMultiStop ?? false,
    totalStops: data.totalStops ?? 2,
    isScheduled: data.isScheduled ?? false,
  };

  // Zone-targeted: only notify riders within 10km of pickup
  const MAX_BROADCAST_RADIUS_KM = 10;

  if (data.pickupLat && data.pickupLng) {
    const onlineRiders = getOnlineRiders();
    let notifiedCount = 0;

    for (const rider of onlineRiders) {
      if (rider.latitude == null || rider.longitude == null) continue;

      // Haversine distance check
      const dist = haversineKm(
        data.pickupLat, data.pickupLng,
        rider.latitude, rider.longitude,
      );

      if (dist <= MAX_BROADCAST_RADIUS_KM) {
        io.to(`user:${rider.userId}`).emit('job:new', payload);
        notifiedCount++;
      }
    }

    logger.info(
      { orderId: data.orderId, zoneId, notifiedCount, totalOnline: onlineRiders.length },
      `[Socket] Broadcast job:new to ${notifiedCount} nearby riders (${MAX_BROADCAST_RADIUS_KM}km radius)`,
    );
  } else {
    // Fallback: no pickup coords — broadcast to all
    io.to('role:RIDER').emit('job:new', payload);
    logger.info({ orderId: data.orderId, zoneId }, '[Socket] Broadcast job:new to ALL riders (no pickup coords)');
  }
}

/**
 * Haversine formula — distance in km between two GPS points.
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
