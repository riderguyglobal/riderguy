import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@riderguy/types';
import { adminMentorshipListSchema, adminMentorshipStatusSchema } from '@riderguy/validators';

vi.mock('../../config', () => ({
  config: {
    isProduction: false,
    jwt: { accessSecret: 'test-access-secret', refreshSecret: 'test-refresh-secret' },
    redis: { url: '' },
    firebase: {
      rider: { projectId: '', clientEmail: '', privateKey: '' },
      client: { projectId: '', clientEmail: '', privateKey: '' },
    },
  },
}));

vi.mock('../../services/rider-experience-admin.service', () => ({
  RiderExperienceAdminService: {
    getSummary: vi.fn(),
    listMentorships: vi.fn(),
    updateMentorship: vi.fn(),
  },
}));

import { RiderExperienceAdminService } from '../../services/rider-experience-admin.service';
import {
  listMentorshipsAdminHandler,
  requireRiderExperienceAdmin,
  riderExperienceAdminRouter,
  riderExperienceSummaryHandler,
  updateMentorshipAdminHandler,
} from './rider-experience.routes';

type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };

function responseDouble() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { json, status, response: { status } as unknown as Response };
}

describe('Rider experience admin routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers the cross-app summary and mentorship controls', () => {
    const stack = (riderExperienceAdminRouter as unknown as { stack: RouteLayer[] }).stack;
    expect(stack.some((layer) => layer.route?.path === '/summary' && layer.route.methods.get)).toBe(
      true,
    );
    expect(
      stack.some((layer) => layer.route?.path === '/mentorships' && layer.route.methods.get),
    ).toBe(true);
    expect(
      stack.some(
        (layer) => layer.route?.path === '/mentorships/:id/status' && layer.route.methods.patch,
      ),
    ).toBe(true);
  });

  it('rejects a Rider at the administrator authorization boundary', () => {
    expect(() =>
      requireRiderExperienceAdmin(
        {
          user: { userId: 'rider-1', role: UserRole.RIDER, sessionId: 'session-rider' },
        } as Request,
        {} as Response,
        vi.fn() as NextFunction,
      ),
    ).toThrow(expect.objectContaining({ statusCode: 403 }));
  });

  it('returns the operational summary and validated mentorship page', async () => {
    const summary = { community: { pendingReports: 2 } };
    vi.mocked(RiderExperienceAdminService.getSummary).mockResolvedValue(summary as never);
    const summaryResponse = responseDouble();
    await riderExperienceSummaryHandler({} as Request, summaryResponse.response);
    expect(summaryResponse.json).toHaveBeenCalledWith({ success: true, data: summary });

    const page = {
      items: [{ id: 'mentorship-1', status: 'PENDING' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    vi.mocked(RiderExperienceAdminService.listMentorships).mockResolvedValue(page as never);
    const query = { status: 'PENDING', page: 1, limit: 20 };
    const listResponse = responseDouble();
    await listMentorshipsAdminHandler({ query } as unknown as Request, listResponse.response);
    expect(RiderExperienceAdminService.listMentorships).toHaveBeenCalledWith(query);
    expect(listResponse.json).toHaveBeenCalledWith({
      success: true,
      data: page.items,
      pagination: page.pagination,
    });
  });

  it('passes actor context into audited mentorship decisions', async () => {
    vi.mocked(RiderExperienceAdminService.updateMentorship).mockResolvedValue({
      id: 'mentorship-1',
      status: 'CANCELLED',
    } as never);
    const response = responseDouble();
    const request = {
      params: { id: 'mentorship-1' },
      body: { status: 'CANCELLED', note: 'Pairing requires administrator intervention.' },
      user: { userId: 'admin-1', role: UserRole.ADMIN, sessionId: 'session-admin' },
      ip: '127.0.0.1',
      socket: {},
      get: vi.fn().mockReturnValue('test-agent'),
    } as unknown as Request;

    await updateMentorshipAdminHandler(request, response.response);
    expect(RiderExperienceAdminService.updateMentorship).toHaveBeenCalledWith(
      'mentorship-1',
      request.body,
      expect.objectContaining({ actorUserId: 'admin-1', ipAddress: '127.0.0.1' }),
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });
});

describe('Rider experience admin validation', () => {
  it('bounds list input and requires a meaningful decision note', () => {
    expect(adminMentorshipListSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(() => adminMentorshipListSchema.parse({ limit: 101 })).toThrow();
    expect(() => adminMentorshipListSchema.parse({ unknown: true })).toThrow();
    expect(() => adminMentorshipStatusSchema.parse({ status: 'CANCELLED', note: 'no' })).toThrow();
    expect(
      adminMentorshipStatusSchema.parse({
        status: 'CANCELLED',
        note: 'Pairing requires administrator intervention.',
      }),
    ).toEqual({ status: 'CANCELLED', note: 'Pairing requires administrator intervention.' });
  });
});
