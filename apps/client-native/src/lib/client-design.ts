export const PACKAGE_TYPES = [
  { value: 'DOCUMENT', label: 'Document', shortLabel: 'Document', icon: 'document-text-outline' },
  { value: 'SMALL_PARCEL', label: 'Small Parcel', shortLabel: 'Small', icon: 'cube-outline' },
  { value: 'MEDIUM_PARCEL', label: 'Medium Parcel', shortLabel: 'Medium', icon: 'cube' },
  { value: 'LARGE_PARCEL', label: 'Large Parcel', shortLabel: 'Large', icon: 'albums-outline' },
  { value: 'FRAGILE', label: 'Fragile', shortLabel: 'Fragile', icon: 'warning-outline' },
  { value: 'FOOD', label: 'Food', shortLabel: 'Food', icon: 'fast-food-outline' },
  { value: 'HIGH_VALUE', label: 'High Value', shortLabel: 'Value', icon: 'diamond-outline' },
  { value: 'OTHER', label: 'Other', shortLabel: 'Other', icon: 'file-tray-outline' },
] as const;

export const SCHEDULE_TYPES = [
  { value: 'NOW', label: 'Now', description: 'Pickup ASAP', discount: null },
  { value: 'SAME_DAY', label: 'Same Day', description: 'Later today', discount: null },
  { value: 'NEXT_DAY', label: 'Next Day', description: 'Tomorrow', discount: '5% off' },
  { value: 'RECURRING', label: 'Recurring', description: 'Regular schedule', discount: '10% off' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'MOBILE_MONEY', label: 'MoMo' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'WALLET', label: 'Wallet' },
] as const;

export const ACTIVE_STATUSES = new Set([
  'PENDING',
  'SEARCHING_RIDER',
  'ASSIGNED',
  'PICKUP_EN_ROUTE',
  'AT_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DROPOFF',
]);

export const ORDER_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; solid: string; step: number }> = {
  PENDING: { label: 'Finding Rider', bg: '#FEF3C7', text: '#92400E', solid: '#F59E0B', step: 0 },
  SEARCHING_RIDER: { label: 'Searching', bg: '#FEF3C7', text: '#92400E', solid: '#F59E0B', step: 0 },
  ASSIGNED: { label: 'Rider Assigned', bg: '#EEF2FF', text: '#4338CA', solid: '#6366F1', step: 1 },
  PICKUP_EN_ROUTE: { label: 'En Route', bg: '#EFF6FF', text: '#1D4ED8', solid: '#3B82F6', step: 2 },
  AT_PICKUP: { label: 'At Pickup', bg: '#EFF6FF', text: '#1D4ED8', solid: '#3B82F6', step: 2 },
  PICKED_UP: { label: 'Picked Up', bg: '#DBEAFE', text: '#1D4ED8', solid: '#3B82F6', step: 3 },
  IN_TRANSIT: { label: 'In Transit', bg: '#DBEAFE', text: '#1D4ED8', solid: '#3B82F6', step: 3 },
  AT_DROPOFF: { label: 'Arriving', bg: '#DCFCE7', text: '#15803D', solid: '#22C55E', step: 4 },
  DELIVERED: { label: 'Delivered', bg: '#DCFCE7', text: '#15803D', solid: '#16A34A', step: 5 },
  CANCELLED_BY_CLIENT: { label: 'Cancelled', bg: '#FEE2E2', text: '#B91C1C', solid: '#EF4444', step: -1 },
  CANCELLED_BY_RIDER: { label: 'Cancelled', bg: '#FEE2E2', text: '#B91C1C', solid: '#EF4444', step: -1 },
  CANCELLED_BY_ADMIN: { label: 'Cancelled', bg: '#FEE2E2', text: '#B91C1C', solid: '#EF4444', step: -1 },
  CANCELLED: { label: 'Cancelled', bg: '#FEE2E2', text: '#B91C1C', solid: '#EF4444', step: -1 },
  FAILED: { label: 'Failed', bg: '#FEE2E2', text: '#B91C1C', solid: '#EF4444', step: -1 },
};

export function formatOrderDate(value?: string | Date) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function normalizeOrderTotal(order: any) {
  return order?.totalPrice ?? order?.totalAmount ?? order?.estimatedTotalPrice ?? order?.amount ?? 0;
}

export function getOrderStatus(status?: string) {
  return ORDER_STATUS_CONFIG[status ?? ''] ?? {
    label: status?.replace(/_/g, ' ') || 'Pending',
    bg: '#F3F4F6',
    text: '#6B7280',
    solid: '#9CA3AF',
    step: 0,
  };
}
