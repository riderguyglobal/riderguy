import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@riderguy/types';

vi.mock('../../config', () => ({
  config: {
    jwt: { accessSecret: 'test-access-secret', refreshSecret: 'test-refresh-secret' },
    redis: { url: '' },
    s3: {
      endpoint: '',
      region: 'auto',
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: 'test',
    },
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

import { NotificationService } from '../../services/notification.service';
import { VehicleService } from '../../services/vehicle.service';
import { logger } from '../../lib/logger';
import {
  requireVehicleReviewAdmin,
  reviewVehicleHandler,
  lockRiderVehicleStateForUser,
  riderRouter,
} from './rider.routes';

describe('admin vehicle-review route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a PATCH route guarded by the exported admin-only middleware', () => {
    const stack = (riderRouter as unknown as {
      stack: Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: Array<{ handle: unknown }>;
        };
      }>;
    }).stack;
    const layer = stack.find((candidate) => (
      candidate.route?.path === '/:riderId/vehicles/:vehicleId/review'
      && candidate.route.methods.patch
    ));

    expect(layer).toBeDefined();
    expect(layer?.route?.stack.map((handler) => handler.handle))
      .toContain(requireVehicleReviewAdmin);
  });

  it('rejects a Rider token and accepts admin membership, including a secondary admin role', () => {
    const response = {} as Response;
    const next = vi.fn() as NextFunction;

    expect(() => requireVehicleReviewAdmin({
      user: { userId: 'rider-user', role: UserRole.RIDER, sessionId: 'session-1' },
    } as Request, response, next)).toThrow(expect.objectContaining({ statusCode: 403 }));
    expect(next).not.toHaveBeenCalled();

    requireVehicleReviewAdmin({
      user: {
        userId: 'admin-user',
        role: UserRole.RIDER,
        roles: [UserRole.RIDER, UserRole.ADMIN],
        sessionId: 'session-2',
      },
    } as Request, response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes the target Rider and reviewed vehicle to the service and notifies that Rider', async () => {
    const reviewedVehicle = { id: 'vehicle-1', isApproved: false };
    const review = vi.spyOn(VehicleService, 'review').mockResolvedValue(reviewedVehicle as never);
    const notify = vi.spyOn(NotificationService, 'create').mockResolvedValue({ id: 'notification-1' } as never);
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });

    await reviewVehicleHandler({
      params: { riderId: 'rider-user-1', vehicleId: 'vehicle-1' },
      body: { status: 'REJECTED', rejectionReason: 'Registration photo is unreadable' },
      user: { userId: 'admin-user-1', role: UserRole.ADMIN, sessionId: 'session-1' },
    } as unknown as Request, { status } as unknown as Response);

    expect(review).toHaveBeenCalledWith({
      vehicleId: 'vehicle-1',
      riderUserId: 'rider-user-1',
      reviewerUserId: 'admin-user-1',
      status: 'REJECTED',
      rejectionReason: 'Registration photo is unreadable',
    });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'rider-user-1',
      title: 'Vehicle Not Approved',
      type: 'SYSTEM',
      data: expect.objectContaining({ vehicleId: 'vehicle-1', status: 'REJECTED' }),
    }));
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true, data: reviewedVehicle });
  });

  it('returns the persisted decision when notification creation fails', async () => {
    const reviewedVehicle = { id: 'vehicle-1', isApproved: true };
    vi.spyOn(VehicleService, 'review').mockResolvedValue(reviewedVehicle as never);
    vi.spyOn(NotificationService, 'create').mockRejectedValue(new Error('notification database unavailable'));
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });

    await reviewVehicleHandler({
      params: { riderId: 'rider-user-1', vehicleId: 'vehicle-1' },
      body: { status: 'APPROVED' },
      user: { userId: 'admin-user-1', role: UserRole.ADMIN, sessionId: 'session-1' },
    } as unknown as Request, { status } as unknown as Response);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        riderUserId: 'rider-user-1',
        vehicleId: 'vehicle-1',
        status: 'APPROVED',
      }),
      'Vehicle review notification failed after the decision was persisted',
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true, data: reviewedVehicle });
  });

  it('locks vehicle state with RiderProfile.id rather than the route User.id', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 'rider-profile-42' });
    const executeRaw = vi.fn().mockResolvedValue(1);

    await expect(lockRiderVehicleStateForUser({
      riderProfile: { findUnique },
      $executeRaw: executeRaw,
    } as never, 'rider-user-42')).resolves.toBe('rider-profile-42');

    expect(findUnique).toHaveBeenCalledWith({
      where: { userId: 'rider-user-42' },
      select: { id: true },
    });
    expect(executeRaw).toHaveBeenCalledOnce();
    expect(executeRaw.mock.calls[0]?.[1]).toBe(
      'riderguy:rider-vehicle-state:rider-profile-42',
    );
  });
});
