/**
 * Centralized order status groupings.
 * Use these instead of hardcoding status arrays throughout the app.
 */

/** Statuses where the order is still active / in-progress */
export const ACTIVE_STATUSES = new Set([
  'PENDING',
  'SEARCHING_RIDER',
  'ASSIGNED',
  'PICKUP_EN_ROUTE',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DROPOFF',
] as const);

/** Statuses representing terminal / cancelled / failed states */
export const TERMINAL_STATUSES = new Set([
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_RIDER',
  'CANCELLED_BY_ADMIN',
  'FAILED',
] as const);

/** Check if a status represents an active order */
export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status as any);
}

/** Check if a status is cancelled or failed */
export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status as any);
}
