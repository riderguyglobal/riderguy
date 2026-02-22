import crypto from 'node:crypto';

/**
 * Generate a unique order number: RG-YYYY-XXXXXX
 */
export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
  return `RG-${year}-${random}`;
}

/**
 * Generate a 6-digit numeric OTP.
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generate a unique referral code for partners.
 */
export function generateReferralCode(prefix = 'RG'): string {
  const random = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
  return `${prefix}-${random}`;
}

/**
 * Generate a 6-digit delivery PIN code.
 */
export function generateDeliveryPin(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generate a slug from a string (e.g., "My Zone Name" → "my-zone-name").
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
