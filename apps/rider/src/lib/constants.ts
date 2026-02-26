export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ??
  '';

/** Dark navigation map style for rider app */
export const MAP_STYLE = 'mapbox://styles/mapbox/navigation-night-v1';

/** Default map center: Accra, Ghana */
export const DEFAULT_CENTER: [number, number] = [-0.187, 5.603];

/** Rider location update interval in ms */
export const LOCATION_INTERVAL = 5_000;

/** Job offer countdown seconds */
export const OFFER_COUNTDOWN = 30;

/** Order status display configuration */
export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:          { label: 'Pending',       color: 'text-amber-400',  bg: 'bg-amber-400/10' },
  SEARCHING_RIDER:  { label: 'Finding Rider', color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  ASSIGNED:             { label: 'Assigned',      color: 'text-brand-400',  bg: 'bg-brand-400/10' },
  PICKUP_EN_ROUTE:      { label: 'En Route',      color: 'text-purple-400', bg: 'bg-purple-400/10' },
  AT_PICKUP:            { label: 'At Pickup',     color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  PICKED_UP:            { label: 'Picked Up',     color: 'text-cyan-400',   bg: 'bg-cyan-400/10' },
  IN_TRANSIT:           { label: 'Delivering',    color: 'text-brand-400',  bg: 'bg-brand-400/10' },
  AT_DROPOFF:           { label: 'At Dropoff',    color: 'text-violet-400', bg: 'bg-violet-400/10' },
  DELIVERED:            { label: 'Delivered',      color: 'text-accent-400', bg: 'bg-accent-400/10' },
  CANCELLED_BY_CLIENT:  { label: 'Cancelled',      color: 'text-danger-400', bg: 'bg-danger-400/10' },
  CANCELLED_BY_RIDER:   { label: 'Cancelled',      color: 'text-danger-400', bg: 'bg-danger-400/10' },
  CANCELLED_BY_ADMIN:   { label: 'Cancelled',      color: 'text-danger-400', bg: 'bg-danger-400/10' },
  FAILED:               { label: 'Failed',         color: 'text-danger-400', bg: 'bg-danger-400/10' },
};

/** Package type display labels & icons */
export const PACKAGE_TYPES: Record<string, { label: string; icon: string }> = {
  DOCUMENT:      { label: 'Document',     icon: '📄' },
  SMALL_PARCEL:  { label: 'Small Parcel', icon: '📦' },
  MEDIUM_PARCEL: { label: 'Medium Box',   icon: '📦' },
  LARGE_PARCEL:  { label: 'Large Box',    icon: '🗃️' },
  FRAGILE:       { label: 'Fragile',      icon: '⚠️' },
  FOOD:          { label: 'Food',         icon: '🍔' },
  HIGH_VALUE:    { label: 'High Value',   icon: '💎' },
};
