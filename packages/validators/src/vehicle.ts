import { z } from 'zod';
import { requiredStringSchema } from './common';

export const registerVehicleSchema = z.object({
  type: z.enum(['BICYCLE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK']),
  make: requiredStringSchema.max(50),
  model: requiredStringSchema.max(50),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1).optional(),
  color: z.string().max(30).optional(),
  plateNumber: requiredStringSchema.max(20),
});

export type RegisterVehicleInput = z.infer<typeof registerVehicleSchema>;
