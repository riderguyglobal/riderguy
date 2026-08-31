import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import { ApiError } from '../lib/api-error';
import type { AuthPayload } from '../middleware/auth';
import { StorageService, type PrivateUploadFolder } from './storage.service';

const PRIVATE_FOLDERS = new Set<PrivateUploadFolder>([
  'documents',
  'vehicles',
  'packages',
  'proofs',
  'failures',
]);

function requesterRoles(requester: AuthPayload): Set<UserRole> {
  return new Set(requester.roles?.length ? requester.roles : [requester.role]);
}

function isOrderParticipant(
  order: { clientId: string; rider: { userId: string } | null },
  requester: AuthPayload,
): boolean {
  if (requesterRoles(requester).has(UserRole.DISPATCHER)) return true;
  return order.clientId === requester.userId || order.rider?.userId === requester.userId;
}

function referencesKey(references: string | null, key: string): boolean {
  if (!references) return false;
  return references
    .split(',')
    .map((reference) => StorageService.extractKey(reference))
    .some((referenceKey) => referenceKey === key);
}

/**
 * Central authorization for media that is intentionally exposed through the
 * authenticated `/uploads/*` API route. New objects use owner-scoped keys;
 * legacy flat keys are authorized from their owning database record.
 */
export class MediaAccessService {
  static async assertCanRead(key: string, requester: AuthPayload): Promise<void> {
    if (!(await MediaAccessService.canRead(key, requester))) {
      throw ApiError.forbidden('You do not have permission to view this file');
    }
  }

  static async canRead(key: string, requester: AuthPayload): Promise<boolean> {
    const normalizedKey = StorageService.extractKey(key);
    if (!normalizedKey) return false;

    const segments = normalizedKey.split('/');
    const folder = segments[0];
    if (!folder || !StorageService.isAllowedUploadFolder(folder)) return false;

    // Avatars are deliberately cross-user-visible to authenticated app users.
    if (folder === 'avatars') return true;

    if (!PRIVATE_FOLDERS.has(folder as PrivateUploadFolder)) return false;

    const roles = requesterRoles(requester);
    if (roles.has(UserRole.ADMIN) || roles.has(UserRole.SUPER_ADMIN)) return true;

    // New private uploads have: <folder>/<owner-user-id>/<random filename>.
    if (segments.length >= 3 && segments[1] === requester.userId) return true;

    // Flat legacy keys (and order media shared with a delivery participant)
    // require an exact database-backed ownership/participant relationship.
    const candidates = StorageService.urlCandidates(normalizedKey);
    if (candidates.length === 0) return false;

    switch (folder as PrivateUploadFolder) {
      case 'documents': {
        const document = await prisma.document.findFirst({
          where: { userId: requester.userId, fileUrl: { in: candidates } },
          select: { id: true },
        });
        return Boolean(document);
      }
      case 'vehicles': {
        const vehicle = await prisma.vehicle.findFirst({
          where: {
            rider: { userId: requester.userId },
            OR: [
              { photoFrontUrl: { in: candidates } },
              { photoBackUrl: { in: candidates } },
              { photoLeftUrl: { in: candidates } },
              { photoRightUrl: { in: candidates } },
            ],
          },
          select: { id: true },
        });
        return Boolean(vehicle);
      }
      case 'packages':
        return MediaAccessService.canReadPackage(normalizedKey, candidates, requester);
      case 'proofs': {
        const orders = await prisma.order.findMany({
          where: {
            OR: [
              { proofOfDeliveryUrl: { in: candidates } },
              { stops: { some: { proofUrl: { in: candidates } } } },
            ],
          },
          select: {
            clientId: true,
            rider: { select: { userId: true } },
          },
          take: 10,
        });
        return orders.some((order) => isOrderParticipant(order, requester));
      }
      case 'failures': {
        const orders = await prisma.order.findMany({
          where: { failurePhotoUrl: { in: candidates } },
          select: {
            clientId: true,
            rider: { select: { userId: true } },
          },
          take: 10,
        });
        return orders.some((order) => isOrderParticipant(order, requester));
      }
    }

    return false;
  }

  private static async canReadPackage(
    key: string,
    candidates: string[],
    requester: AuthPayload,
  ): Promise<boolean> {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          // The client currently stores multiple package-photo references as a
          // comma-delimited value, so narrow by key and verify exactly below.
          { packagePhotoUrl: { contains: key } },
          { stops: { some: { packagePhotoUrl: { in: candidates } } } },
        ],
      },
      select: {
        clientId: true,
        rider: { select: { userId: true } },
        packagePhotoUrl: true,
        stops: { select: { packagePhotoUrl: true } },
      },
      take: 10,
    });

    return orders.some((order) => {
      if (!isOrderParticipant(order, requester)) return false;
      return referencesKey(order.packagePhotoUrl, key)
        || order.stops.some((stop) => referencesKey(stop.packagePhotoUrl, key));
    });
  }
}
