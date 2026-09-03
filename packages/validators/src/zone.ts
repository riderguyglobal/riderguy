import { z } from 'zod';
import { requiredStringSchema, currencyAmountSchema } from './common';

const ghanaLatitudeSchema = z
  .number()
  .min(4.5, 'Latitude must be within Ghana')
  .max(11.2, 'Latitude must be within Ghana');
const ghanaLongitudeSchema = z
  .number()
  .min(-3.3, 'Longitude must be within Ghana')
  .max(1.3, 'Longitude must be within Ghana');
const zonePolygonSchema = z
  .array(
    z
      .array(z.tuple([ghanaLongitudeSchema, ghanaLatitudeSchema]))
      .min(4, 'A polygon ring requires at least four points'),
  )
  .min(1, 'At least one polygon ring is required')
  .superRefine((rings, context) => {
    rings.forEach((ring, ringIndex) => {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
        context.addIssue({
          code: 'custom',
          path: [ringIndex],
          message: 'Polygon rings must close by repeating the first point',
        });
      }
    });
  });

const zoneFields = z.object({
  name: requiredStringSchema.max(100),
  description: z.string().max(500).optional(),
  polygon: zonePolygonSchema,
  centerLatitude: ghanaLatitudeSchema,
  centerLongitude: ghanaLongitudeSchema,
  baseFare: currencyAmountSchema,
  perKmRate: currencyAmountSchema,
  minimumFare: currencyAmountSchema,
  commissionRate: z.number().min(0).max(100),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code'),
});

export const createZoneSchema = zoneFields;

export const updateZoneSchema = zoneFields.partial();

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
