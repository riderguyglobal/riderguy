/**
 * Format a currency amount with proper locale and currency symbol.
 */
export function formatCurrency(amount: number, currency = 'GHS', locale = 'en-GH'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a phone number for display (add spaces).
 */
export function formatPhone(phone: string): string {
  // Remove non-digit chars except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+233')) {
    // Ghanaian format: +233 XX XXX XXXX
    return `+233 ${cleaned.slice(4, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
  return cleaned;
}

/**
 * Format a distance in km for display.
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

/**
 * Format duration in minutes for display.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Truncate a string to a max length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 1)}…`;
}

/**
 * Generate initials from a name (e.g., "John Doe" → "JD").
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Format a large number with compact notation (e.g., 1200 → "1.2K").
 */
export function formatCompactNumber(num: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
}

/**
 * Format a rating as a display string (e.g., 4.7 → "4.7").
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Format a percentage (e.g., 0.95 → "95%").
 */
export function formatPercentage(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
