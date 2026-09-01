import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.REDIS_URL = '';
});

vi.mock('../config', () => ({
  config: {
    isProduction: false,
    redis: { url: '' },
  },
}));

import { sensitiveUserRateLimit } from './rate-limit';

async function consume(userId?: string, ip = '203.0.113.1') {
  const next = vi.fn() as NextFunction;
  const response = { setHeader: vi.fn() } as unknown as Response;
  const request = {
    ip,
    socket: { remoteAddress: ip },
    headers: {},
    ...(userId
      ? { user: { userId, role: 'RIDER', sessionId: `session-${userId}` } }
      : {}),
  } as unknown as Request;

  await sensitiveUserRateLimit(request, response, next);
  return next.mock.calls[0]?.[0];
}

describe('sensitiveUserRateLimit', () => {
  it('follows the authenticated user across changing IP addresses', async () => {
    const userId = 'rate-user-changing-ip';
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(consume(userId, `203.0.113.${attempt}`)).resolves.toBeUndefined();
    }

    await expect(consume(userId, '198.51.100.42')).resolves.toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('does not make two Riders on one carrier IP share the write budget', async () => {
    const sharedIp = '198.51.100.90';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await consume('rate-user-a', sharedIp);
    }

    await expect(consume('rate-user-a', sharedIp)).resolves.toMatchObject({ statusCode: 429 });
    await expect(consume('rate-user-b', sharedIp)).resolves.toBeUndefined();
  });

  it('fails closed when authentication has not populated req.user', async () => {
    await expect(consume()).resolves.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  });
});
