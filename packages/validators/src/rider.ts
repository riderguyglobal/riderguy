import { z } from 'zod';
import { latitudeSchema, longitudeSchema, phoneSchema } from './common';

export const updateAvailabilitySchema = z.object({
  // ON_DELIVERY is dispatch-owned. ON_BREAK has no implemented server
  // transition, so neither state is accepted from a public client.
  availability: z.enum(['OFFLINE', 'ONLINE']),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.availability !== 'ONLINE') return;
  if (value.latitude === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['latitude'], message: 'Current latitude is required to go online' });
  }
  if (value.longitude === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['longitude'], message: 'Current longitude is required to go online' });
  }
});

export const updateLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const selectRiderChannelSchema = z.object({
  channel: z.enum(['GUEST', 'IN_HOUSE']),
  invitationCode: z.string().trim().min(8).max(80).optional(),
});

export const createInHouseInvitationSchema = z.object({
  email: z.string().trim().email().optional(),
  phone: phoneSchema.optional(),
  expiresInDays: z.coerce.number().int().min(1).max(30).optional(),
}).refine((value) => Boolean(value.email || value.phone), {
  message: 'An email address or phone number is required',
});

export const rejectRiderApplicationSchema = z.object({
  reason: z.string().trim().min(5, 'A meaningful rejection reason is required').max(500),
});

export const adminClassifyRiderChannelSchema = z.object({
  channel: z.enum(['GUEST', 'IN_HOUSE']),
});

/**
 * A trained Rider can register interest in the 12-month asset lease program.
 * Eligibility is always re-checked by the API; clients cannot assert it.
 */
export const createAssetFinancingInterestSchema = z.object({
  assetType: z.enum(['MOTORBIKE', 'ELECTRIC_VEHICLE']),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export const updateAssetFinancingInterestStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'WITHDRAWN']),
  reviewNotes: z.string().trim().min(3).max(1000).optional(),
  expectedUpdatedAt: z.string().datetime(),
}).strict().superRefine((data, context) => {
  if (data.status === 'DECLINED' && !data.reviewNotes) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reviewNotes'],
      message: 'Review notes of at least 3 characters are required when declining an interest',
    });
  }
});

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type SelectRiderChannelInput = z.infer<typeof selectRiderChannelSchema>;
export type CreateInHouseInvitationInput = z.infer<typeof createInHouseInvitationSchema>;
export type CreateAssetFinancingInterestInput = z.infer<typeof createAssetFinancingInterestSchema>;
export type UpdateAssetFinancingInterestStatusInput = z.infer<typeof updateAssetFinancingInterestStatusSchema>;
