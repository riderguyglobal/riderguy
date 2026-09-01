import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@riderguy/types';

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

vi.mock('../../services/push.service', () => ({
  PushService: { sendToUser: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../services/storage.service', () => ({ StorageService: {} }));

import { sensitiveRateLimit, sensitiveUserRateLimit } from '../../middleware';
import { AssetFinancingService } from '../../services/asset-financing.service';
import {
  getCurrentAssetFinancingInterestHandler,
  registerAssetFinancingInterestHandler,
  requireAssetFinancingAdmin,
  riderRouter,
  updateAssetFinancingInterestStatusHandler,
} from './rider.routes';

type RouteLayer = {
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

describe('asset-financing Rider routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers GET and POST for the current Rider with only the user write limiter', () => {
    const stack = (riderRouter as unknown as { stack: RouteLayer[] }).stack;
    const getRoute = stack.find((layer) => (
      layer.route?.path === '/asset-financing/interests' && layer.route.methods.get
    ));
    const postRoute = stack.find((layer) => (
      layer.route?.path === '/asset-financing/interests' && layer.route.methods.post
    ));

    expect(getRoute).toBeDefined();
    expect(postRoute).toBeDefined();
    expect(getRoute?.route?.stack.map((handler) => handler.handle)).not.toContain(sensitiveUserRateLimit);
    expect(getRoute?.route?.stack.map((handler) => handler.handle)).not.toContain(sensitiveRateLimit);
    expect(postRoute?.route?.stack.map((handler) => handler.handle)).toContain(sensitiveUserRateLimit);
    expect(postRoute?.route?.stack.map((handler) => handler.handle)).not.toContain(sensitiveRateLimit);
  });

  it('binds GET and POST ownership to the authenticated token user', async () => {
    const currentState = { interest: null, verifiedContactEmail: 'rider@example.com' };
    const getCurrent = vi.spyOn(AssetFinancingService, 'getCurrentState').mockResolvedValue(currentState as never);
    const register = vi.spyOn(AssetFinancingService, 'registerInterest').mockResolvedValue({
      interest: { id: 'interest-1', status: 'SUBMITTED' },
      outcome: 'CREATED',
    } as never);

    const getResponse = responseDouble();
    await getCurrentAssetFinancingInterestHandler({
      user: { userId: 'token-rider', role: UserRole.RIDER, sessionId: 'session-1' },
    } as Request, getResponse.response);
    expect(getCurrent).toHaveBeenCalledWith('token-rider');
    expect(getResponse.status).toHaveBeenCalledWith(200);

    const postResponse = responseDouble();
    await registerAssetFinancingInterestHandler({
      user: { userId: 'token-rider', role: UserRole.RIDER, sessionId: 'session-1' },
      body: {
        assetType: 'MOTORBIKE',
        notes: 'Accra routes',
        userId: 'attacker-selected-rider',
        contactEmail: 'unverified@example.com',
      },
    } as Request, postResponse.response);

    expect(register).toHaveBeenCalledWith('token-rider', {
      assetType: 'MOTORBIKE',
      notes: 'Accra routes',
    });
    expect(postResponse.status).toHaveBeenCalledWith(201);
    expect(postResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ outcome: 'CREATED' }),
    }));
  });

  it('guards status management with admin membership and records that reviewer', async () => {
    const next = vi.fn() as NextFunction;
    expect(() => requireAssetFinancingAdmin({
      user: { userId: 'rider-1', role: UserRole.RIDER, sessionId: 'session-1' },
    } as Request, {} as Response, next)).toThrow(expect.objectContaining({ statusCode: 403 }));

    const update = vi.spyOn(AssetFinancingService, 'updateStatus').mockResolvedValue({
      id: 'interest-1', status: 'UNDER_REVIEW',
    } as never);
    const result = responseDouble();
    await updateAssetFinancingInterestStatusHandler({
      params: { interestId: 'interest-1' },
      user: { userId: 'admin-1', role: UserRole.ADMIN, sessionId: 'session-admin' },
      body: {
        status: 'UNDER_REVIEW',
        expectedUpdatedAt: '2026-09-01T08:00:00.000Z',
      },
    } as unknown as Request, result.response);

    expect(update).toHaveBeenCalledWith('interest-1', 'admin-1', {
      status: 'UNDER_REVIEW',
      expectedUpdatedAt: '2026-09-01T08:00:00.000Z',
    });
    expect(result.status).toHaveBeenCalledWith(200);
  });
});
