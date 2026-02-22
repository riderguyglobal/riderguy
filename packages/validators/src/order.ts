import { z } from 'zod';
import { latitudeSchema, longitudeSchema, requiredStringSchema, currencyAmountSchema } from './common';

export const createOrderSchema = z.object({
  pickupAddress: requiredStringSchema.max(500),
  pickupLatitude: latitudeSchema,
  pickupLongitude: longitudeSchema,
  pickupContactName: z.string().max(100).optional(),
  pickupContactPhone: z.string().max(20).optional(),
  pickupInstructions: z.string().max(500).optional(),
  dropoffAddress: requiredStringSchema.max(500),
  dropoffLatitude: latitudeSchema,
  dropoffLongitude: longitudeSchema,
  dropoffContactName: z.string().max(100).optional(),
  dropoffContactPhone: z.string().max(20).optional(),
  dropoffInstructions: z.string().max(500).optional(),
  packageType: z.enum([
    'DOCUMENT',
    'SMALL_PARCEL',
    'MEDIUM_PARCEL',
    'LARGE_PARCEL',
    'FOOD',
    'FRAGILE',
    'HIGH_VALUE',
  ]),
  packageDescription: z.string().max(500).optional(),
  paymentMethod: z.enum(['CARD', 'MOBILE_MONEY', 'WALLET', 'CASH']),
  isScheduled: z.boolean().default(false),
  scheduledAt: z.coerce.date().optional(),
});

export const priceEstimateSchema = z.object({
  pickupLatitude: latitudeSchema,
  pickupLongitude: longitudeSchema,
  dropoffLatitude: latitudeSchema,
  dropoffLongitude: longitudeSchema,
  packageType: z.enum([
    'DOCUMENT',
    'SMALL_PARCEL',
    'MEDIUM_PARCEL',
    'LARGE_PARCEL',
    'FOOD',
    'FRAGILE',
    'HIGH_VALUE',
  ]),
});

export const rateOrderSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(500).optional(),
  tipAmount: z.number().min(0).max(10000).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type PriceEstimateInput = z.infer<typeof priceEstimateSchema>;
export type RateOrderInput = z.infer<typeof rateOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
