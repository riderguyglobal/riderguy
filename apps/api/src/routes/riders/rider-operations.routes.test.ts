import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@riderguy/types';
import {
  listRiderOperationsCasesQuerySchema,
  reviewDocumentSchema,
  reviewTrainingModuleSchema,
  revokeInHouseInvitationSchema,
} from '@riderguy/validators';

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

vi.mock('../../services/push.service', () => ({ PushService: { sendToUser: vi.fn() } }));
vi.mock('../../services/storage.service', () => ({ StorageService: {} }));

import { describeRiderReadiness, RiderOperationsService } from '../../services/rider-operations.service';
import {
  listRiderOperationsCasesHandler,
  requireRiderOperationsAdmin,
  riderOperationsRouter,
  riderOperationsSummaryHandler,
} from './rider-operations.routes';

type RouteLayer = {
  route?: { path: string; methods: Record<string, boolean> };
};

function responseDouble() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { json, status, response: { status } as unknown as Response };
}

describe('Rider Operations routes', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('registers the summary, case queue, case detail, history, and invitation controls', () => {
    const stack = (riderOperationsRouter as unknown as { stack: RouteLayer[] }).stack;
    expect(stack.some((layer) => layer.route?.path === '/summary' && layer.route.methods.get)).toBe(true);
    expect(stack.some((layer) => layer.route?.path === '/cases' && layer.route.methods.get)).toBe(true);
    expect(stack.some((layer) => layer.route?.path === '/cases/:riderId' && layer.route.methods.get)).toBe(true);
    expect(stack.some((layer) => layer.route?.path === '/cases/:riderId/history' && layer.route.methods.get)).toBe(true);
    expect(stack.some((layer) => layer.route?.path === '/invitations/:invitationId/revoke' && layer.route.methods.patch)).toBe(true);
  });

  it('rejects Rider tokens at the shared operations authorization boundary', () => {
    const next = vi.fn() as NextFunction;
    expect(() => requireRiderOperationsAdmin({
      user: { userId: 'rider-1', role: UserRole.RIDER, sessionId: 'session-rider' },
    } as Request, {} as Response, next)).toThrow(expect.objectContaining({ statusCode: 403 }));
  });

  it('returns the operations summary and passes only validated queue filters', async () => {
    const summary = { pendingCases: 4, readyForActivation: 1 };
    vi.spyOn(RiderOperationsService, 'getSummary').mockResolvedValue(summary as never);
    const summaryResponse = responseDouble();
    await riderOperationsSummaryHandler({} as Request, summaryResponse.response);
    expect(summaryResponse.status).toHaveBeenCalledWith(200);
    expect(summaryResponse.json).toHaveBeenCalledWith({ success: true, data: summary });

    const page = {
      items: [{ id: 'case-1', nextAction: 'Review documents' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    const list = vi.spyOn(RiderOperationsService, 'listCases').mockResolvedValue(page as never);
    const query = { queue: 'ACTION_REQUIRED', channel: 'IN_HOUSE', page: 1, limit: 20 };
    const listResponse = responseDouble();
    await listRiderOperationsCasesHandler({ query } as unknown as Request, listResponse.response);
    expect(list).toHaveBeenCalledWith(query);
    expect(listResponse.json).toHaveBeenCalledWith({ success: true, data: page.items, pagination: page.pagination });
  });
});

describe('Rider Operations validation', () => {
  it('normalizes safe defaults and rejects unbounded or unknown queue input', () => {
    expect(listRiderOperationsCasesQuerySchema.parse({})).toEqual({ queue: 'PENDING', page: 1, limit: 20 });
    expect(() => listRiderOperationsCasesQuerySchema.parse({ queue: 'DELETE_EVERYTHING' })).toThrow();
    expect(() => listRiderOperationsCasesQuerySchema.parse({ limit: 101 })).toThrow();
    expect(() => listRiderOperationsCasesQuerySchema.parse({ unknown: 'field' })).toThrow();
  });

  it('requires reasons for destructive invitation and training actions', () => {
    expect(() => revokeInHouseInvitationSchema.parse({ reason: 'no' })).toThrow();
    expect(revokeInHouseInvitationSchema.parse({ reason: 'Wrong recipient' })).toEqual({ reason: 'Wrong recipient' });
    expect(() => reviewTrainingModuleSchema.parse({ decision: 'REVOKED' })).toThrow();
    expect(reviewTrainingModuleSchema.parse({ decision: 'VERIFIED' })).toEqual({ decision: 'VERIFIED' });
    expect(() => reviewDocumentSchema.parse({ status: 'REJECTED' })).toThrow();
    expect(() => reviewDocumentSchema.parse({ status: 'APPROVED', rejectionReason: 'Not relevant' })).toThrow();
  });
});

describe('Rider activation controls', () => {
  const requiredDocuments = [
    { id: 'doc-id', type: 'NATIONAL_ID', status: 'APPROVED', createdAt: new Date() },
    { id: 'doc-license', type: 'DRIVERS_LICENSE', status: 'APPROVED', createdAt: new Date() },
    { id: 'doc-selfie', type: 'SELFIE', status: 'APPROVED', createdAt: new Date() },
  ];
  const approvedVehicle = {
    reviewStatus: 'APPROVED',
    photoFrontUrl: '/front.jpg',
    photoBackUrl: '/back.jpg',
    photoLeftUrl: '/left.jpg',
    photoRightUrl: '/right.jpg',
  };

  it('accepts a Guest Rider only after identity documents and vehicle evidence pass', () => {
    expect(describeRiderReadiness({
      riderChannel: 'GUEST',
      user: { documents: requiredDocuments },
      vehicles: [approvedVehicle],
      trainingCompletions: [],
    } as never)).toEqual({ ready: true, missing: [] });
  });

  it('keeps an In-House Rider blocked until every completed module is admin-verified', () => {
    const result = describeRiderReadiness({
      riderChannel: 'IN_HOUSE',
      user: { documents: requiredDocuments },
      vehicles: [approvedVehicle],
      trainingCompletions: [
        { moduleKey: 'SAFETY_BASICS', verifiedAt: new Date() },
        { moduleKey: 'SERVICE_STANDARDS', verifiedAt: new Date() },
        { moduleKey: 'DELIVERY_OPERATIONS', verifiedAt: null },
      ],
    } as never);
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('DELIVERY OPERATIONS is not admin-verified');
  });
});
