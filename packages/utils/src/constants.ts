/** Maximum file size for uploads (10MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Allowed image MIME types */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Allowed document MIME types */
export const ALLOWED_DOCUMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/** Default pagination page size */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum pagination page size */
export const MAX_PAGE_SIZE = 100;

/** OTP expiry in minutes */
export const OTP_EXPIRY_MINUTES = 5;

/** Maximum OTP attempts before lockout */
export const MAX_OTP_ATTEMPTS = 5;

/** OTP lockout duration in minutes */
export const OTP_LOCKOUT_MINUTES = 30;

/** JWT access token expiry */
export const JWT_ACCESS_EXPIRY = '15m';

/** JWT refresh token expiry */
export const JWT_REFRESH_EXPIRY = '7d';

/** Minimum withdrawal amount */
export const MIN_WITHDRAWAL_AMOUNT = 5; // in GHS

/** Maximum avatar file size (2MB) */
export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

/** Default currency */
export const DEFAULT_CURRENCY = 'GHS';

/** Default surge multiplier (no surge) */
export const DEFAULT_SURGE_MULTIPLIER = 1.0;

/** Maximum surge multiplier — hard cap to protect affordability */
export const MAX_SURGE_MULTIPLIER = 1.8;

/** Service fee rate (10% of subtotal, shown separately to the client) */
export const SERVICE_FEE_RATE = 0.10;

/**
 * Package type to price multiplier.
 * See docs/PRICING_STRATEGY.md §5 for rationale.
 */
export const PACKAGE_TYPE_MULTIPLIERS: Record<string, number> = {
  DOCUMENT: 1.00,
  SMALL_PARCEL: 1.00,
  MEDIUM_PARCEL: 1.15,
  LARGE_PARCEL: 1.40,
  FOOD: 1.10,
  FRAGILE: 1.25,
  HIGH_VALUE: 1.50,
};

/**
 * Road distance factor — multiplied by Haversine (straight-line) distance
 * to approximate actual road distance without a Directions API call.
 * See docs/PRICING_STRATEGY.md §7.
 */
export const ROAD_FACTOR_DENSE_URBAN = 1.4;
export const ROAD_FACTOR_URBAN = 1.3;
export const ROAD_FACTOR_SUBURBAN = 1.2;
export const ROAD_FACTOR_HIGHWAY = 1.15;
export const ROAD_FACTOR_DEFAULT = 1.3;

/** Average motorcycle speed by zone type (km/h) for ETA calculation */
export const AVG_SPEED_URBAN = 20;
export const AVG_SPEED_SUBURBAN = 25;
export const AVG_SPEED_HIGHWAY = 35;
export const AVG_SPEED_DEFAULT = 20;

/** Minimum estimated duration in minutes (even for very short trips) */
export const MIN_DURATION_MINUTES = 10;

/** Multi-stop: surcharge per additional stop beyond the standard pickup→dropoff */
export const STOP_SURCHARGE_GHS = 3.00;

/** Maximum number of stops per order */
export const MAX_STOPS_PER_ORDER = 5;

/** Scheduled delivery discount multipliers */
export const SCHEDULED_DISCOUNT = {
  SAME_DAY: 1.00,
  NEXT_DAY: 0.95,
  RECURRING: 0.90,
} as const;

/** Cancellation fees in GHS */
export const CANCELLATION_FEES = {
  BEFORE_ASSIGNMENT: 0,
  AFTER_ASSIGNMENT: 3.00,
  AFTER_PICKUP: 5.00,
} as const;

/** Suggested tip amounts in GHS */
export const SUGGESTED_TIP_AMOUNTS = [2, 5, 10] as const;

/** Rider location update interval in milliseconds */
export const LOCATION_UPDATE_INTERVAL_MS = 5000;

/** Rider location considered stale after this many seconds */
export const LOCATION_STALE_THRESHOLD_SECONDS = 60;
