import { prisma } from '@riderguy/database';
import { logger } from '../lib/logger';
import { NotificationService } from '../services/notification.service';
import { EmailService } from '../services/email.service';

/**
 * notifyAdminJobFailure
 *
 * Fires only when a BullMQ job has exhausted all retry attempts.
 * Creates an in-app SYSTEM notification for every active admin and
 * sends a single summary email to ops via EmailService.
 *
 * Designed to be safe in worker `.on('failed', ...)` handlers — never
 * throws, always resolves. Failures inside the alert pipeline are logged
 * but never propagate back to BullMQ.
 */
export async function notifyAdminJobFailure(opts: {
  queueName: string;
  jobId: string | undefined;
  jobName: string | undefined;
  jobData: unknown;
  attemptsMade: number | undefined;
  maxAttempts: number | undefined;
  error: Error;
}): Promise<void> {
  const { queueName, jobId, jobName, jobData, attemptsMade, maxAttempts, error } = opts;

  // Only escalate when retries are exhausted. BullMQ default attempts = 1
  // means a single failure IS terminal — treat undefined max as 1.
  const max = maxAttempts ?? 1;
  const made = attemptsMade ?? 0;
  if (made < max) {
    return;
  }

  const title = `Job failed: ${queueName}${jobName ? `:${jobName}` : ''}`;
  const summary = `Job ${jobId ?? '?'} on queue "${queueName}" exhausted ${made}/${max} attempts. Error: ${error.message}`;

  try {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true, email: true },
    });

    if (admins.length === 0) {
      logger.warn({ queueName, jobId }, 'No active admins to notify of job failure');
      return;
    }

    // In-app notifications (best-effort, parallel)
    await Promise.allSettled(
      admins.map((admin) =>
        NotificationService.create({
          userId: admin.id,
          title,
          body: summary,
          type: 'SYSTEM',
          data: {
            queueName,
            jobId: jobId ?? null,
            jobName: jobName ?? null,
            attemptsMade: made,
            maxAttempts: max,
            errorMessage: error.message,
            jobData: jobData ?? null,
          },
        }).catch((err) => {
          logger.error({ err, adminId: admin.id }, 'Failed to create admin job-failure notification');
        }),
      ),
    );

    // Ops email (single message — keep it loud but rate-limit-friendly)
    const adminEmails = admins.map((a) => a.email).filter(Boolean) as string[];
    if (adminEmails.length > 0) {
      await EmailService.sendJobFailureAlert(adminEmails, {
        queueName,
        jobId: jobId ?? 'unknown',
        jobName: jobName ?? null,
        attemptsMade: made,
        maxAttempts: max,
        errorMessage: error.message,
        errorStack: error.stack ?? null,
        jobData,
      }).catch((err) => {
        logger.error({ err }, 'Failed to send job-failure admin email');
      });
    }
  } catch (err) {
    logger.error({ err, queueName, jobId }, 'notifyAdminJobFailure pipeline error');
  }
}
