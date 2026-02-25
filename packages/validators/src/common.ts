import { z } from 'zod';

/** Reusable phone number validation (E.164 format) */
export const phoneSchema = z
  .string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number must be at most 15 digits')
  .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format');

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
