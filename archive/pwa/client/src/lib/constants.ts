/* eslint-disable turbo/no-undeclared-env-vars */

// AU-14: mirror rider app — fail-fast in production builds when the API URL
// is missing, instead of silently falling back to localhost.
const isProd = process.env.NODE_ENV === 'production';
export const API_BASE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url && isProd) {
    throw new Error('NEXT_PUBLIC_API_URL is required in production');
  }
  return url ?? 'http://localhost:4000/api/v1';
})();

// CLI-11: Explicit WebSocket URL constant. Previously consumers stripped
// '/api/v1' from API_BASE_URL inline (`use-socket.ts`), which broke when
// the API was hosted under a different prefix. Keep a single source of
// truth and let `NEXT_PUBLIC_API_WS_URL` override for cross-origin setups.
export const API_WS_URL =
  process.env.NEXT_PUBLIC_API_WS_URL ||
  API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const GOOGLE_MAPS_API_KEY: string =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export const GOOGLE_MAPS_MAP_ID: string =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'riderguy-client';

export const PAYSTACK_PUBLIC_KEY: string =
  process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

// CLI-09: Maximum service distance for client-side validation. Sourced
// from env so ops can widen/narrow the catchment without redeploying
// the bundle. Falls back to 50 km (current Accra radius).
export const MAX_SERVICE_DISTANCE_KM: number = (() => {
  const raw = process.env.NEXT_PUBLIC_MAX_SERVICE_DISTANCE_KM;
  if (!raw) return 50;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 50;
})();

/** Accra default center */
export const DEFAULT_CENTER: [number, number] = [-0.187, 5.603];

export const PACKAGE_TYPES = [
  { value: 'DOCUMENT', label: 'Document', emoji: '📄' },
  { value: 'SMALL_PARCEL', label: 'Small Parcel', emoji: '📦' },
  { value: 'MEDIUM_PARCEL', label: 'Medium Parcel', emoji: '📫' },
  { value: 'LARGE_PARCEL', label: 'Large Parcel', emoji: '🗳️' },
  { value: 'FRAGILE', label: 'Fragile', emoji: '🔮' },
  { value: 'FOOD', label: 'Food', emoji: '🍜' },
  { value: 'HIGH_VALUE', label: 'High Value', emoji: '💎' },
  { value: 'OTHER', label: 'Other', emoji: '📋' },
] as const;

/** Schedule types with labels and discount info */
export const SCHEDULE_TYPES = [
  { value: 'NOW', label: 'Now', description: 'Pickup ASAP', discount: null },
  { value: 'SAME_DAY', label: 'Same Day', description: 'Later today', discount: null },
  { value: 'NEXT_DAY', label: 'Next Day', description: 'Tomorrow', discount: '5% off' },
  { value: 'RECURRING', label: 'Recurring', description: 'Regular schedule', discount: '10% off' },
] as const;

export const ORDER_STATUS_CONFIG: Record<string, {
  label: string;
  /** Solid badge CSS class (text-white always) */
  badgeClass: string;
  /** Dot indicator color class */
  dotClass: string;
  /** Whether this is an active (in-progress) status */
  isActive: boolean;
  /** Step index in the progress bar (0-5) */
  step: number;
  /** Short human description for tracking screen */
  description: string;
}> = {
  PENDING: {
    label: 'Finding Rider',
    badgeClass: 'badge badge-pending',
    dotClass: 'status-dot amber',
    isActive: true,
    step: 0,
    description: 'Looking for a rider near you...',
  },
  SEARCHING_RIDER: {
    label: 'Searching',
    badgeClass: 'badge badge-searching',
    dotClass: 'status-dot amber',
    isActive: true,
    step: 0,
    description: 'Looking for a rider near you...',
  },
  ASSIGNED: {
    label: 'Rider Assigned',
    badgeClass: 'badge badge-assigned',
    dotClass: 'status-dot live',
    isActive: true,
    step: 1,
    description: 'Your rider is heading to pickup',
  },
  PICKUP_EN_ROUTE: {
    label: 'En Route',
    badgeClass: 'badge badge-enroute',
    dotClass: 'status-dot live',
    isActive: true,
    step: 2,
    description: 'Rider is on the way to pickup',
  },
  AT_PICKUP: {
    label: 'At Pickup',
    badgeClass: 'badge badge-enroute',
    dotClass: 'status-dot live',
    isActive: true,
    step: 2,
    description: 'Rider arrived at pickup point',
  },
  PICKED_UP: {
    label: 'Picked Up',
    badgeClass: 'badge badge-transit',
    dotClass: 'status-dot live',
    isActive: true,
    step: 3,
    description: 'Package collected, heading to you',
  },
  IN_TRANSIT: {
    label: 'In Transit',
    badgeClass: 'badge badge-transit',
    dotClass: 'status-dot live',
    isActive: true,
    step: 3,
    description: 'Your package is on the way',
  },
  AT_DROPOFF: {
    label: 'Arriving',
    badgeClass: 'badge badge-atdropoff',
    dotClass: 'status-dot live',
    isActive: true,
    step: 4,
    description: 'Rider has arrived at destination',
  },
  DELIVERED: {
    label: 'Delivered',
    badgeClass: 'badge badge-delivered',
    dotClass: 'status-dot offline',
    isActive: false,
    step: 5,
    description: 'Package delivered successfully',
  },
  CANCELLED_BY_CLIENT: {
    label: 'Cancelled',
    badgeClass: 'badge badge-cancelled',
    dotClass: 'status-dot red',
    isActive: false,
    step: -1,
    description: 'You cancelled this delivery',
  },
  CANCELLED_BY_RIDER: {
    label: 'Cancelled',
    badgeClass: 'badge badge-cancelled',
    dotClass: 'status-dot red',
    isActive: false,
    step: -1,
    description: 'Rider cancelled the delivery',
  },
  CANCELLED_BY_ADMIN: {
    label: 'Cancelled',
    badgeClass: 'badge badge-cancelled',
    dotClass: 'status-dot red',
    isActive: false,
    step: -1,
    description: 'Delivery was cancelled',
  },
  FAILED: {
    label: 'Failed',
    badgeClass: 'badge badge-failed',
    dotClass: 'status-dot red',
    isActive: false,
    step: -1,
    description: 'Delivery could not be completed',
  },
};

/** Active statuses — order is live and needs tracking */
export const ACTIVE_STATUSES = new Set([
  'PENDING', 'SEARCHING_RIDER', 'ASSIGNED',
  'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP',
  'IN_TRANSIT', 'AT_DROPOFF',
]);

/** Terminal statuses — order is finished */
export const TERMINAL_STATUSES = new Set([
  'DELIVERED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_RIDER',
  'CANCELLED_BY_ADMIN', 'FAILED',
]);

/** Progress bar step labels */
export const TRACKING_STEPS = [
  { key: 'placed',   label: 'Placed' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'pickup',   label: 'Pickup' },
  { key: 'transit',  label: 'Transit' },
  { key: 'arriving', label: 'Arriving' },
  { key: 'done',     label: 'Done' },
];
