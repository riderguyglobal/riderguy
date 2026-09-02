import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '@riderguy/database';
import { ApiError } from '../lib/api-error';

type AuditDatabase = Pick<Prisma.TransactionClient, 'auditLog'>;

export interface AdminAuditContext {
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AdminAuditEvent extends AdminAuditContext {
  action: string;
  entityType: string;
  entityId: string;
  oldData?: unknown;
  newData?: unknown;
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function adminAuditContext(req: Request): AdminAuditContext {
  return {
    actorUserId: req.user!.userId,
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get?.('user-agent')?.slice(0, 500) ?? null,
  };
}

/**
 * Durable decision logging for privileged operations. Call this with the same
 * Prisma transaction that performs the state change whenever possible, so a
 * decision can never be committed without its audit record.
 */
export class AdminAuditService {
  static async record(event: AdminAuditEvent, db: AuditDatabase = prisma) {
    const oldData = asJson(event.oldData);
    const newData = asJson(event.newData);
    return db.auditLog.create({
      data: {
        userId: event.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        ...(oldData !== undefined ? { oldData } : {}),
        ...(newData !== undefined ? { newData } : {}),
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
      },
    });
  }

  static async listForRider(userId: string, page = 1, limit = 30) {
    const rider = await prisma.riderProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        channelInvitationId: true,
        user: { select: { documents: { select: { id: true } } } },
        vehicles: { select: { id: true } },
        trainingCompletions: { select: { id: true } },
        assetFinancingInterest: { select: { id: true } },
      },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const entityGroups = [
      { entityType: 'User', ids: [rider.userId] },
      { entityType: 'RiderProfile', ids: [rider.id, rider.userId] },
      { entityType: 'Document', ids: rider.user.documents.map((item) => item.id) },
      { entityType: 'Vehicle', ids: rider.vehicles.map((item) => item.id) },
      { entityType: 'RiderTrainingCompletion', ids: rider.trainingCompletions.map((item) => item.id) },
      { entityType: 'AssetFinancingInterest', ids: rider.assetFinancingInterest ? [rider.assetFinancingInterest.id] : [] },
      { entityType: 'RiderInvitation', ids: rider.channelInvitationId ? [rider.channelInvitationId] : [] },
    ];
    const where: Prisma.AuditLogWhereInput = {
      OR: entityGroups
        .filter((group) => group.ids.length > 0)
        .map((group) => ({ entityType: group.entityType, entityId: { in: group.ids } })),
    };
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.auditLog.count({ where }),
    ]);
    const actorIds = [...new Set(logs.flatMap((log) => log.userId ? [log.userId] : []))];
    const actors = actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

    return {
      items: logs.map((log) => ({
        ...log,
        actor: log.userId ? actorMap.get(log.userId) ?? null : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
