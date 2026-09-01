import { z } from 'zod';
import { requiredStringSchema } from './common';

/**
 * Store plate numbers in a stable, human-readable form so harmless casing and
 * separator differences cannot create duplicate registrations.
 */
export function normalizeVehiclePlateNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '-');
}

export const registerVehicleSchema = z.object({
  type: z.enum(['BICYCLE', 'MOTORCYCLE', 'CAR', 'VAN', 'TRUCK']),
  make: requiredStringSchema.max(50),
  model: requiredStringSchema.max(50),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1).optional(),
  color: z.string().max(30).optional(),
  plateNumber: requiredStringSchema.max(20).transform(normalizeVehiclePlateNumber),
});

/** Rider-editable vehicle fields only. Unknown/protected fields are rejected. */
export const updateVehicleSchema = registerVehicleSchema
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one vehicle field is required',
  });

/** Admin-only decision payload for reviewing a Rider's registered vehicle. */
export const reviewVehicleSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().trim().min(5).max(500).optional(),
}).strict().superRefine((data, context) => {
  if (data.status === 'REJECTED' && !data.rejectionReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rejectionReason'],
      message: 'A rejection reason of at least 5 characters is required',
    });
  }

  if (data.status === 'APPROVED' && data.rejectionReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rejectionReason'],
      message: 'A rejection reason is only allowed when rejecting a vehicle',
    });
  }
});

export type RegisterVehicleInput = z.infer<typeof registerVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ReviewVehicleInput = z.infer<typeof reviewVehicleSchema>;
