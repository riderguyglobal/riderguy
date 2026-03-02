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
  OTHER: 1.00,
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

// ── Time-of-day pricing multipliers ─────────────────────────
export const TIME_OF_DAY_MULTIPLIERS: Record<string, number> = {
  // Hour ranges → multiplier
  EARLY_MORNING: 1.0,     // 06:00–08:00
  MORNING: 1.0,           // 08:00–11:00
  LUNCH_RUSH: 1.1,        // 11:00–14:00
  AFTERNOON: 1.0,         // 14:00–16:00
  EVENING_RUSH: 1.15,     // 16:00–19:00
  LATE_EVENING: 1.05,     // 19:00–22:00
  NIGHT: 1.2,             // 22:00–06:00
};

/** Returns the time-of-day multiplier for a given hour (0–23) */
export function getTimeOfDayMultiplier(hour: number): number {
  if (hour >= 22 || hour < 6) return TIME_OF_DAY_MULTIPLIERS.NIGHT!;
  if (hour >= 6 && hour < 8) return TIME_OF_DAY_MULTIPLIERS.EARLY_MORNING!;
  if (hour >= 8 && hour < 11) return TIME_OF_DAY_MULTIPLIERS.MORNING!;
  if (hour >= 11 && hour < 14) return TIME_OF_DAY_MULTIPLIERS.LUNCH_RUSH!;
  if (hour >= 14 && hour < 16) return TIME_OF_DAY_MULTIPLIERS.AFTERNOON!;
  if (hour >= 16 && hour < 19) return TIME_OF_DAY_MULTIPLIERS.EVENING_RUSH!;
  return TIME_OF_DAY_MULTIPLIERS.LATE_EVENING!;
}

// ── Weather-based pricing multipliers ───────────────────────
export const WEATHER_MULTIPLIERS: Record<string, number> = {
  CLEAR: 1.0,
  CLOUDY: 1.0,
  LIGHT_RAIN: 1.1,
  HEAVY_RAIN: 1.25,
  STORM: 1.4,
};

// ── Express / priority delivery ─────────────────────────────
export const EXPRESS_MULTIPLIER = 1.5;       // 50% premium for express
export const EXPRESS_MAX_DISTANCE_KM = 15;   // Express only within 15 km

// ── Package weight surcharges (GHS) ─────────────────────────
export const WEIGHT_SURCHARGES: Record<string, number> = {
  LIGHT: 0,        // 0–5 kg
  MEDIUM: 2.00,    // 5–10 kg
  HEAVY: 5.00,     // 10–20 kg
  VERY_HEAVY: 10.00, // 20–30 kg (motorcycle limit)
};
export const MAX_PACKAGE_WEIGHT_KG = 30;

export type WeightCategory = 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'VERY_HEAVY';

/** Returns weight category from kg */
export function getWeightCategory(kg: number): WeightCategory {
  if (kg <= 5) return 'LIGHT';
  if (kg <= 10) return 'MEDIUM';
  if (kg <= 20) return 'HEAVY';
  return 'VERY_HEAVY';
}

// ── Wait time charging ──────────────────────────────────────
export const WAIT_TIME_FREE_MINUTES = 5;       // Free wait at pickup/dropoff
export const WAIT_TIME_RATE_PER_MINUTE = 0.50;  // GHS per minute after free period
export const MAX_WAIT_TIME_CHARGE = 15.00;       // Cap per stop (GHS)

// ── Payment method service fee adjustments ──────────────────
export const PAYMENT_METHOD_FEE_RATES: Record<string, number> = {
  MOBILE_MONEY: 0.10,    // standard 10%
  CARD: 0.12,            // 12% — higher processing cost
  WALLET: 0.08,          // 8% — cheapest, pre-funded
  CASH: 0.10,            // standard 10%
  BANK_TRANSFER: 0.10,   // standard 10%
};

// ── Cross-zone / out-of-zone premium ────────────────────────
export const CROSS_ZONE_MULTIPLIER = 1.1;    // 10% premium for cross-zone
export const OUT_OF_ZONE_MULTIPLIER = 1.2;   // 20% premium for out-of-zone drops

// ── Dynamic surge thresholds (demand:supply ratio) ──────────
export const SURGE_THRESHOLDS = {
  LEVEL_0: { ratio: 0, multiplier: 1.0 },    // Normal
  LEVEL_1: { ratio: 2, multiplier: 1.2 },    // 2+ orders per rider
  LEVEL_2: { ratio: 4, multiplier: 1.4 },    // 4+ orders per rider
  LEVEL_3: { ratio: 6, multiplier: 1.6 },    // 6+ orders per rider
  LEVEL_4: { ratio: 8, multiplier: 1.8 },    // 8+ orders per rider (MAX)
} as const;

// ── Business volume discounts ───────────────────────────────
export const BUSINESS_VOLUME_DISCOUNTS: Array<{ minOrders: number; discount: number }> = [
  { minOrders: 0, discount: 0 },
  { minOrders: 51, discount: 0.05 },    // 5% off for 51–200 monthly orders
  { minOrders: 201, discount: 0.08 },   // 8% off for 201–500
  { minOrders: 500, discount: 0.12 },   // 12% off for 500+
];

/** Get business discount based on monthly order count */
export function getBusinessDiscount(monthlyOrders: number): number {
  let discount = 0;
  for (const tier of BUSINESS_VOLUME_DISCOUNTS) {
    if (monthlyOrders >= tier.minOrders) discount = tier.discount;
  }
  return discount;
}

// ── Rider distance to pickup compensation ───────────────────
export const RIDER_PICKUP_DISTANCE_FREE_KM = 2;     // First 2 km to pickup = no extra
export const RIDER_PICKUP_DISTANCE_RATE = 1.00;     // GHS per km beyond free distance

/** Rider location update interval in milliseconds */
export const LOCATION_UPDATE_INTERVAL_MS = 5000;

/** Rider location considered stale after this many seconds */
export const LOCATION_STALE_THRESHOLD_SECONDS = 60;
