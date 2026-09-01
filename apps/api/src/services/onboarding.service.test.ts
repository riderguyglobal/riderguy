import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@riderguy/database', () => ({
  prisma: {
    $transaction: vi.fn(),
    riderProfile: { findUnique: vi.fn(), update: vi.fn() },
    riderInvitation: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    riderTrainingCompletion: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock('./email.service', () => ({
  EmailService: { sendInHouseInvitation: vi.fn() },
}));

import { prisma } from '@riderguy/database';
import { EmailService } from './email.service';
import { OnboardingService } from './onboarding.service';
import { SmsService } from './sms.service';

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
    asMock(EmailService.sendInHouseInvitation).mockResolvedValue(true);
    asMock(SmsService.sendInHouseInvitation).mockResolvedValue(true);
  });

  it('generates a targeted one-time invitation and delivers it without persisting plaintext', async () => {
    asMock(prisma.riderInvitation.create).mockResolvedValue({
      id: 'invite-1',
      targetEmail: 'rider@example.com',
      targetPhone: null,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      createdAt: new Date(),
    });

    const result = await OnboardingService.createInHouseInvitation('admin-1', {
      email: 'RIDER@EXAMPLE.COM',
      expiresInDays: 7,
    });

    expect(prisma.riderInvitation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        targetEmail: 'rider@example.com',
        targetPhone: null,
        createdById: 'admin-1',
        codeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }));
    expect(prisma.riderInvitation.create).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ code: expect.anything() }),
    }));
    expect(EmailService.sendInHouseInvitation).toHaveBeenCalledWith(
      'rider@example.com',
      expect.stringMatching(/^RGIH-[A-F0-9]{24}$/),
      expect.any(Date),
    );
    expect(SmsService.sendInHouseInvitation).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'invite-1',
      delivery: { email: 'SENT', sms: 'NOT_REQUESTED' },
    });
    expect(result.code).toMatch(/^RGIH-[A-F0-9]{24}$/);
  });

  it('returns the one-time code to the admin when automatic delivery fails', async () => {
    asMock(prisma.riderInvitation.create).mockResolvedValue({
      id: 'invite-2',
      targetEmail: null,
      targetPhone: '+233241234567',
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      createdAt: new Date(),
    });
    asMock(SmsService.sendInHouseInvitation).mockResolvedValue(false);

    const result = await OnboardingService.createInHouseInvitation('admin-1', {
      phone: '0241234567',
    });

    expect(SmsService.sendInHouseInvitation).toHaveBeenCalledWith(
      '+233241234567',
      expect.stringMatching(/^RGIH-[A-F0-9]{24}$/),
      expect.any(Date),
    );
    expect(result.delivery).toEqual({ email: 'NOT_REQUESTED', sms: 'FAILED' });
    expect(result.code).toMatch(/^RGIH-[A-F0-9]{24}$/);
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
        reviewStatus: 'APPROVED',
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

  it('treats a rejected or unapproved vehicle as not ready even when all photos exist', async () => {
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
        reviewStatus: 'PENDING',
        photoFrontUrl: 'front.jpg',
        photoBackUrl: 'back.jpg',
        photoLeftUrl: 'left.jpg',
        photoRightUrl: 'right.jpg',
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

  it('blocks readiness when an approved vehicle is missing any required photo', async () => {
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
        isApproved: true,
        reviewStatus: 'APPROVED',
        photoFrontUrl: 'front.jpg',
        photoBackUrl: 'back.jpg',
        photoLeftUrl: 'left.jpg',
        photoRightUrl: null,
      }],
      trainingCompletions: [],
    });

    const readiness = await OnboardingService.getApprovalReadiness(baseRider.userId);

    expect(readiness.ready).toBe(false);
    expect(readiness.missing).not.toContain('No delivery vehicle has been approved');
    expect(readiness.missing).toContain(
      'Front, back, left, and right photos are required for an approved vehicle',
    );
  });

  it('allows readiness when a Guest Rider has one approved vehicle with all four photos', async () => {
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
        isApproved: true,
        reviewStatus: 'APPROVED',
        photoFrontUrl: 'front.jpg',
        photoBackUrl: 'back.jpg',
        photoLeftUrl: 'left.jpg',
        photoRightUrl: 'right.jpg',
      }],
      trainingCompletions: [],
    });

    const readiness = await OnboardingService.getApprovalReadiness(baseRider.userId);

    expect(readiness).toMatchObject({ ready: true, missing: [] });
  });

  it('revokes work access when an activated Rider no longer has an approved vehicle', async () => {
    asMock(prisma.riderProfile.findUnique).mockResolvedValue({
      ...baseRider,
      onboardingStatus: 'ACTIVATED',
      isVerified: true,
      riderChannel: 'GUEST',
      referralCode: 'RG-TEST',
      user: {
        email: 'rider@example.com',
        phone: '+233241234567',
        status: 'ACTIVE',
        documents: [],
      },
      vehicles: [{
        id: 'vehicle-1',
        reviewStatus: 'REJECTED',
        photoFrontUrl: 'front.jpg',
        photoBackUrl: 'back.jpg',
        photoLeftUrl: 'left.jpg',
        photoRightUrl: 'right.jpg',
      }],
      trainingCompletions: [],
    });

    const progress = await OnboardingService.getProgress(baseRider.userId);

    expect(progress.canAccessWork).toBe(false);
  });
});
