import { z } from 'zod';
import {
  latitudeSchema,
  longitudeSchema,
  requiredStringSchema,
  currencyAmountSchema,
} from './common';

export const createZoneSchema = z.object({
  name: requiredStringSchema.max(100),
  description: z.string().max(500).optional(),
  polygon: z
    .array(z.array(z.tuple([z.number(), z.number()])))
    .min(1, 'At least one polygon ring is required'),
  centerLatitude: latitudeSchema,
  centerLongitude: longitudeSchema,
  baseFare: currencyAmountSchema,
  perKmRate: currencyAmountSchema,
  minimumFare: currencyAmountSchema,
  commissionRate: z.number().min(0).max(100),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code'),
});

export const updateZoneSchema = createZoneSchema.partial();

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
