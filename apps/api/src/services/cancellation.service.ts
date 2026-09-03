import { prisma } from '@riderguy/database';
import type { CancellationCategory, CancellationSeverity, OrderStatus } from '@prisma/client';
import { creditWallet, debitWallet } from './wallet.service';
import { createOrderNotification } from './notification.service';
import { ApiError } from '../lib/api-error';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';

// ============================================================
// Cancellation Consequence Service
//
// Comprehensive system that:
// 1. Categorises every rider cancellation
// 2. Determines severity based on reason + order stage + frequency
// 3. Applies escalating penalties (fee + suspension)
// 4. Flags serious cases for admin investigation
// 5. Supports rider appeals
// ============================================================

// ── Reason → Category mapping ───────────────────────────────

const REASON_CATEGORY_MAP: Record<string, CancellationCategory> = {
  'Vehicle broke down': 'VEHICLE_BREAKDOWN',
  'Vehicle breakdown': 'VEHICLE_BREAKDOWN',
  'Personal emergency': 'PERSONAL_EMERGENCY',
  'Unsafe area or conditions': 'UNSAFE_CONDITIONS',
  'Unsafe pickup': 'UNSAFE_CONDITIONS',
  'Package too large or heavy': 'PACKAGE_ISSUE',
  'Package not as described': 'PACKAGE_ISSUE',
  'Package damaged': 'PACKAGE_ISSUE',
  'Prohibited or dangerous item': 'PACKAGE_ISSUE',
  'Prohibited / suspicious': 'PACKAGE_ISSUE',
  'Prohibited contents': 'PACKAGE_ISSUE',
  'Cannot find pickup location': 'CANNOT_FIND_LOCATION',
  'Client is unreachable': 'CLIENT_UNREACHABLE',
  'Sender not available': 'CLIENT_UNREACHABLE',
  'Recipient unreachable': 'RECIPIENT_UNREACHABLE',
  'refuses delivery': 'RECIPIENT_UNREACHABLE',
  'Payment or pricing dispute': 'PAYMENT_DISPUTE',
  'Waited too long at pickup': 'EXCESSIVE_WAIT',
  'Waited too long': 'EXCESSIVE_WAIT',
  'Pickup too far': 'DISTANCE_DISCREPANCY',
  'distance incorrect': 'DISTANCE_DISCREPANCY',
  'Accepted by mistake': 'ACCIDENTAL_ACCEPT',
  'Wrong address': 'ADDRESS_INVALID',
  'address does not exist': 'ADDRESS_INVALID',
  "address doesn't exist": 'ADDRESS_INVALID',
  'Road inaccessible': 'ADDRESS_INVALID',
  'Client added extra': 'UNDISCLOSED_REQUIREMENTS',
  'extra requirements': 'UNDISCLOSED_REQUIREMENTS',
  'additional stops not in order': 'UNDISCLOSED_REQUIREMENTS',
  'Extreme weather': 'UNSAFE_CONDITIONS',
};

export function categoriseReason(reason: string): CancellationCategory {
  for (const [keyword, category] of Object.entries(REASON_CATEGORY_MAP)) {
    if (reason.toLowerCase().includes(keyword.toLowerCase())) return category;
  }
  return 'OTHER';
}

// ── Severity determination ──────────────────────────────────

interface SeverityResult {
  severity: CancellationSeverity;
  penaltyAmount: number; // GHS
  suspensionHours: number;
  requiresInvestigation: boolean;
}

/** Categories that are inherently lower blame (no penalty on first offence) */
const LOW_BLAME_CATEGORIES: CancellationCategory[] = [
  'VEHICLE_BREAKDOWN',
  'PERSONAL_EMERGENCY',
  'UNSAFE_CONDITIONS',
  'CLIENT_UNREACHABLE',
  'RECIPIENT_UNREACHABLE',
  'DISTANCE_DISCREPANCY',
  'ACCIDENTAL_ACCEPT',
  'ADDRESS_INVALID',
  'UNDISCLOSED_REQUIREMENTS',
];

/** Order stages where cancellation is critical (package already with rider) */
const POST_PICKUP_STATUSES: OrderStatus[] = ['PICKED_UP', 'IN_TRANSIT'];

export function determineSeverity(
  category: CancellationCategory,
  orderStatusAtCancel: OrderStatus,
  cancellationsInWindow: number,
): SeverityResult {
  // ── Critical: cancelled after picking up the package ──
  if (POST_PICKUP_STATUSES.includes(orderStatusAtCancel)) {
    return {
      severity: 'CRITICAL',
      penaltyAmount: 15.0,
      suspensionHours: 24,
      requiresInvestigation: true,
    };
  }

  // ── Base severity from rolling cancellation count (30-day window) ──
  const isLowBlame = LOW_BLAME_CATEGORIES.includes(category);

  if (cancellationsInWindow <= 1) {
    // First cancellation
    return {
      severity: 'WARNING',
      penaltyAmount: 0,
      suspensionHours: 0,
      requiresInvestigation: false,
    };
  }

  if (cancellationsInWindow === 2) {
    return {
      severity: 'MINOR',
      penaltyAmount: isLowBlame ? 0 : 5.0,
      suspensionHours: 0,
      requiresInvestigation: false,
    };
  }

  if (cancellationsInWindow === 3) {
    return {
      severity: 'MODERATE',
      penaltyAmount: isLowBlame ? 5.0 : 10.0,
      suspensionHours: isLowBlame ? 0 : 2,
      requiresInvestigation: false,
    };
  }

  // 4+ cancellations
  return {
    severity: 'SEVERE',
    penaltyAmount: isLowBlame ? 10.0 : 20.0,
    suspensionHours: 24,
    requiresInvestigation: true,
  };
}

// ── Main: process a rider cancellation ──────────────────────

function isExpectedPenaltyCollectionFailure(error: unknown): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'NOT_FOUND' && error.message === 'Wallet not found') return true;
  return error.code === 'BAD_REQUEST' && error.message.startsWith('Insufficient wallet balance');
}

export async function processCancellationConsequences(
  riderId: string,
  riderUserId: string,
  orderId: string,
  orderNumber: string,
  orderStatusAtCancel: OrderStatus,
  reason: string,
  clientId: string,
) {
  const transactionResult = await prisma.$transaction(async (tx) => {
    // The order lock makes retries deterministic even if a stale caller passes
    // a different rider. The rider lock serializes the rolling severity count.
    await acquireTransactionAdvisoryLock(tx, 'cancellation-order', orderId);
    await acquireTransactionAdvisoryLock(tx, 'cancellation-rider', riderId);

    const existing = await tx.cancellationRecord.findUnique({ where: { orderId } });
    if (existing) {
      if (existing.riderId !== riderId) {
        throw ApiError.conflict('Cancellation consequences already belong to another rider');
      }
      return { record: existing, created: false } as const;
    }

    const rider = await tx.riderProfile.findUnique({
      where: { id: riderId },
      select: { suspendedUntil: true },
    });
    if (!rider) throw ApiError.notFound('Rider profile not found');

    const category = categoriseReason(reason);
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 30);

    const recentCount = await tx.cancellationRecord.count({
      where: {
        riderId,
        createdAt: { gte: windowStart },
      },
    });
    const cancellationsInWindow = recentCount + 1;
    const { severity, penaltyAmount, suspensionHours, requiresInvestigation } = determineSeverity(
      category,
      orderStatusAtCancel,
      cancellationsInWindow,
    );

    // ── Create the cancellation record ──
    const record = await tx.cancellationRecord.create({
      data: {
        riderId,
        orderId,
        category,
        reason,
        orderStatusAtCancel,
        severity,
        penaltyAmount,
        suspensionHours,
        suspensionApplied: suspensionHours > 0,
        requiresInvestigation,
        cancellationsInWindow,
      },
    });

    // ── Apply penalty (wallet debit) ──
    if (penaltyAmount > 0) {
      try {
        await debitWallet(
          riderUserId,
          penaltyAmount,
          'PENALTY',
          `Cancellation penalty for order ${orderNumber} (${severity.toLowerCase()})`,
          record.id,
          'cancellation_penalty',
          tx,
        );
        await tx.cancellationRecord.update({
          where: { id: record.id },
          data: { penaltyApplied: true },
        });
      } catch (error) {
        // An absent or underfunded wallet is a policy outcome, not a failed
        // consequence transaction. Unexpected persistence errors still roll back.
        if (!isExpectedPenaltyCollectionFailure(error)) throw error;
      }
    }

    // ── Apply suspension ──
    let suspendedUntil: Date | undefined;
    if (suspensionHours > 0) {
      const proposedSuspensionEnd = new Date();
      proposedSuspensionEnd.setHours(proposedSuspensionEnd.getHours() + suspensionHours);
      suspendedUntil =
        rider.suspendedUntil && rider.suspendedUntil > proposedSuspensionEnd
          ? rider.suspendedUntil
          : proposedSuspensionEnd;
    }

    // ── Update rider cancellation stats ──
    await tx.riderProfile.update({
      where: { id: riderId },
      data: {
        cancellationCount: { increment: 1 },
        lastCancellationAt: new Date(),
        ...(suspendedUntil ? { suspendedUntil, availability: 'OFFLINE' as const } : {}),
      },
    });

    const persisted = await tx.cancellationRecord.findUniqueOrThrow({
      where: { id: record.id },
    });
    return { record: persisted, created: true } as const;
  });

  const { record, created } = transactionResult;
  if (!created) return record;

  const penaltyAmount = Number(record.penaltyAmount);
  const { severity, suspensionHours, cancellationsInWindow } = record;

  // ── Notify rider of consequences ──
  const consequenceMsg = buildConsequenceMessage(
    severity,
    penaltyAmount,
    suspensionHours,
    cancellationsInWindow,
    record.penaltyApplied,
  );
  try {
    await createOrderNotification(
      riderUserId,
      severity === 'WARNING'
        ? 'Cancellation Recorded ⚠️'
        : record.penaltyApplied
          ? 'Cancellation Penalty Applied 🚨'
          : 'Cancellation Consequence Recorded ⚠️',
      consequenceMsg,
      orderId,
    );
  } catch {
    /* non-blocking */
  }

  // ── Enhanced client notification with context ──
  const clientMsg = buildClientNotification(orderNumber, reason, severity);
  try {
    await createOrderNotification(clientId, 'Delivery Cancelled by Rider ⚠️', clientMsg, orderId);
  } catch {
    /* non-blocking */
  }

  return record;
}

// ── Message builders ────────────────────────────────────────

function buildConsequenceMessage(
  severity: CancellationSeverity,
  penalty: number,
  suspensionHours: number,
  windowCount: number,
  penaltyApplied: boolean,
): string {
  const parts: string[] = [];
  const financialConsequence =
    penalty <= 0
      ? 'No financial penalty was charged.'
      : penaltyApplied
        ? `GHS ${penalty.toFixed(2)} was deducted from your wallet.`
        : `A GHS ${penalty.toFixed(2)} penalty was assessed, but no wallet debit was made.`;

  switch (severity) {
    case 'WARNING':
      parts.push(`This cancellation has been recorded (${windowCount} in 30 days).`);
      parts.push(
        'No penalty this time, but repeated cancellations will result in fees and suspensions.',
      );
      break;
    case 'MINOR':
      parts.push(financialConsequence);
      parts.push(`You've cancelled ${windowCount} times in 30 days.`);
      break;
    case 'MODERATE':
      parts.push(financialConsequence);
      if (suspensionHours > 0)
        parts.push(`You are suspended from new orders for ${suspensionHours} hours.`);
      parts.push(`${windowCount} cancellations in 30 days — please improve your acceptance rate.`);
      break;
    case 'SEVERE':
      parts.push(financialConsequence);
      parts.push(`Suspended for ${suspensionHours} hours. An admin will review your account.`);
      parts.push(`${windowCount} cancellations in 30 days is unacceptable.`);
      break;
    case 'CRITICAL':
      parts.push(
        `CRITICAL: ${financialConsequence} Cancelling after pickup is a serious violation.`,
      );
      parts.push(
        `Suspended for ${suspensionHours} hours. Your account is under admin investigation.`,
      );
      parts.push('You may appeal this decision within 48 hours.');
      break;
  }

  return parts.join(' ');
}

function buildClientNotification(
  orderNumber: string,
  reason: string,
  severity: CancellationSeverity,
): string {
  const parts = [`Your rider cancelled order ${orderNumber}.`, `Reason: ${reason}.`];

  if (severity !== 'WARNING') {
    parts.push('The rider has been penalised for this cancellation.');
  }

  parts.push("We're sorry for the inconvenience — you can place a new order immediately.");
  return parts.join(' ');
}

// ── Appeal handling ─────────────────────────────────────────

export async function submitAppeal(
  cancellationId: string,
  riderUserId: string,
  statement: string,
  evidenceUrls: string[] = [],
) {
  const record = await prisma.cancellationRecord.findUnique({
    where: { id: cancellationId },
    include: { rider: { select: { userId: true } } },
  });

  if (!record) throw ApiError.notFound('Cancellation record not found');
  if (record.rider.userId !== riderUserId) throw ApiError.forbidden('Not your cancellation');

  // Check if appeal already exists
  const existing = await prisma.cancellationAppeal.findUnique({
    where: { cancellationId },
  });
  if (existing) throw ApiError.conflict('Appeal already submitted for this cancellation');

  // Must appeal within 48 hours
  const hoursSinceCancellation = (Date.now() - record.createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCancellation > 48) throw ApiError.badRequest('Appeal window has closed (48 hours)');

  return prisma.cancellationAppeal.create({
    data: {
      cancellationId,
      riderId: record.riderId,
      riderStatement: statement,
      evidenceUrls,
    },
  });
}

// ── Admin: review appeal ────────────────────────────────────

export async function reviewAppeal(
  appealId: string,
  decision: 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED',
  notes: string,
  refundPenalty: boolean,
  liftSuspension: boolean,
  audit: AdminAuditContext,
) {
  if (notes.trim().length < 5) throw ApiError.badRequest('A clear appeal rationale is required');
  if (decision === 'DENIED' && (refundPenalty || liftSuspension)) {
    throw ApiError.badRequest('A denied appeal cannot refund a penalty or lift a suspension');
  }

  return prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(tx, 'cancellation-appeal', appealId);
    const appeal = await tx.cancellationAppeal.findUnique({
      where: { id: appealId },
      include: {
        cancellation: {
          include: { rider: { select: { userId: true, id: true, suspendedUntil: true } } },
        },
      },
    });

    if (!appeal) throw ApiError.notFound('Appeal not found');
    if (!['PENDING', 'UNDER_REVIEW'].includes(appeal.status)) {
      throw ApiError.conflict(`This appeal is already ${appeal.status.toLowerCase()}`);
    }

    const penaltyAmount = Number(appeal.cancellation.penaltyAmount);
    if (refundPenalty && (!appeal.cancellation.penaltyApplied || penaltyAmount <= 0)) {
      throw ApiError.badRequest('This cancellation has no applied penalty to refund');
    }

    const suspensionIsActive = Boolean(
      appeal.cancellation.suspensionApplied &&
      appeal.cancellation.rider.suspendedUntil &&
      appeal.cancellation.rider.suspendedUntil > new Date(),
    );
    if (liftSuspension && !suspensionIsActive) {
      throw ApiError.badRequest('This rider has no active cancellation suspension to lift');
    }

    // The advisory lock serialises cooperating decision paths. The status CAS
    // also protects against another path that does not acquire that lock.
    const claimed = await tx.cancellationAppeal.updateMany({
      where: { id: appealId, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      data: {
        status: decision,
        reviewedBy: audit.actorUserId,
        reviewNotes: notes.trim(),
        outcome: `${decision}: ${notes.trim()}`,
        penaltyRefunded: refundPenalty,
        suspensionLifted: liftSuspension,
        reviewedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      throw ApiError.conflict('This appeal was decided by another administrator');
    }

    // Refund penalty if approved
    if (refundPenalty) {
      await creditWallet(
        appeal.cancellation.rider.userId,
        penaltyAmount,
        'REFUND',
        `Penalty refund — appeal ${decision.toLowerCase()} for cancellation`,
        appeal.cancellationId,
        'appeal_refund',
        tx,
      );
    }

    // Lift suspension if approved
    if (liftSuspension) {
      await tx.riderProfile.update({
        where: { id: appeal.cancellation.rider.id },
        data: { suspendedUntil: null },
      });
    }

    await AdminAuditService.record(
      {
        ...audit,
        action: 'CANCELLATION_APPEAL_DECIDED',
        entityType: 'CancellationAppeal',
        entityId: appealId,
        oldData: {
          status: appeal.status,
          penaltyRefunded: appeal.penaltyRefunded,
          suspensionLifted: appeal.suspensionLifted,
        },
        newData: { decision, notes: notes.trim(), refundPenalty, liftSuspension },
      },
      tx,
    );

    return tx.cancellationAppeal.findUniqueOrThrow({ where: { id: appealId } });
  });
}

export async function closeCancellationInvestigation(
  cancellationId: string,
  notes: string,
  audit: AdminAuditContext,
) {
  const trimmedNotes = notes.trim();
  if (trimmedNotes.length < 5) {
    throw ApiError.badRequest('Clear investigation findings are required');
  }

  return prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(tx, 'cancellation-investigation', cancellationId);
    const existing = await tx.cancellationRecord.findUnique({ where: { id: cancellationId } });
    if (!existing) throw ApiError.notFound('Cancellation record not found');
    if (!existing.requiresInvestigation) {
      throw ApiError.badRequest('This cancellation is not flagged for investigation');
    }
    if (existing.investigationNotes) {
      throw ApiError.conflict('This investigation is already closed');
    }

    const claimed = await tx.cancellationRecord.updateMany({
      where: {
        id: cancellationId,
        requiresInvestigation: true,
        investigationNotes: null,
      },
      data: { investigationNotes: trimmedNotes },
    });
    if (claimed.count !== 1) {
      throw ApiError.conflict('This investigation was closed by another administrator');
    }

    await AdminAuditService.record(
      {
        ...audit,
        action: 'CANCELLATION_INVESTIGATION_CLOSED',
        entityType: 'CancellationRecord',
        entityId: cancellationId,
        oldData: { investigationNotes: existing.investigationNotes },
        newData: { investigationNotes: trimmedNotes },
      },
      tx,
    );

    return tx.cancellationRecord.findUniqueOrThrow({ where: { id: cancellationId } });
  });
}

// ── Query helpers ───────────────────────────────────────────

export async function getRiderCancellationHistory(riderId: string, limit = 20) {
  return prisma.cancellationRecord.findMany({
    where: { riderId },
    include: {
      order: { select: { orderNumber: true } },
      appeal: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getPendingInvestigations() {
  return prisma.cancellationRecord.findMany({
    where: { requiresInvestigation: true, investigationNotes: null },
    include: {
      rider: {
        select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } },
      },
      order: { select: { orderNumber: true } },
      appeal: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPendingAppeals() {
  const appeals = await prisma.cancellationAppeal.findMany({
    where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
    include: {
      cancellation: {
        include: {
          rider: {
            select: {
              userId: true,
              suspendedUntil: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
          order: { select: { orderNumber: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = Date.now();
  return appeals.map((appeal) => ({
    ...appeal,
    canRefundPenalty:
      appeal.cancellation.penaltyApplied && Number(appeal.cancellation.penaltyAmount) > 0,
    canLiftSuspension: Boolean(
      appeal.cancellation.suspensionApplied &&
      appeal.cancellation.rider.suspendedUntil &&
      appeal.cancellation.rider.suspendedUntil.getTime() > now,
    ),
  }));
}

// ── Suspension check utility ────────────────────────────────

export async function isRiderSuspended(riderId: string): Promise<boolean> {
  const rider = await prisma.riderProfile.findUnique({
    where: { id: riderId },
    select: { suspendedUntil: true },
  });
  if (!rider?.suspendedUntil) return false;
  if (rider.suspendedUntil > new Date()) return true;

  // Suspension expired — clear it
  await prisma.riderProfile.update({
    where: { id: riderId },
    data: { suspendedUntil: null },
  });
  return false;
}
