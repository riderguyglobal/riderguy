import { prisma } from '@riderguy/database';
import { AccountStatus } from '@prisma/client';
import { UserRole } from '@riderguy/types';
import { ApiError } from '../lib/api-error';
import { acquireTransactionAdvisoryLock } from '../lib/postgres-advisory-lock';
import { AdminAuditService, type AdminAuditContext } from './admin-audit.service';

export interface UpdateAdminManagedUserStatusInput {
  targetUserId: string;
  status: AccountStatus;
  reason?: string;
  actorIsSuperAdmin: boolean;
  auditContext: AdminAuditContext;
}

const responseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
} as const;

function userHasRole(
  user: { role: string; roles: readonly string[] },
  ...roles: UserRole[]
): boolean {
  return roles.some((role) => user.role === role || user.roles.includes(role));
}

/**
 * Applies an administrator account-status decision as one serialised unit.
 *
 * The global advisory lock is intentional: without it, two Super Admins can
 * concurrently suspend each other after both observe that two active Super
 * Admins exist. The decision, its CAS and the audit row also share one
 * transaction so a privileged mutation is never committed unattributed.
 */
export async function updateAdminManagedUserStatus(input: UpdateAdminManagedUserStatusInput) {
  const normalizedReason = input.reason?.trim() ?? '';
  if (input.status !== AccountStatus.ACTIVE && normalizedReason.length < 5) {
    throw ApiError.badRequest(
      'A meaningful operational reason is required for access restrictions',
      'STATUS_REASON_REQUIRED',
    );
  }

  return prisma.$transaction(async (tx) => {
    await acquireTransactionAdvisoryLock(
      tx,
      'administrator-account-boundary',
      'active-super-admins',
    );

    const user = await tx.user.findUnique({
      where: { id: input.targetUserId },
      select: {
        id: true,
        role: true,
        roles: true,
        status: true,
      },
    });
    if (!user) throw ApiError.notFound('User not found');

    if (userHasRole(user, UserRole.ADMIN, UserRole.SUPER_ADMIN) && !input.actorIsSuperAdmin) {
      throw ApiError.forbidden(
        'Only super admins can modify admin accounts',
        'ADMIN_ACCOUNT_REQUIRES_SUPER_ADMIN',
      );
    }

    if (
      input.targetUserId === input.auditContext.actorUserId &&
      input.status !== AccountStatus.ACTIVE
    ) {
      throw ApiError.conflict(
        'You cannot restrict your own administrator account',
        'SELF_LOCKOUT_PREVENTED',
      );
    }

    if (user.status === input.status) {
      const unchanged = await tx.user.findUnique({
        where: { id: input.targetUserId },
        select: responseSelect,
      });
      if (!unchanged) throw ApiError.notFound('User not found');
      return {
        user: unchanged,
        previousStatus: user.status,
        wasRider: userHasRole(user, UserRole.RIDER),
        outcome: 'UNCHANGED' as const,
      };
    }

    if (
      user.status === AccountStatus.ACTIVE &&
      input.status !== AccountStatus.ACTIVE &&
      userHasRole(user, UserRole.SUPER_ADMIN)
    ) {
      const activeSuperAdmins = await tx.user.count({
        where: {
          status: AccountStatus.ACTIVE,
          OR: [{ role: UserRole.SUPER_ADMIN }, { roles: { has: UserRole.SUPER_ADMIN } }],
        },
      });
      if (activeSuperAdmins <= 1) {
        throw ApiError.conflict(
          'The last active super administrator cannot be restricted',
          'LAST_SUPER_ADMIN',
        );
      }
    }

    const changed = await tx.user.updateMany({
      where: { id: input.targetUserId, status: user.status },
      data: { status: input.status },
    });
    if (changed.count !== 1) {
      throw ApiError.conflict(
        'This account changed while the decision was being applied. Refresh and try again.',
        'USER_STATUS_CHANGED',
      );
    }

    await AdminAuditService.record(
      {
        ...input.auditContext,
        action: `user_account.status_${input.status.toLowerCase()}`,
        entityType: 'User',
        entityId: input.targetUserId,
        oldData: { status: user.status },
        newData: { status: input.status, reason: normalizedReason || null },
      },
      tx,
    );

    const updated = await tx.user.findUnique({
      where: { id: input.targetUserId },
      select: responseSelect,
    });
    if (!updated) throw ApiError.notFound('User not found');

    return {
      user: updated,
      previousStatus: user.status,
      wasRider: userHasRole(user, UserRole.RIDER),
      outcome: 'UPDATED' as const,
    };
  });
}
