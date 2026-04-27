/* eslint-disable turbo/no-undeclared-env-vars */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// CLI-11: Explicit WebSocket URL constant. Previously consumers stripped
// '/api/v1' from API_BASE_URL inline (`use-socket.ts`), which broke when
// the API was hosted under a different prefix. Keep a single source of
// truth and let `NEXT_PUBLIC_API_WS_URL` override for cross-origin setups.
export const API_WS_URL =
  process.env.NEXT_PUBLIC_API_WS_URL ||
  API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const GOOGLE_MAPS_API_KEY: string =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Finding Rider', color: 'text-amber-600', bg: 'bg-amber-50' },
  SEARCHING_RIDER: { label: 'Searching', color: 'text-amber-600', bg: 'bg-amber-50' },
  ASSIGNED: { label: 'Rider Assigned', color: 'text-blue-600', bg: 'bg-blue-50' },
  PICKUP_EN_ROUTE: { label: 'Rider En Route', color: 'text-purple-600', bg: 'bg-purple-50' },
  AT_PICKUP: { label: 'At Pickup', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  PICKED_UP: { label: 'Picked Up', color: 'text-brand-600', bg: 'bg-brand-50' },
  IN_TRANSIT: { label: 'On The Way', color: 'text-brand-600', bg: 'bg-brand-50' },
  AT_DROPOFF: { label: 'Arrived', color: 'text-accent-600', bg: 'bg-accent-50' },
  DELIVERED: { label: 'Delivered', color: 'text-accent-600', bg: 'bg-accent-50' },
  CANCELLED_BY_CLIENT: { label: 'Cancelled', color: 'text-danger-600', bg: 'bg-danger-50' },
  CANCELLED_BY_RIDER: { label: 'Cancelled', color: 'text-danger-600', bg: 'bg-danger-50' },
  CANCELLED_BY_ADMIN: { label: 'Cancelled', color: 'text-danger-600', bg: 'bg-danger-50' },
  FAILED: { label: 'Failed', color: 'text-danger-600', bg: 'bg-danger-50' },
};
