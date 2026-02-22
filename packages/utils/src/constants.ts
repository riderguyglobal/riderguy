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
export const MIN_WITHDRAWAL_AMOUNT = 500; // in NGN

/** Maximum avatar file size (2MB) */
export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

/** Default currency */
export const DEFAULT_CURRENCY = 'NGN';

/** Default surge multiplier (no surge) */
export const DEFAULT_SURGE_MULTIPLIER = 1.0;

/** Package type to price multiplier */
export const PACKAGE_TYPE_MULTIPLIERS: Record<string, number> = {
  DOCUMENT: 1.0,
  SMALL_PARCEL: 1.0,
  MEDIUM_PARCEL: 1.2,
  LARGE_PARCEL: 1.5,
  FOOD: 1.1,
  FRAGILE: 1.3,
  HIGH_VALUE: 1.5,
};

/** Rider location update interval in milliseconds */
export const LOCATION_UPDATE_INTERVAL_MS = 5000;

/** Rider location considered stale after this many seconds */
export const LOCATION_STALE_THRESHOLD_SECONDS = 60;
