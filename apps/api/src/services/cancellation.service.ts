import { prisma } from '@riderguy/database';
import type { CancellationCategory, CancellationSeverity, OrderStatus } from '@prisma/client';
import { debitWallet } from './wallet.service';
import { createOrderNotification } from './notification.service';

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
  'Personal emergency': 'PERSONAL_EMERGENCY',
  'Unsafe area or conditions': 'UNSAFE_CONDITIONS',
  'Package too large or heavy': 'PACKAGE_ISSUE',
  'Prohibited or dangerous item': 'PACKAGE_ISSUE',
  'Cannot find pickup location': 'CANNOT_FIND_LOCATION',
  'Client is unreachable': 'CLIENT_UNREACHABLE',
  'Payment or pricing dispute': 'PAYMENT_DISPUTE',
  'Waited too long at pickup': 'EXCESSIVE_WAIT',
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
  penaltyAmount: number;      // GHS
  suspensionHours: number;
  requiresInvestigation: boolean;
}

/** Categories that are inherently lower blame (no penalty on first offence) */
const LOW_BLAME_CATEGORIES: CancellationCategory[] = [
  'VEHICLE_BREAKDOWN',
  'PERSONAL_EMERGENCY',
  'UNSAFE_CONDITIONS',
  'CLIENT_UNREACHABLE',
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
      penaltyAmount: 15.00,
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
      penaltyAmount: isLowBlame ? 0 : 5.00,
      suspensionHours: 0,
      requiresInvestigation: false,
    };
  }

  if (cancellationsInWindow === 3) {
    return {
      severity: 'MODERATE',
      penaltyAmount: isLowBlame ? 5.00 : 10.00,
      suspensionHours: isLowBlame ? 0 : 2,
      requiresInvestigation: false,
    };
  }

  // 4+ cancellations
  return {
    severity: 'SEVERE',
    penaltyAmount: isLowBlame ? 10.00 : 20.00,
    suspensionHours: 24,
    requiresInvestigation: true,
  };
}

// ── Main: process a rider cancellation ──────────────────────

export async function processCancellationConsequences(
  riderId: string,
  riderUserId: string,
  orderId: string,
  orderNumber: string,
  orderStatusAtCancel: OrderStatus,
  reason: string,
  clientId: string,
) {
  const category = categoriseReason(reason);

  // Count cancellations in the last 30 days (rolling window)
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);

  const recentCount = await prisma.cancellationRecord.count({
    where: {
      riderId,
      createdAt: { gte: windowStart },
    },
  });

  const cancellationsInWindow = recentCount + 1; // Including this one

  const { severity, penaltyAmount, suspensionHours, requiresInvestigation } =
    determineSeverity(category, orderStatusAtCancel, cancellationsInWindow);

  // ── Create the cancellation record ──
  const record = await prisma.cancellationRecord.create({
    data: {
      riderId,
      orderId,
      category,
      reason,
      orderStatusAtCancel,
      severity,
      penaltyAmount,
      suspensionHours,
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
      );
      await prisma.cancellationRecord.update({
        where: { id: record.id },
        data: { penaltyApplied: true },
      });
    } catch {
      // If wallet has insufficient funds, record it but don't block
      // Penalty remains as a negative balance or is collected on next earning
    }
  }

  // ── Apply suspension ──
  if (suspensionHours > 0) {
    const suspendedUntil = new Date();
    suspendedUntil.setHours(suspendedUntil.getHours() + suspensionHours);

    await prisma.riderProfile.update({
      where: { id: riderId },
      data: {
        suspendedUntil,
        availability: 'OFFLINE',
      },
    });

    await prisma.cancellationRecord.update({
      where: { id: record.id },
      data: { suspensionApplied: true },
    });
  }

  // ── Update rider cancellation stats ──
  await prisma.riderProfile.update({
    where: { id: riderId },
    data: {
      cancellationCount: { increment: 1 },
      lastCancellationAt: new Date(),
    },
  });

  // ── Notify rider of consequences ──
  const consequenceMsg = buildConsequenceMessage(severity, penaltyAmount, suspensionHours, cancellationsInWindow);
  try {
    await createOrderNotification(
      riderUserId,
      severity === 'WARNING' ? 'Cancellation Recorded ⚠️' : 'Cancellation Penalty Applied 🚨',
      consequenceMsg,
      orderId,
    );
  } catch { /* non-blocking */ }

  // ── Enhanced client notification with context ──
  const clientMsg = buildClientNotification(orderNumber, reason, severity);
  try {
    await createOrderNotification(clientId, 'Delivery Cancelled by Rider ⚠️', clientMsg, orderId);
  } catch { /* non-blocking */ }

  return record;
}

// ── Message builders ────────────────────────────────────────

function buildConsequenceMessage(
  severity: CancellationSeverity,
  penalty: number,
  suspensionHours: number,
  windowCount: number,
): string {
  const parts: string[] = [];

  switch (severity) {
    case 'WARNING':
      parts.push(`This cancellation has been recorded (${windowCount} in 30 days).`);
      parts.push('No penalty this time, but repeated cancellations will result in fees and suspensions.');
      break;
    case 'MINOR':
      parts.push(`Cancellation penalty: GHS ${penalty.toFixed(2)} deducted from your wallet.`);
      parts.push(`You've cancelled ${windowCount} times in 30 days.`);
      break;
    case 'MODERATE':
      parts.push(`Cancellation penalty: GHS ${penalty.toFixed(2)} deducted.`);
      if (suspensionHours > 0) parts.push(`You are suspended from new orders for ${suspensionHours} hours.`);
      parts.push(`${windowCount} cancellations in 30 days — please improve your acceptance rate.`);
      break;
    case 'SEVERE':
      parts.push(`Serious penalty: GHS ${penalty.toFixed(2)} deducted.`);
      parts.push(`Suspended for ${suspensionHours} hours. An admin will review your account.`);
      parts.push(`${windowCount} cancellations in 30 days is unacceptable.`);
      break;
    case 'CRITICAL':
      parts.push(`CRITICAL: GHS ${penalty.toFixed(2)} deducted. Cancelling after pickup is a serious violation.`);
      parts.push(`Suspended for ${suspensionHours} hours. Your account is under admin investigation.`);
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

  if (!record) throw new Error('Cancellation record not found');
  if (record.rider.userId !== riderUserId) throw new Error('Not your cancellation');

  // Check if appeal already exists
  const existing = await prisma.cancellationAppeal.findUnique({
    where: { cancellationId },
  });
  if (existing) throw new Error('Appeal already submitted for this cancellation');

  // Must appeal within 48 hours
  const hoursSinceCancellation = (Date.now() - record.createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCancellation > 48) throw new Error('Appeal window has closed (48 hours)');

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
  adminUserId: string,
  decision: 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED',
  notes: string,
  refundPenalty: boolean,
  liftSuspension: boolean,
) {
  const appeal = await prisma.cancellationAppeal.findUnique({
    where: { id: appealId },
    include: {
      cancellation: {
        include: { rider: { select: { userId: true, id: true, suspendedUntil: true } } },
      },
    },
  });

  if (!appeal) throw new Error('Appeal not found');

  // Refund penalty if approved
  if (refundPenalty && Number(appeal.cancellation.penaltyAmount) > 0) {
    const { creditWallet } = await import('./wallet.service');
    await creditWallet(
      appeal.cancellation.rider.userId,
      Number(appeal.cancellation.penaltyAmount),
      'REFUND',
      `Penalty refund — appeal ${decision.toLowerCase()} for cancellation`,
      appeal.cancellationId,
      'appeal_refund',
    );
  }

  // Lift suspension if approved
  if (liftSuspension && appeal.cancellation.rider.suspendedUntil) {
    await prisma.riderProfile.update({
      where: { id: appeal.cancellation.rider.id },
      data: { suspendedUntil: null },
    });
  }

  return prisma.cancellationAppeal.update({
    where: { id: appealId },
    data: {
      status: decision,
      reviewedBy: adminUserId,
      reviewNotes: notes,
      outcome: `${decision}: ${notes}`,
      penaltyRefunded: refundPenalty,
      suspensionLifted: liftSuspension,
      reviewedAt: new Date(),
    },
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
      rider: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } },
      order: { select: { orderNumber: true } },
      appeal: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPendingAppeals() {
  return prisma.cancellationAppeal.findMany({
    where: { status: 'PENDING' },
    include: {
      cancellation: {
        include: {
          rider: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
          order: { select: { orderNumber: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
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
