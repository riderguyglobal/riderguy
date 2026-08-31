import { z } from 'zod';
import { latitudeSchema, longitudeSchema, phoneSchema, requiredStringSchema } from './common';

// Operational launch boundary. Keep these order-specific so global GPS features
// (for example rider location updates) retain their generic coordinate schemas.
export const GHANA_ORDER_BOUNDS = {
  minLatitude: 4.5,
  maxLatitude: 11.5,
  minLongitude: -3.5,
  maxLongitude: 1.5,
} as const;

export const ghanaOrderLatitudeSchema = latitudeSchema
  .min(GHANA_ORDER_BOUNDS.minLatitude, 'Location must be within Ghana')
  .max(GHANA_ORDER_BOUNDS.maxLatitude, 'Location must be within Ghana');

export const ghanaOrderLongitudeSchema = longitudeSchema
  .min(GHANA_ORDER_BOUNDS.minLongitude, 'Location must be within Ghana')
  .max(GHANA_ORDER_BOUNDS.maxLongitude, 'Location must be within Ghana');

// ── Enums shared with Prisma ──
const stopType = z.enum(['PICKUP', 'DROPOFF']);
const packageTypeEnum = z.enum([
  'DOCUMENT',
  'SMALL_PARCEL',
  'MEDIUM_PARCEL',
  'LARGE_PARCEL',
  'FOOD',
  'FRAGILE',
  'HIGH_VALUE',
  'OTHER',
]);
const paymentMethodEnum = z.enum(['CARD', 'MOBILE_MONEY', 'WALLET', 'CASH', 'BANK_TRANSFER']);
const scheduleFrequency = z.enum(['ONCE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM']);

// ── Multi-stop schema ──
const stopSchema = z.object({
  type: stopType,
  sequence: z.number().int().min(0),
  address: requiredStringSchema.max(500),
  latitude: ghanaOrderLatitudeSchema,
  longitude: ghanaOrderLongitudeSchema,
  contactName: z.string().max(100).optional(),
  contactPhone: phoneSchema.optional(),
  instructions: z.string().max(500).optional(),
  packageType: packageTypeEnum.optional(),
  packageDescription: z.string().max(500).optional(),
});

export const createOrderSchema = z.object({
  // Primary pickup (always required — first stop)
  pickupAddress: requiredStringSchema.max(500),
  pickupLatitude: ghanaOrderLatitudeSchema,
  pickupLongitude: ghanaOrderLongitudeSchema,
  pickupContactName: z.string().max(100).optional(),
  pickupContactPhone: phoneSchema.optional(),
  pickupInstructions: z.string().max(500).optional(),

  // Primary dropoff (always required — last stop)
  dropoffAddress: requiredStringSchema.max(500),
  dropoffLatitude: ghanaOrderLatitudeSchema,
  dropoffLongitude: ghanaOrderLongitudeSchema,
  dropoffContactName: z.string().max(100).optional(),
  dropoffContactPhone: phoneSchema.optional(),
  dropoffInstructions: z.string().max(500).optional(),

  // Package
  packageType: packageTypeEnum,
  packageDescription: z.string().max(500).optional(),
  packagePhotoUrl: z.string().max(1000).optional(),
  packageWeightKg: z.number().min(0).max(30).optional(),

  // Payment
  paymentMethod: paymentMethodEnum,

  // Express delivery
  isExpress: z.boolean().default(false),

  // Promo code
  promoCode: z.string().max(50).optional(),

  // Scheduling
  isScheduled: z.boolean().default(false),
  scheduledAt: z.coerce.date().optional(),

  // Multi-stop: additional pickups and/or dropoffs between primary pickup & dropoff
  // Each order must have at least 1 pickup and 1 dropoff (the primaries above).
  // Extra stops allow e.g. 3 pickups → 2 dropoffs in one trip.
  stops: z.array(stopSchema).max(10).optional(),

  // Schedule type for discount calculation
  scheduleType: z.enum(['NOW', 'SAME_DAY', 'NEXT_DAY', 'RECURRING']).optional(),

  // Client-side estimate total — server rejects if actual price drifts >15%
  estimatedTotalPrice: z.number().min(0).optional(),
}).refine(
  (data) => {
    // If scheduled, must have a scheduledAt date in the future
    if (data.isScheduled && !data.scheduledAt) return false;
    return true;
  },
  { message: 'Scheduled orders must include a scheduledAt date', path: ['scheduledAt'] }
).refine(
  (data) => {
    // scheduledAt must be in the future (allow 60s grace for clock skew)
    if (data.isScheduled && data.scheduledAt) {
      return data.scheduledAt.getTime() > Date.now() - 60_000;
    }
    return true;
  },
  { message: 'Scheduled time must be in the future', path: ['scheduledAt'] }
).refine(
  (data) => {
    // Multi-stop: extra stops are valid as long as they exist
    // Primary pickup/dropoff fields already guarantee at least 1 of each
    if (data.stops && data.stops.length > 0) {
      return data.stops.every(s => s.type === 'PICKUP' || s.type === 'DROPOFF');
    }
    return true;
  },
  { message: 'Invalid stop configuration', path: ['stops'] }
).refine(
  // ORD-03: contiguous, zero-based, monotonically increasing sequence numbers
  (data) => {
    if (!data.stops || data.stops.length === 0) return true;
    const sequences = data.stops.map(s => s.sequence).sort((a, b) => a - b);
    for (let i = 0; i < sequences.length; i++) {
      if (sequences[i] !== i) return false;
    }
    return true;
  },
  { message: 'Stop sequences must be contiguous starting from 0', path: ['stops'] }
).refine(
  // ORD-03: Total stops (primary pickup + primary dropoff + extras) must be ≤ 12
  // and must include at least 1 pickup and 1 dropoff overall (primaries already
  // guarantee this; this rule enforces the cap on extras + balanced shape).
  (data) => {
    const extras = data.stops ?? [];
    const totalStops = 2 + extras.length; // primary pickup + primary dropoff + extras
    if (totalStops > 12) return false;
    // Total pickups (1 primary + extras of type PICKUP), total dropoffs likewise
    const extraPickups = extras.filter(s => s.type === 'PICKUP').length;
    const extraDropoffs = extras.filter(s => s.type === 'DROPOFF').length;
    const totalPickups = 1 + extraPickups;
    const totalDropoffs = 1 + extraDropoffs;
    return totalPickups >= 1 && totalDropoffs >= 1;
  },
  { message: 'Order must have between 1 and 12 stops total with at least 1 pickup and 1 dropoff', path: ['stops'] }
);

export const priceEstimateSchema = z.object({
  pickupLatitude: ghanaOrderLatitudeSchema,
  pickupLongitude: ghanaOrderLongitudeSchema,
  dropoffLatitude: ghanaOrderLatitudeSchema,
  dropoffLongitude: ghanaOrderLongitudeSchema,
  packageType: packageTypeEnum,
  // Number of additional stops (simple count for quick estimates)
  additionalStops: z.number().int().min(0).max(10).optional(),
  // Schedule type affects discounts
  scheduleType: z.enum(['NOW', 'SAME_DAY', 'NEXT_DAY', 'RECURRING']).optional(),
  // Express delivery option
  isExpress: z.boolean().optional(),
  // Package weight in kg (for weight surcharge)
  packageWeightKg: z.number().min(0).max(30).optional(),
  // Payment method (affects service fee rate)
  paymentMethod: paymentMethodEnum.optional(),
  // Promo code (for discount)
  promoCode: z.string().max(50).optional(),
  // Optional extra stops with coordinates for precise multi-stop pricing
  stops: z.array(z.object({
    type: stopType,
    latitude: ghanaOrderLatitudeSchema,
    longitude: ghanaOrderLongitudeSchema,
  })).max(10).optional(),
});

// ── Scheduled / Recurring Delivery ──
export const createScheduledDeliverySchema = z.object({
  title: z.string().max(100).optional(),
  frequency: scheduleFrequency,

  // For one-time future deliveries
  scheduledDate: z.coerce.date().optional(),

  // For recurring: time of day in HH:mm
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').optional(),

  // For WEEKLY frequency: array of ISO day numbers (1=Mon, 7=Sun)
  daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).optional(),

  // For MONTHLY frequency: day of month
  dayOfMonth: z.number().int().min(1).max(31).optional(),

  // Recurrence window
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  maxOccurrences: z.number().int().min(1).max(365).optional(),

  // Route template
  pickupAddress: requiredStringSchema.max(500),
  pickupLatitude: ghanaOrderLatitudeSchema,
  pickupLongitude: ghanaOrderLongitudeSchema,
  pickupContactName: z.string().max(100).optional(),
  pickupContactPhone: phoneSchema.optional(),
  pickupInstructions: z.string().max(500).optional(),

  dropoffAddress: requiredStringSchema.max(500),
  dropoffLatitude: ghanaOrderLatitudeSchema,
  dropoffLongitude: ghanaOrderLongitudeSchema,
  dropoffContactName: z.string().max(100).optional(),
  dropoffContactPhone: phoneSchema.optional(),
  dropoffInstructions: z.string().max(500).optional(),

  // Multi-stop template for recurring multi-stop deliveries
  stops: z.array(stopSchema).max(10).optional(),

  // Package & payment defaults
  packageType: packageTypeEnum.optional(),
  packageDescription: z.string().max(500).optional(),
  paymentMethod: paymentMethodEnum.optional(),
}).refine(
  (data) => {
    if (data.frequency === 'ONCE' && !data.scheduledDate) {
      return false;
    }
    return true;
  },
  { message: 'One-time schedules require a scheduledDate', path: ['scheduledDate'] }
).refine(
  (data) => {
    if (data.frequency === 'WEEKLY' && (!data.daysOfWeek || data.daysOfWeek.length === 0)) {
      return false;
    }
    return true;
  },
  { message: 'Weekly schedules require at least one day selected', path: ['daysOfWeek'] }
).refine(
  (data) => {
    if (data.frequency === 'MONTHLY' && !data.dayOfMonth) {
      return false;
    }
    return true;
  },
  { message: 'Monthly schedules require a dayOfMonth', path: ['dayOfMonth'] }
);

export const updateScheduledDeliverySchema = z.object({
  title: z.string().max(100).optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  endDate: z.coerce.date().nullable().optional(),
  maxOccurrences: z.number().int().min(1).max(365).nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']).optional(),
});

export const rateOrderSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(500).optional(),
  tipAmount: z.number().min(0).max(10000).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ── Exported types ──
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type PriceEstimateInput = z.infer<typeof priceEstimateSchema>;
export type CreateScheduledDeliveryInput = z.infer<typeof createScheduledDeliverySchema>;
export type UpdateScheduledDeliveryInput = z.infer<typeof updateScheduledDeliverySchema>;
export type RateOrderInput = z.infer<typeof rateOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type StopInput = z.infer<typeof stopSchema>;
