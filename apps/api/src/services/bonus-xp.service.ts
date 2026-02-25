// ============================================================
// Bonus XP Events Service — Sprint 10
// Time-limited XP multiplier events (e.g., Double XP Weekend)
// ============================================================

import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { ApiError } from '../lib/api-error';

// ────── Admin: CRUD ──────

export async function createBonusEvent(data: {
  title: string;
  description: string;
  multiplier: number;
  targetActions?: string[];
  zoneId?: string;
  startsAt: string;
  endsAt: string;
  createdBy?: string;
}) {
  return prisma.bonusXpEvent.create({
    data: {
      title: data.title,
      description: data.description,
      multiplier: data.multiplier,
      targetActions: data.targetActions ?? [],
      zoneId: data.zoneId ?? null,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      isActive: true,
      createdBy: data.createdBy ?? null,
    },
  });
}

export async function updateBonusEvent(
  eventId: string,
  data: Partial<{
    title: string;
    description: string;
    multiplier: number;
    targetActions: string[];
    zoneId: string | null;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
  }>,
) {
  const updateData: Record<string, unknown> = { ...data };
  if (data.startsAt) updateData.startsAt = new Date(data.startsAt);
  if (data.endsAt) updateData.endsAt = new Date(data.endsAt);

  return prisma.bonusXpEvent.update({
    where: { id: eventId },
    data: updateData as any,
  });
}

export async function deleteBonusEvent(eventId: string) {
  return prisma.bonusXpEvent.delete({ where: { id: eventId } });
}

/** List all bonus events (admin) */
export async function listBonusEventsAdmin() {
  return prisma.bonusXpEvent.findMany({
    orderBy: { startsAt: 'desc' },
  });
}

// ────── Query active events ──────

/** Get currently active bonus events (for a given zone) */
export async function getActiveEvents(zoneId?: string | null) {
  const now = new Date();

  return prisma.bonusXpEvent.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      OR: [
        { zoneId: null },
        ...(zoneId ? [{ zoneId }] : []),
      ],
    },
    orderBy: { multiplier: 'desc' },
  });
}

/**
 * Calculate the effective XP multiplier for a given action & zone.
 * Returns the highest active multiplier that applies.
 */
export async function getXpMultiplier(
  action: string,
  zoneId?: string | null,
): Promise<number> {
  const activeEvents = await getActiveEvents(zoneId);

  let maxMultiplier = 1;

  for (const event of activeEvents) {
    // Check if this event applies to this action
    const appliesToAction =
      event.targetActions.length === 0 || // empty = all actions
      event.targetActions.includes(action);

    if (appliesToAction && event.multiplier > maxMultiplier) {
      maxMultiplier = event.multiplier;
    }
  }

  return maxMultiplier;
}

/** Get bonus events visible to riders (active + upcoming within 24h) */
export async function getVisibleEvents(zoneId?: string | null) {
  const now = new Date();
  const soon = new Date(now.getTime() + 86_400_000); // 24h from now

  return prisma.bonusXpEvent.findMany({
    where: {
      isActive: true,
      endsAt: { gte: now },
      startsAt: { lte: soon },
      OR: [
        { zoneId: null },
        ...(zoneId ? [{ zoneId }] : []),
      ],
    },
    orderBy: { startsAt: 'asc' },
  });
}
