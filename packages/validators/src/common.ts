import { z } from 'zod';

/** Normalize supported Ghana phone input to the canonical +233XXXXXXXXX form. */
export function normalizeGhanaPhoneNumber(value: string): string {
  const raw = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(raw)) return '';

  const digits = raw.replace(/\D/g, '');
  if (/^233[1-9]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[1-9]\d{8}$/.test(digits)) return `+233${digits.slice(1)}`;
  if (/^[1-9]\d{8}$/.test(digits)) return `+233${digits}`;
  return '';
}

/** User-entered phone numbers are Ghana-only for the current launch. */
export const phoneSchema = z
  .string()
  .transform(normalizeGhanaPhoneNumber)
  .refine((value) => /^\+233[1-9]\d{8}$/.test(value), {
    message: 'Enter a valid Ghana phone number starting with +233 or 0',
  });

/** Reusable email validation */
export const emailSchema = z.string().email('Invalid email address').toLowerCase().trim();

/** Reusable password validation */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/** Reusable 6-digit PIN validation */
export const pinSchema = z
  .string()
  .length(6, 'PIN must be exactly 6 digits')
  .regex(/^\d{6}$/, 'PIN must be numeric');

/** Pagination query params */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** Latitude */
export const latitudeSchema = z.number().min(-90).max(90);

/** Longitude */
export const longitudeSchema = z.number().min(-180).max(180);

/** Coordinates pair */
export const coordinatesSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

/** ID (CUID format used by Prisma) */
export const idSchema = z.string().min(1, 'Invalid ID format').max(30, 'Invalid ID format');

/** UUID (for external system IDs) */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/** Non-empty trimmed string */
export const requiredStringSchema = z.string().trim().min(1, 'This field is required');

/** Currency amount (positive, max 2 decimal places) */
export const currencyAmountSchema = z
  .number()
  .positive('Amount must be positive')
  .refine(
    (v) => Math.round(v * 100) / 100 === v,
    'Amount must have at most 2 decimal places'
  );

export type PaginationInput = z.infer<typeof paginationSchema>;
export type CoordinatesInput = z.infer<typeof coordinatesSchema>;
