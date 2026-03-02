import { z } from 'zod';
import { latitudeSchema, longitudeSchema } from './common';

export const updateAvailabilitySchema = z.object({
  availability: z.enum(['OFFLINE', 'ONLINE', 'ON_DELIVERY', 'ON_BREAK']),
  /** Optional GPS coords — sent when rider goes ONLINE so lat/lng is never null */
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
});

export const updateLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
