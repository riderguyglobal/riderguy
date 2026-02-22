import { PartnerTier } from './enums';

/** Referral partner profile */
export interface PartnerProfile {
  id: string;
  userId: string;
  referralCode: string;
  tier: PartnerTier;
  totalRecruits: number;
  activeRecruits: number;
  totalCommissionEarned: number;
  pendingCommission: number;
  signUpBonusRate: number;
  activationBonusRate: number;
  ongoingCommissionRate: number; // percentage
  ongoingCommissionDurationDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A partner's recruited rider record */
export interface PartnerRecruitment {
  id: string;
  partnerId: string;
  riderId: string;
  riderUserId: string;
  riderName: string;
  signUpBonusPaid: boolean;
  activationBonusPaid: boolean;
  ongoingCommissionEndsAt: Date | null;
  totalCommissionEarned: number;
  createdAt: Date;
}
