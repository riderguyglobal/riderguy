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

import { AssetFinancingService } from '../../services/asset-financing.service';
import {
  listAssetFinancingInterestsForAdminHandler,
  requireAssetFinancingAdmin,
  riderRouter,
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

describe('asset-financing admin queue route', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('registers a GET route protected by the admin-only middleware', () => {
    const stack = (riderRouter as unknown as { stack: RouteLayer[] }).stack;
    const layer = stack.find((candidate) => (
      candidate.route?.path === '/asset-financing/interests/admin'
      && candidate.route.methods.get
    ));

    expect(layer).toBeDefined();
    expect(layer?.route?.stack.map((handler) => handler.handle)).toContain(requireAssetFinancingAdmin);

    const next = vi.fn() as NextFunction;
    expect(() => requireAssetFinancingAdmin({
      user: { userId: 'rider-1', role: UserRole.RIDER, sessionId: 'session-rider' },
    } as Request, {} as Response, next)).toThrow(expect.objectContaining({ statusCode: 403 }));
  });

  it('returns the service page without trusting a caller-selected Rider identity', async () => {
    const page = {
      items: [{ id: 'interest-1', updatedAt: new Date('2026-09-01T08:00:00.000Z') }],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    };
    const list = vi.spyOn(AssetFinancingService, 'listForAdmin').mockResolvedValue(page as never);
    const response = responseDouble();
    const query = {
      status: 'SUBMITTED',
      assetType: 'MOTORBIKE',
      search: 'Ama',
      page: 2,
      limit: 20,
    };

    await listAssetFinancingInterestsForAdminHandler({
      user: { userId: 'admin-1', role: UserRole.ADMIN, sessionId: 'session-admin' },
      query,
    } as unknown as Request, response.response);

    expect(list).toHaveBeenCalledWith(query);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      data: page.items,
      pagination: page.pagination,
    });
  });
});
