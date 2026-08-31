import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@riderguy/types';
import type { AuthPayload } from '../middleware/auth';

const databaseMocks = vi.hoisted(() => ({
  document: { findFirst: vi.fn() },
  vehicle: { findFirst: vi.fn() },
  order: { findMany: vi.fn() },
}));

vi.mock('@riderguy/database', () => ({ prisma: databaseMocks }));
vi.mock('../config', () => ({
  config: {
    s3: {
      endpoint: '',
      region: 'auto',
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: 'riderguy-uploads',
    },
  },
}));

import { MediaAccessService } from './media-access.service';

function requester(userId: string, role: UserRole = UserRole.CLIENT): AuthPayload {
  return { userId, role, roles: [role], sessionId: 'session-1' };
}

describe('MediaAccessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.document.findFirst.mockResolvedValue(null);
    databaseMocks.vehicle.findFirst.mockResolvedValue(null);
    databaseMocks.order.findMany.mockResolvedValue([]);
  });

  it('allows an owner-scoped private key only to its owner before DB binding', async () => {
    await expect(MediaAccessService.canRead(
      'documents/user-1/private.pdf',
      requester('user-1', UserRole.RIDER),
    )).resolves.toBe(true);

    await expect(MediaAccessService.canRead(
      'documents/user-1/private.pdf',
      requester('user-2', UserRole.RIDER),
    )).resolves.toBe(false);
  });

  it('keeps legacy flat documents accessible only through DB ownership', async () => {
    databaseMocks.document.findFirst.mockResolvedValueOnce({ id: 'document-1' });

    await expect(MediaAccessService.canRead(
      'documents/legacy-flat.pdf',
      requester('user-1', UserRole.RIDER),
    )).resolves.toBe(true);

    expect(databaseMocks.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });

  it('lets the assigned rider read owner-scoped package media after order binding', async () => {
    databaseMocks.order.findMany.mockResolvedValueOnce([{
      clientId: 'client-user',
      rider: { userId: 'rider-user' },
      packagePhotoUrl: '/uploads/packages/client-user/package.jpg',
      stops: [],
    }]);

    await expect(MediaAccessService.canRead(
      'packages/client-user/package.jpg',
      requester('rider-user', UserRole.RIDER),
    )).resolves.toBe(true);
  });

  it('lets the client read rider-owned proof media after order binding', async () => {
    databaseMocks.order.findMany.mockResolvedValueOnce([{
      clientId: 'client-user',
      rider: { userId: 'rider-user' },
    }]);

    await expect(MediaAccessService.canRead(
      'proofs/rider-user/proof.jpg',
      requester('client-user'),
    )).resolves.toBe(true);
  });

  it('denies an unrelated user and allows admins to review private media', async () => {
    await expect(MediaAccessService.canRead(
      'proofs/rider-user/proof.jpg',
      requester('unrelated-user'),
    )).resolves.toBe(false);

    await expect(MediaAccessService.canRead(
      'documents/rider-user/private.pdf',
      requester('admin-user', UserRole.ADMIN),
    )).resolves.toBe(true);
  });
});
