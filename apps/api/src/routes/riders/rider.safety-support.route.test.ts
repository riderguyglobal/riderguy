import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@riderguy/types';

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  createSubmission: vi.fn(),
  sendContactAck: vi.fn().mockResolvedValue(undefined),
  sendContactNotification: vi.fn().mockResolvedValue(undefined),
  loggerInfo: vi.fn(),
}));

vi.mock('../../config', () => ({
  config: {
    isProduction: false,
    jwt: { accessSecret: 'test-access-secret', refreshSecret: 'test-refresh-secret' },
    redis: { url: '' },
    s3: { endpoint: '', region: 'auto', accessKeyId: '', secretAccessKey: '', bucketName: 'test' },
    firebase: {
      rider: { projectId: '', clientEmail: '', privateKey: '' },
      client: { projectId: '', clientEmail: '', privateKey: '' },
    },
  },
}));

vi.mock('@riderguy/database', () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    contactSubmission: { create: mocks.createSubmission },
  },
}));

vi.mock('../../services/email.service', () => ({
  EmailService: {
    sendContactAck: mocks.sendContactAck,
    sendContactNotification: mocks.sendContactNotification,
  },
}));

vi.mock('../../services/push.service', () => ({
  PushService: { sendToUser: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/storage.service', () => ({ StorageService: {} }));

vi.mock('../../lib/logger', () => ({
  logger: { info: mocks.loggerInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { authenticate, sensitiveUserRateLimit } from '../../middleware';
import {
  requireRiderSafetySupport,
  riderRouter,
  riderSafetySupportSchema,
  submitRiderSafetySupportHandler,
  validateRiderSafetySupport,
} from './rider.routes';

type RouteLayer = {
  handle?: unknown;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

function responseDouble() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { json, response: { status } as unknown as Response, status };
}

describe('Rider safety-support intake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendContactAck.mockResolvedValue(undefined);
    mocks.sendContactNotification.mockResolvedValue(undefined);
  });

  it('registers behind router authentication, Rider authorization, validation, and the user limiter', () => {
    const stack = (riderRouter as unknown as { stack: RouteLayer[] }).stack;
    const authIndex = stack.findIndex((layer) => layer.handle === authenticate);
    const routeIndex = stack.findIndex(
      (layer) => layer.route?.path === '/safety-support' && layer.route.methods.post,
    );
    const route = stack[routeIndex]?.route;

    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(routeIndex).toBeGreaterThan(authIndex);
    expect(route?.stack.map((handler) => handler.handle)).toContain(sensitiveUserRateLimit);
    expect(route?.stack.map((handler) => handler.handle)).toContain(requireRiderSafetySupport);
    expect(route?.stack.map((handler) => handler.handle)).toContain(validateRiderSafetySupport);
  });

  it('allows Rider membership and rejects an authenticated non-Rider', () => {
    const next = vi.fn() as NextFunction;
    const response = {} as Response;

    expect(() =>
      requireRiderSafetySupport(
        {
          user: { userId: 'client-1', role: UserRole.CLIENT, sessionId: 'session-client' },
        } as Request,
        response,
        next,
      ),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
    expect(next).not.toHaveBeenCalled();

    requireRiderSafetySupport(
      {
        user: {
          userId: 'rider-1',
          role: UserRole.CLIENT,
          roles: [UserRole.CLIENT, UserRole.RIDER],
          sessionId: 'session-rider',
        },
      } as Request,
      response,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('normalizes valid input and rejects unsupported or underspecified reports', () => {
    expect(
      riderSafetySupportSchema.parse({
        category: 'Road incident',
        followUpEmail: '  rider@example.com ',
        details: '  A vehicle forced me off the road.  ',
      }),
    ).toEqual({
      category: 'Road incident',
      followUpEmail: 'rider@example.com',
      details: 'A vehicle forced me off the road.',
    });

    expect(() =>
      riderSafetySupportSchema.parse({
        category: 'Emergency dispatch',
        followUpEmail: 'rider@example.com',
        details: 'Please send somebody immediately.',
      }),
    ).toThrow();
    expect(() =>
      riderSafetySupportSchema.parse({
        category: 'Vehicle safety',
        followUpEmail: 'not-an-email',
        details: 'too short',
      }),
    ).toThrow();
  });

  it('derives Rider identity from the token and persists an auditable support message', async () => {
    mocks.findUser.mockResolvedValue({
      id: 'authenticated-rider-user',
      firstName: 'Ama',
      lastName: 'Mensah',
      phone: '0241234567',
      riderProfile: { id: 'rider-profile-42' },
    });
    mocks.createSubmission.mockResolvedValue({ id: 'support-1' });
    const response = responseDouble();

    await submitRiderSafetySupportHandler(
      {
        user: {
          userId: 'authenticated-rider-user',
          role: UserRole.RIDER,
          sessionId: 'session-1',
        },
        body: {
          category: 'Threat or harassment',
          followUpEmail: 'ama@example.com',
          details: 'A customer sent threatening messages after delivery.',
          userId: 'attacker-selected-user',
        },
      } as unknown as Request,
      response.response,
    );

    expect(mocks.findUser).toHaveBeenCalledWith({
      where: { id: 'authenticated-rider-user' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        riderProfile: { select: { id: true } },
      },
    });
    expect(mocks.createSubmission).toHaveBeenCalledWith({
      data: {
        firstName: 'Ama',
        lastName: 'Mensah',
        email: 'ama@example.com',
        subject: 'support',
        message: expect.stringContaining('Rider user ID: authenticated-rider-user'),
      },
    });
    const persistedMessage = mocks.createSubmission.mock.calls[0]?.[0].data.message as string;
    expect(persistedMessage).toContain('Rider profile ID: rider-profile-42');
    expect(persistedMessage).toContain('Category: Threat or harassment');
    expect(persistedMessage).toContain('Details: A customer sent threatening messages');
    expect(persistedMessage).not.toContain('attacker-selected-user');
    expect(mocks.sendContactAck).toHaveBeenCalledWith('ama@example.com', 'Ama', 'support');
    expect(mocks.sendContactNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Ama',
        lastName: 'Mensah',
        email: 'ama@example.com',
        subject: 'support',
        message: persistedMessage,
      }),
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: {
        id: 'support-1',
        message: 'Your non-emergency support message was received.',
      },
    });
  });

  it('fails closed when the authenticated account has no Rider profile', async () => {
    mocks.findUser.mockResolvedValue({
      id: 'rider-user-without-profile',
      firstName: 'Kojo',
      lastName: 'Asare',
      phone: '0200000000',
      riderProfile: null,
    });

    await expect(
      submitRiderSafetySupportHandler(
        {
          user: {
            userId: 'rider-user-without-profile',
            role: UserRole.RIDER,
            sessionId: 'session-2',
          },
          body: {
            category: 'Vehicle safety',
            followUpEmail: 'kojo@example.com',
            details: 'My rear brake has started slipping badly.',
          },
        } as unknown as Request,
        {} as Response,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mocks.createSubmission).not.toHaveBeenCalled();
    expect(mocks.sendContactAck).not.toHaveBeenCalled();
    expect(mocks.sendContactNotification).not.toHaveBeenCalled();
  });
});
