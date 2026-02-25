import { RiderLevel } from './enums';

// ============================================================
// XP Actions — all events that can award XP
// ============================================================

export enum XpAction {
  DELIVERY_COMPLETE = 'delivery_complete',
  ON_TIME_DELIVERY = 'on_time_delivery',
  FIVE_STAR_RATING = 'five_star_rating',
  FOUR_STAR_RATING = 'four_star_rating',
  REFERRAL = 'referral',
  STREAK_3 = 'streak_3',
  STREAK_7 = 'streak_7',
  STREAK_14 = 'streak_14',
  STREAK_30 = 'streak_30',
  FIRST_DELIVERY = 'first_delivery',
  TRAINING_COMPLETE = 'training_complete',
  PERFECT_WEEK = 'perfect_week', // 5-star every delivery in a week
  BONUS = 'bonus', // admin manual award
}

/** XP values for each action */
export const XP_VALUES: Record<XpAction, number> = {
  [XpAction.DELIVERY_COMPLETE]: 50,
  [XpAction.ON_TIME_DELIVERY]: 20,
  [XpAction.FIVE_STAR_RATING]: 30,
  [XpAction.FOUR_STAR_RATING]: 10,
  [XpAction.REFERRAL]: 100,
  [XpAction.STREAK_3]: 50,
  [XpAction.STREAK_7]: 150,
  [XpAction.STREAK_14]: 400,
  [XpAction.STREAK_30]: 1000,
  [XpAction.FIRST_DELIVERY]: 100,
  [XpAction.TRAINING_COMPLETE]: 75,
  [XpAction.PERFECT_WEEK]: 200,
  [XpAction.BONUS]: 0, // variable, set by admin
};

// ============================================================
// Badge types
// ============================================================

export type BadgeCategory = 'achievement' | 'milestone' | 'special';

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  criteria: BadgeCriteria | null;
  xpReward: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BadgeCriteria {
  action: string; // XpAction or special key
  threshold: number; // count required
}

export interface RiderBadge {
  id: string;
  riderId: string;
  badgeId: string;
  badge: Badge;
  awardedAt: Date;
  seenAt: Date | null;
}

// ============================================================
// XP Event log
// ============================================================

export interface XpEvent {
  id: string;
  riderId: string;
  action: string;
  points: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ============================================================
// Response shapes
// ============================================================

export interface GamificationProfile {
  currentLevel: RiderLevel;
  levelName: string;
  totalXp: number;
  currentLevelXp: number; // XP within current level
  nextLevelXp: number; // XP needed to reach next level
  progressPercent: number; // 0-100
  isMaxLevel: boolean;
  badges: RiderBadge[];
  unseenBadges: RiderBadge[];
  recentXp: XpEvent[];
}

export interface XpAwardResult {
  action: string;
  pointsAwarded: number;
  totalXp: number;
  previousLevel: RiderLevel;
  currentLevel: RiderLevel;
  leveledUp: boolean;
  newBadges: Badge[];
}

export interface LeaderboardEntry {
  rank: number;
  riderId: string;
  riderName: string;
  avatarUrl: string | null;
  level: RiderLevel;
  totalXp: number;
  totalDeliveries: number;
  isCurrentUser: boolean;
}

/** Level perks — what each level unlocks */
export interface LevelPerks {
  level: RiderLevel;
  name: string;
  commissionRate: number; // e.g., 15 for 15%
  perks: string[];
}

/** Commission rates by level — lower commission for higher levels */
export const LEVEL_COMMISSION_RATES: Record<RiderLevel, number> = {
  [RiderLevel.ROOKIE]: 20,
  [RiderLevel.RUNNER]: 18,
  [RiderLevel.STREAKER]: 16,
  [RiderLevel.PRO]: 14,
  [RiderLevel.ACE]: 12,
  [RiderLevel.CAPTAIN]: 10,
  [RiderLevel.LEGEND]: 8,
};

/** Level perks descriptions */
export const LEVEL_PERKS: Record<RiderLevel, string[]> = {
  [RiderLevel.ROOKIE]: ['Standard commission rate', 'Access to basic jobs'],
  [RiderLevel.RUNNER]: ['Reduced commission (18%)', 'Priority in standard dispatch'],
  [RiderLevel.STREAKER]: ['Reduced commission (16%)', 'Access to premium jobs', 'Streak bonuses'],
  [RiderLevel.PRO]: ['Reduced commission (14%)', 'Priority dispatch', 'Pro badge visible to clients'],
  [RiderLevel.ACE]: ['Reduced commission (12%)', 'High-value package access', 'Ace profile badge'],
  [RiderLevel.CAPTAIN]: ['Reduced commission (10%)', 'Mentorship eligibility', 'Captain rewards'],
  [RiderLevel.LEGEND]: ['Lowest commission (8%)', 'Legend status', 'All perks unlocked', 'VIP support'],
};

// ============================================================
// Default badge definitions (seeded)
// ============================================================

export interface BadgeSeedDefinition {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  criteria: BadgeCriteria;
  xpReward: number;
  sortOrder: number;
}

export const DEFAULT_BADGES: BadgeSeedDefinition[] = [
  // Milestones
  { slug: 'first_delivery', name: 'First Mile', description: 'Complete your first delivery', icon: '🚀', category: 'milestone', criteria: { action: 'delivery_complete', threshold: 1 }, xpReward: 100, sortOrder: 1 },
  { slug: '10_deliveries', name: 'Getting Going', description: 'Complete 10 deliveries', icon: '📦', category: 'milestone', criteria: { action: 'delivery_complete', threshold: 10 }, xpReward: 50, sortOrder: 2 },
  { slug: '50_deliveries', name: 'Half Century', description: 'Complete 50 deliveries', icon: '⚡', category: 'milestone', criteria: { action: 'delivery_complete', threshold: 50 }, xpReward: 100, sortOrder: 3 },
  { slug: '100_deliveries', name: 'Centurion', description: 'Complete 100 deliveries', icon: '💯', category: 'milestone', criteria: { action: 'delivery_complete', threshold: 100 }, xpReward: 200, sortOrder: 4 },
  { slug: '500_deliveries', name: 'Road Warrior', description: 'Complete 500 deliveries', icon: '🏆', category: 'milestone', criteria: { action: 'delivery_complete', threshold: 500 }, xpReward: 500, sortOrder: 5 },
  { slug: '1000_deliveries', name: 'Legendary', description: 'Complete 1000 deliveries', icon: '👑', category: 'milestone', criteria: { action: 'delivery_complete', threshold: 1000 }, xpReward: 1000, sortOrder: 6 },

  // Achievement
  { slug: 'five_star_10', name: 'Crowd Favorite', description: 'Receive 10 five-star ratings', icon: '⭐', category: 'achievement', criteria: { action: 'five_star_rating', threshold: 10 }, xpReward: 75, sortOrder: 10 },
  { slug: 'five_star_50', name: 'Superstar', description: 'Receive 50 five-star ratings', icon: '🌟', category: 'achievement', criteria: { action: 'five_star_rating', threshold: 50 }, xpReward: 200, sortOrder: 11 },
  { slug: 'streak_7', name: 'Week Warrior', description: 'Maintain a 7-day delivery streak', icon: '🔥', category: 'achievement', criteria: { action: 'streak_7', threshold: 1 }, xpReward: 150, sortOrder: 20 },
  { slug: 'streak_30', name: 'Iron Will', description: 'Maintain a 30-day delivery streak', icon: '💪', category: 'achievement', criteria: { action: 'streak_30', threshold: 1 }, xpReward: 1000, sortOrder: 21 },
  { slug: 'on_time_50', name: 'Punctual Pro', description: '50 on-time deliveries', icon: '⏱️', category: 'achievement', criteria: { action: 'on_time_delivery', threshold: 50 }, xpReward: 150, sortOrder: 30 },
  { slug: 'referral_5', name: 'Recruiter', description: 'Refer 5 new riders', icon: '🤝', category: 'achievement', criteria: { action: 'referral', threshold: 5 }, xpReward: 200, sortOrder: 40 },

  // Special
  { slug: 'early_adopter', name: 'Early Adopter', description: 'Joined during the launch period', icon: '🎯', category: 'special', criteria: { action: 'special', threshold: 0 }, xpReward: 100, sortOrder: 50 },
  { slug: 'perfect_week', name: 'Perfect Week', description: 'All deliveries rated 5 stars in a week', icon: '💎', category: 'special', criteria: { action: 'perfect_week', threshold: 1 }, xpReward: 200, sortOrder: 51 },
];
