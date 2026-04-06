import {
  RiderAvailability,
  RiderLevel,
  RiderOnboardingStatus,
  VehicleType,
} from './enums';

/** Full rider profile — extends base user with rider-specific data */
export interface RiderProfile {
  id: string;
  userId: string;
  onboardingStatus: RiderOnboardingStatus;
  availability: RiderAvailability;
  currentLevel: RiderLevel;
  totalXp: number;
  totalDeliveries: number;
  averageRating: number;
  totalRatings: number;
  completionRate: number;
  onTimeRate: number;
  currentZoneId: string | null;
  preferredVehicleType: VehicleType | null;
  isVerified: boolean;
  activatedAt: Date | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  lastLocationUpdate: Date | null;
  rewardPoints: number;
  referredByPartnerId: string | null;
  // Presence tracking
  lastHeartbeat: Date | null;
  socketId: string | null;
  isConnected: boolean;
  sessionStartedAt: Date | null;
  totalOnlineSeconds: number;
  connectionQuality: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Rider location data from GPS tracking */
export interface RiderLocationData {
  riderId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: Date;
}

/** Rider stats for performance dashboard */
export interface RiderStats {
  riderId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  totalEarnings: number;
  totalTips: number;
  averageRating: number;
  onTimeRate: number;
  completionRate: number;
  averageDeliveryTime: number; // minutes
  peakHour: number; // 0-23
  topZone: string | null;
}

/** XP thresholds for each rider level */
export const RIDER_LEVEL_THRESHOLDS: Record<RiderLevel, number> = {
  [RiderLevel.ROOKIE]: 0,
  [RiderLevel.RUNNER]: 500,
  [RiderLevel.STREAKER]: 2000,
  [RiderLevel.PRO]: 5000,
  [RiderLevel.ACE]: 12000,
  [RiderLevel.CAPTAIN]: 25000,
  [RiderLevel.LEGEND]: 50000,
};

/** Level display names */
export const RIDER_LEVEL_NAMES: Record<RiderLevel, string> = {
  [RiderLevel.ROOKIE]: 'Rookie',
  [RiderLevel.RUNNER]: 'Runner',
  [RiderLevel.STREAKER]: 'Streaker',
  [RiderLevel.PRO]: 'Pro',
  [RiderLevel.ACE]: 'Ace',
  [RiderLevel.CAPTAIN]: 'Captain',
  [RiderLevel.LEGEND]: 'Legend',
};
