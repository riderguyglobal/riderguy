import { prisma } from '@riderguy/database';
import type { UpdateProfileInput } from '@riderguy/validators';
import { ApiError } from '../lib/api-error';
import { logger } from '../lib/logger';
import { AuthService } from './auth.service';

const USER_PROFILE_SELECT = {
  id: true,
  phone: true,
  email: true,
  emailVerified: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
  roles: true,
  status: true,
  createdAt: true,
} as const;

export class UserProfileService {
  static async update(userId: string, input: UpdateProfileInput) {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true, emailVerified: true },
      });
      if (!current) throw ApiError.notFound('User not found');

      const requestedEmail = input.email;
      const emailChanged =
        requestedEmail !== undefined && requestedEmail !== current.email?.trim().toLowerCase();

      // Old verification links are user-scoped rather than email-scoped. They
      // must be invalidated in the same transaction as the email change so an
      // old link cannot normally verify the replacement address.
      if (emailChanged) {
        await tx.emailToken.updateMany({
          where: { userId, purpose: 'EMAIL_VERIFICATION', usedAt: null },
          data: { usedAt: new Date() },
        });
      }

      const user = await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(requestedEmail !== undefined ? { email: requestedEmail } : {}),
          ...(emailChanged ? { emailVerified: false } : {}),
          ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        },
        select: USER_PROFILE_SELECT,
      });

      return {
        user,
        emailChanged,
        emailVerificationRequired:
          requestedEmail !== undefined && (emailChanged || !current.emailVerified),
      };
    });

    let emailVerificationRequested = false;
    let emailVerificationRequestFailed = false;
    if (result.emailVerificationRequired) {
      try {
        // This prepares a fresh token and requests delivery through the
        // existing Rider/Client-aware flow. Delivery itself is asynchronous,
        // so the response intentionally does not claim that an email arrived.
        await AuthService.sendVerificationEmail(result.user.id);
        emailVerificationRequested = true;
      } catch (error) {
        // The profile transaction has already committed. A follow-up token
        // failure must be observable without falsely reporting that the
        // profile update itself failed.
        emailVerificationRequestFailed = true;
        logger.error(
          { error, userId: result.user.id },
          'Profile updated but email verification request preparation failed',
        );
      }
    }

    return { ...result, emailVerificationRequested, emailVerificationRequestFailed };
  }
}
