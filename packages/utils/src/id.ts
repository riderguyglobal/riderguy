/* eslint-disable @typescript-eslint/no-require-imports */

// Use globalThis.crypto (available in Node 19+ and all modern browsers)
// Falls back to node:crypto for older Node versions (server-side only)
function getRandomBytes(n: number): Uint8Array {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const buf = new Uint8Array(n);
    globalThis.crypto.getRandomValues(buf);
    return buf;
  }
  // Server-side fallback
  const nodeCrypto = require('crypto');
  return new Uint8Array(nodeCrypto.randomBytes(n));
}

function getRandomInt(min: number, max: number): number {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    const range = max - min;
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    return min + (arr[0]! % range);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto');
  return nodeCrypto.randomInt(min, max);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a unique order number: RG-YYYY-XXXXXX
 */
export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const random = bytesToHex(getRandomBytes(4)).substring(0, 6).toUpperCase();
  return `RG-${year}-${random}`;
}

/**
 * Generate a 6-digit numeric OTP.
 */
export function generateOtp(): string {
  return getRandomInt(100000, 999999).toString();
}

/**
 * Generate a unique referral code for partners.
 */
export function generateReferralCode(prefix = 'RG'): string {
  const random = bytesToHex(getRandomBytes(4)).substring(0, 6).toUpperCase();
  return `${prefix}-${random}`;
}

/**
 * Generate a 6-digit delivery PIN code.
 */
export function generateDeliveryPin(): string {
  return getRandomInt(100000, 999999).toString();
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
