/** Normalize a user-entered Ghana phone number to +233 followed by nine digits. */
export function normalizePhoneNumber(value: string): string {
  const raw = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(raw)) return '';

  const digits = raw.replace(/\D/g, '');
  if (/^233[1-9]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[1-9]\d{8}$/.test(digits)) return `+233${digits.slice(1)}`;
  if (/^[1-9]\d{8}$/.test(digits)) return `+233${digits}`;
  return '';
}
