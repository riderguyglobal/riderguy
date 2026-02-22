import { z } from 'zod';
import { latitudeSchema, longitudeSchema } from './common';

export const updateAvailabilitySchema = z.object({
  availability: z.enum(['OFFLINE', 'ONLINE', 'ON_DELIVERY', 'ON_BREAK']),
});

export const updateLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
