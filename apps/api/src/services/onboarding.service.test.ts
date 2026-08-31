import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@riderguy/database', () => ({
  prisma: {
    $transaction: vi.fn(),
    riderProfile: { findUnique: vi.fn(), update: vi.fn() },
    riderInvitation: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    riderTrainingCompletion: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from '@riderguy/database';
import { OnboardingService } from './onboarding.service';

const asMock = (value: unknown) => value as ReturnType<typeof vi.fn>;

const baseRider = {
  id: 'rider-profile-1',
  userId: 'rider-user-1',
  onboardingStatus: 'REGISTERED',
  riderChannel: null,
  requestedRiderChannel: null,
  channelVerifiedAt: null,
  applicationReviewedAt: null,
  applicationRejectionReason: null,
  isVerified: false,
  user: { email: 'rider@example.com', phone: '+233241234567' },
};

describe('OnboardingService security gates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    asMock(prisma.$transaction).mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  });

  it('lets a Rider self-select Guest but keeps the account unverified', async () => {
    asMock(prisma.riderProfile.findUnique).mockResolvedValue(baseRider);
    asMock(prisma.riderProfile.update).mockResolvedValue({ ...baseRider, riderChannel: 'GUEST' });

    await OnboardingService.selectChannel(baseRider.userId, 'GUEST');

    expect(prisma.riderProfile.update).toHaveBeenCalledWith({
      where: { id: baseRider.id },
      data: expect.objectContaining({
        riderChannel: 'GUEST',
        requestedRiderChannel: 'GUEST',
        onboardingStatus: 'DOCUMENTS_PENDING',
      }),
    });
    expect(prisma.riderProfile.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isVerified: true }),
    }));
  });

  it('does not permit self-asserted In-House status without an invitation', async () => {
    asMock(prisma.riderProfile.findUnique).mockResolvedValue(baseRider);
    asMock(prisma.riderProfile.update).mockResolvedValue(baseRider);

    await expect(OnboardingService.selectChannel(baseRider.userId, 'IN_HOUSE'))
      .rejects.toThrow('invitation code is required');

    expect(prisma.riderProfile.update).toHaveBeenCalledWith({
      where: { id: baseRider.id },
      data: expect.objectContaining({ riderChannel: null, requestedRiderChannel: 'IN_HOUSE' }),
    });
  });

  it('rejects an In-House invitation targeted to another account', async () => {
    asMock(prisma.riderProfile.findUnique).mockResolvedValue(baseRider);
    asMock(prisma.riderInvitation.findUnique).mockResolvedValue({
      id: 'invite-1',
      targetEmail: 'different@example.com',
      targetPhone: null,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(OnboardingService.selectChannel(baseRider.userId, 'IN_HOUSE', 'RGIH-VALID-CODE'))
      .rejects.toThrow('different email address');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('atomically consumes a targeted invitation before assigning In-House status', async () => {
    asMock(prisma.riderProfile.findUnique).mockResolvedValue(baseRider);
    asMock(prisma.riderInvitation.findUnique).mockResolvedValue({
      id: 'invite-1',
      targetEmail: 'rider@example.com',
      targetPhone: null,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    asMock(prisma.riderInvitation.updateMany).mockResolvedValue({ count: 1 });
    asMock(prisma.riderProfile.update).mockResolvedValue({ ...baseRider, riderChannel: 'IN_HOUSE' });

    await OnboardingService.selectChannel(baseRider.userId, 'IN_HOUSE', 'RGIH-VALID-CODE');

    expect(prisma.riderInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'invite-1', usedAt: null, revokedAt: null }),
    }));
    expect(prisma.riderProfile.update).toHaveBeenCalledWith({
      where: { id: baseRider.id },
      data: expect.objectContaining({
        riderChannel: 'IN_HOUSE',
        channelInvitationId: 'invite-1',
        onboardingStatus: 'DOCUMENTS_PENDING',
      }),
    });
  });

  it('blocks In-House approval until every persisted training module is admin-verified', async () => {
    asMock(prisma.riderProfile.findUnique).mockResolvedValue({
      ...baseRider,
      riderChannel: 'IN_HOUSE',
      user: {
        documents: [
          { type: 'NATIONAL_ID', status: 'APPROVED', createdAt: new Date() },
          { type: 'DRIVERS_LICENSE', status: 'APPROVED', createdAt: new Date() },
          { type: 'SELFIE', status: 'APPROVED', createdAt: new Date() },
        ],
      },
      vehicles: [{
        id: 'vehicle-1',
        isApproved: true,
        photoFrontUrl: 'front.jpg',
        photoBackUrl: 'back.jpg',
        photoLeftUrl: 'left.jpg',
        photoRightUrl: 'right.jpg',
      }],
      trainingCompletions: [
        { moduleKey: 'SAFETY_BASICS', verifiedAt: new Date() },
        { moduleKey: 'SERVICE_STANDARDS', verifiedAt: null },
      ],
    });

    const readiness = await OnboardingService.getApprovalReadiness(baseRider.userId);

    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toContain('Service Standards is not admin-verified');
    expect(readiness.missing).toContain('Delivery Operations is not admin-verified');
  });

  it('blocks approval unless one approved vehicle has every required photo', async () => {
    asMock(prisma.riderProfile.findUnique).mockResolvedValue({
      ...baseRider,
      riderChannel: 'GUEST',
      user: {
        documents: [
          { type: 'NATIONAL_ID', status: 'APPROVED', createdAt: new Date() },
          { type: 'DRIVERS_LICENSE', status: 'APPROVED', createdAt: new Date() },
          { type: 'SELFIE', status: 'APPROVED', createdAt: new Date() },
        ],
      },
      vehicles: [{
        id: 'vehicle-1',
        isApproved: false,
        photoFrontUrl: 'front.jpg',
        photoBackUrl: 'back.jpg',
        photoLeftUrl: 'left.jpg',
        photoRightUrl: null,
      }],
      trainingCompletions: [],
    });

    const readiness = await OnboardingService.getApprovalReadiness(baseRider.userId);

    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toContain('No delivery vehicle has been approved');
    expect(readiness.missing).toContain(
      'Front, back, left, and right photos are required for an approved vehicle',
    );
  });
});
