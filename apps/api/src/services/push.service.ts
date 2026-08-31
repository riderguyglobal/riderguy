// ============================================================
// PushService — direct Firebase Cloud Messaging notifications
// ============================================================

import { prisma } from '@riderguy/database';
import type { App } from 'firebase-admin/app';
import type { Messaging } from 'firebase-admin/messaging';
import { config } from '../config';
import { logger } from '../lib/logger';

export type PushAppProject = 'RIDER' | 'CLIENT';
type PushPlatform = 'web' | 'android' | 'ios';

// A registration token is issued by exactly one Firebase project. Keep a
// separately named Admin app and messaging client for each native app.
const firebaseApps = new Map<PushAppProject, App>();
const messagingClients = new Map<PushAppProject, Messaging>();
const disabledProjects = new Set<PushAppProject>();

function isValidPrivateKey(key: string): boolean {
  return (
    typeof key === 'string'
    && key.includes('-----BEGIN PRIVATE KEY-----')
    && key.includes('-----END PRIVATE KEY-----')
  );
}

async function getFirebaseMessaging(appProject: PushAppProject): Promise<Messaging | null> {
  const cached = messagingClients.get(appProject);
  if (cached) return cached;
  if (disabledProjects.has(appProject)) return null;

  const credentials = appProject === 'RIDER' ? config.firebase.rider : config.firebase.client;
  const { projectId, clientEmail, privateKey } = credentials;

  if (!projectId || !clientEmail || !privateKey) {
    disabledProjects.add(appProject);
    logger.warn(
      {
        appProject,
        hasProjectId: Boolean(projectId),
        hasClientEmail: Boolean(clientEmail),
        hasPrivateKey: Boolean(privateKey),
      },
      'Firebase config incomplete — push notifications disabled for app project',
    );
    return null;
  }

  if (!isValidPrivateKey(privateKey)) {
    disabledProjects.add(appProject);
    logger.warn(
      { appProject, hasBegin: privateKey.includes('-----BEGIN'), keyLength: privateKey.length },
      'Firebase private key is not a valid PEM — push notifications disabled for app project',
    );
    return null;
  }

  try {
    const [{ cert, getApps, initializeApp }, { getMessaging }] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/messaging'),
    ]);

    const appName = `riderguy-push-${appProject.toLowerCase()}`;
    const existingApp = getApps().find((app) => app.name === appName);
    const firebaseApp = existingApp ?? initializeApp(
      {
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      },
      appName,
    );

    const projectMessaging = getMessaging(firebaseApp);
    firebaseApps.set(appProject, firebaseApp);
    messagingClients.set(appProject, projectMessaging);
    logger.info({ appProject, projectId }, 'Firebase Admin initialised for push notifications');
    return projectMessaging;
  } catch (err) {
    disabledProjects.add(appProject);
    logger.error(
      { err, appProject },
      'Failed to initialise firebase-admin — push notifications disabled for app project',
    );
    return null;
  }
}

export class PushService {
  /**
   * Register or refresh a token. The globally unique token is the upsert key,
   * so registration atomically transfers ownership to the current account.
   */
  static async registerToken(
    userId: string,
    token: string,
    platform: PushPlatform,
    appProject: PushAppProject,
    sessionId: string,
  ) {
    return prisma.pushToken.upsert({
      where: { token },
      update: {
        userId,
        isActive: true,
        platform,
        appProject,
        deviceId: sessionId,
        updatedAt: new Date(),
      },
      create: {
        userId,
        token,
        platform,
        appProject,
        deviceId: sessionId,
      },
    });
  }

  static async removeToken(userId: string, token: string) {
    return prisma.pushToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
  }

  static async removeAllTokens(userId: string) {
    return prisma.pushToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  static async removeSessionTokens(userId: string, sessionId: string) {
    return prisma.pushToken.updateMany({
      where: { userId, deviceId: sessionId },
      data: { isActive: false },
    });
  }

  static async removeSessionTokensExcept(userId: string, sessionId?: string) {
    return prisma.pushToken.updateMany({
      where: {
        userId,
        ...(sessionId ? { deviceId: { not: sessionId } } : {}),
      },
      data: { isActive: false },
    });
  }

  static async getActiveTokens(userId: string): Promise<string[]> {
    const tokens = await prisma.pushToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });
    return tokens.map((record) => record.token);
  }

  /** Send through the Firebase project that issued each token. */
  static async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    const storedTokenRecords = await prisma.pushToken.findMany({
      where: { userId, isActive: true },
      select: { token: true, appProject: true, deviceId: true },
    });
    if (storedTokenRecords.length === 0) return { successCount: 0, failureCount: 0 };

    // A token is usable only while the session/device that registered it is
    // still live. This closes cleanup gaps caused by expired sessions, password
    // resets, force-sign-outs, offline logout, or a crashed client.
    const sessionIds = [
      ...new Set(
        storedTokenRecords
          .map((record) => record.deviceId)
          .filter((sessionId): sessionId is string => Boolean(sessionId)),
      ),
    ];
    const liveSessions = sessionIds.length > 0
      ? await prisma.session.findMany({
          where: { id: { in: sessionIds }, userId, expiresAt: { gt: new Date() } },
          select: { id: true },
        })
      : [];
    const liveSessionIds = new Set(liveSessions.map((session) => session.id));
    const expiredTokens = storedTokenRecords
      .filter((record) => !record.deviceId || !liveSessionIds.has(record.deviceId))
      .map((record) => record.token);
    if (expiredTokens.length > 0) {
      await prisma.pushToken.updateMany({
        where: { userId, token: { in: expiredTokens } },
        data: { isActive: false },
      });
      logger.info(
        { userId, staleSessionTokenCount: expiredTokens.length },
        'Deactivated push tokens whose authenticated session is no longer active',
      );
    }
    const tokenRecords = storedTokenRecords.filter(
      (record) => record.deviceId && liveSessionIds.has(record.deviceId),
    );
    if (tokenRecords.length === 0) return { successCount: 0, failureCount: 0 };

    let successCount = 0;
    let failureCount = 0;
    const staleTokens: string[] = [];

    const unroutableCount = tokenRecords.filter((record) => !record.appProject).length;
    if (unroutableCount > 0) {
      failureCount += unroutableCount;
      logger.warn(
        { userId, unroutableCount },
        'Active push tokens without an app project were not sent',
      );
    }

    for (const appProject of ['RIDER', 'CLIENT'] as const) {
      const tokens = tokenRecords
        .filter((record) => record.appProject === appProject)
        .map((record) => record.token);
      if (tokens.length === 0) continue;

      const fcm = await getFirebaseMessaging(appProject);
      if (!fcm) {
        failureCount += tokens.length;
        continue;
      }

      try {
        const response = await fcm.sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: data ?? {},
          android: {
            priority: 'high',
            notification: {
              channelId: data?.channelId ?? 'default',
              sound: 'default',
              defaultVibrateTimings: true,
            },
          },
        });

        successCount += response.successCount;
        failureCount += response.failureCount;
        if (response.failureCount > 0) {
          const failureCodes = [
            ...new Set(
              response.responses
                .map((responseItem) => responseItem.error?.code)
                .filter((code): code is string => Boolean(code)),
            ),
          ];
          logger.warn(
            { userId, appProject, failureCount: response.failureCount, failureCodes },
            'FCM rejected one or more push notifications',
          );
        }
        response.responses.forEach((responseItem, index) => {
          if (responseItem.success) return;
          const code = responseItem.error?.code;
          if (
            code === 'messaging/registration-token-not-registered'
            || code === 'messaging/invalid-registration-token'
          ) {
            const staleToken = tokens[index];
            if (staleToken) staleTokens.push(staleToken);
          }
        });
      } catch (err) {
        failureCount += tokens.length;
        logger.error({ err, userId, appProject }, 'Failed to send push notification');
      }
    }

    if (staleTokens.length > 0) {
      await prisma.pushToken.updateMany({
        where: { userId, token: { in: staleTokens } },
        data: { isActive: false },
      });
      logger.info({ userId, staleCount: staleTokens.length }, 'Deactivated stale FCM tokens');
    }

    return { successCount, failureCount };
  }

  static async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await Promise.allSettled(
      userIds.map((userId) => PushService.sendToUser(userId, title, body, data)),
    );
  }
}
