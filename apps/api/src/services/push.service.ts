// ============================================================
// PushService — Firebase Cloud Messaging (FCM) push notifications
//
// Manages device token registration, deletion, and sending
// push notifications via firebase-admin SDK.
// ============================================================

import { prisma } from '@riderguy/database';
import { config } from '../config';
import { logger } from '../lib/logger';

// --------------- Firebase Admin lazy init ----------------------

let firebaseApp: import('firebase-admin').app.App | null = null;
let messaging: import('firebase-admin').messaging.Messaging | null = null;

async function getMessaging(): Promise<import('firebase-admin').messaging.Messaging | null> {
  if (messaging) return messaging;

  const { projectId, clientEmail, privateKey } = config.firebase;
  if (!projectId || !clientEmail || !privateKey) {
    logger.warn('Firebase config incomplete — push notifications disabled');
    return null;
  }

  try {
    // Dynamic import so firebase-admin is optional
    const admin = await import('firebase-admin');

    if (!firebaseApp) {
      firebaseApp = admin.apps.length
        ? admin.apps[0]!
        : admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
    }

    messaging = admin.messaging(firebaseApp);
    logger.info('Firebase Admin initialised for push notifications');
    return messaging;
  } catch (err) {
    logger.error({ err }, 'Failed to initialise firebase-admin');
    return null;
  }
}

// --------------- Token management -----------------------------

export class PushService {
  /**
   * Register or refresh a push token for a user.
   * Upserts to avoid duplicates.
   */
  static async registerToken(
    userId: string,
    token: string,
    platform: 'web' | 'android' | 'ios' = 'web',
    deviceId?: string,
  ) {
    return prisma.pushToken.upsert({
      where: {
        userId_token: { userId, token },
      },
      update: {
        isActive: true,
        platform,
        deviceId,
        updatedAt: new Date(),
      },
      create: {
        userId,
        token,
        platform,
        deviceId,
      },
    });
  }

  /**
   * Deactivate a push token (e.g. on logout).
   */
  static async removeToken(userId: string, token: string) {
    return prisma.pushToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
  }

  /**
   * Remove all tokens for a user (e.g. account deletion).
   */
  static async removeAllTokens(userId: string) {
    return prisma.pushToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  /**
   * Get all active tokens for a user.
   */
  static async getActiveTokens(userId: string): Promise<string[]> {
    const tokens = await prisma.pushToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });
    return tokens.map((t) => t.token);
  }

  // --------------- Sending push ---------------------------------

  /**
   * Send a push notification to a specific user.
   * Automatically handles stale token cleanup.
   */
  static async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    const fcm = await getMessaging();
    if (!fcm) return { successCount: 0, failureCount: 0 };

    const tokens = await PushService.getActiveTokens(userId);
    if (tokens.length === 0) return { successCount: 0, failureCount: 0 };

    try {
      const response = await fcm.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data ?? {},
        webpush: {
          fcmOptions: {
            link: '/',
          },
          notification: {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
          },
        },
      });

      // Clean up stale tokens
      if (response.failureCount > 0) {
        const staleTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const code = resp.error?.code;
            if (
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token'
            ) {
              const t = tokens[idx];
              if (t) staleTokens.push(t);
            }
          }
        });

        if (staleTokens.length > 0) {
          await prisma.pushToken.updateMany({
            where: { userId, token: { in: staleTokens } },
            data: { isActive: false },
          });
          logger.info(
            { userId, staleCount: staleTokens.length },
            'Deactivated stale FCM tokens',
          );
        }
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (err) {
      logger.error({ err, userId }, 'Failed to send push notification');
      return { successCount: 0, failureCount: 0 };
    }
  }

  /**
   * Send a push notification to multiple users at once.
   */
  static async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await Promise.allSettled(
      userIds.map((uid) => PushService.sendToUser(uid, title, body, data)),
    );
  }
}
