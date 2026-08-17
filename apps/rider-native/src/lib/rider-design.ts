export const riderColors = {
  brand: '#40BE89',
  ink: '#050505',
  ink2: '#111814',
  panel: '#ffffff',
  panelAlt: '#F6FAF8',
  line: '#E3EEE9',
  muted: '#626A66',
  soft: '#9AA8A1',
  green: '#40BE89',
  greenDark: '#079B61',
  greenSoft: '#EAF7F1',
  greenMist: '#F3FBF7',
  blue: '#2563EB',
  blueSoft: '#EAF1FF',
  amber: '#F5B84B',
  amberSoft: '#FFF4D9',
  red: '#EF3B2D',
  redSoft: '#FEE9E7',
  violet: '#7C3AED',
  violetSoft: '#F0EBFF',
  surface: '#F7FAF8',
  white: '#ffffff',
};

export const riderShadow = {
  shadowColor: '#0A0F0D',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.07,
  shadowRadius: 22,
  elevation: 3,
};

export function cleanLabel(value?: string | null) {
  if (!value) return 'Pending';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function statusTone(status?: string | null) {
  const normalized = (status ?? '').toUpperCase();
  if (['ONLINE', 'ACTIVE', 'ACTIVATED', 'APPROVED', 'DELIVERED', 'COMPLETED'].includes(normalized)) {
    return { background: riderColors.greenSoft, color: riderColors.greenDark, border: '#b7efd8' };
  }
  if (['ASSIGNED', 'PICKUP_EN_ROUTE', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROPOFF', 'UNDER_REVIEW', 'PENDING', 'PENDING_REVIEW'].includes(normalized)) {
    return { background: riderColors.amberSoft, color: '#9a5f05', border: '#f8d687' };
  }
  if (['OFFLINE', 'REGISTERED', 'DOCUMENTS_PENDING', 'ON_BREAK'].includes(normalized)) {
    return { background: riderColors.blueSoft, color: '#1d4ed8', border: '#bfdbfe' };
  }
  if (['REJECTED', 'FAILED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_ADMIN', 'SUSPENDED'].includes(normalized)) {
    return { background: riderColors.redSoft, color: '#b91c1c', border: '#fecaca' };
  }
  return { background: riderColors.panelAlt, color: riderColors.muted, border: riderColors.line };
}

export function dateTime(value?: string | Date | null) {
  if (!value) return 'Not set';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function compactDate(value?: string | Date | null) {
  if (!value) return 'Today';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function initials(first?: string | null, last?: string | null, fallback = 'R') {
  const value = `${first?.[0] ?? ''}${last?.[0] ?? ''}`.trim();
  return (value || fallback).slice(0, 2).toUpperCase();
}
