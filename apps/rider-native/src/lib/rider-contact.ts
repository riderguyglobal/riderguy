const RESERVED_PHONE_PREFIX = /^(email|ghanacard|google)_/i;

/**
 * Authentication-only placeholder values must never be presented as a Rider's
 * verified contact number or used to prefill a payout destination.
 */
export function riderContactPhone(value?: string | null) {
  const phone = value?.trim();
  if (!phone || RESERVED_PHONE_PREFIX.test(phone)) return null;
  return phone.replace(/\D/g, '').length >= 9 ? phone : null;
}
